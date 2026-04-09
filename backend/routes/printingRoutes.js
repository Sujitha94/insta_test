const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const FromAddress = require('../models/FromAddress');
const Template = require('../models/PrintingTemplate');
const puppeteer = require('puppeteer');

// GET endpoint to fetch a "from address"
router.get('/from-address', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    console.log(`Fetching from address for tenant: ${tenentId}`);

    if (!tenentId) {
      console.log('No tenant ID provided');
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Find the most recent address for this tenant
    const address = await FromAddress.findOne({ tenent_id: tenentId })
      .sort({ createdAt: -1 });

    if (!address) {
      console.log(`No address found for tenant: ${tenentId}`);
      return res.status(404).json({
        success: false,
        message: 'No address found for this tenant'
      });
    }

    console.log(`Address found for tenant: ${tenentId}`);
    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('Error fetching from address:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching address'
    });
  }
});

// POST endpoint to save a "from address"
router.post('/from-address', async (req, res) => {
  try {
    const addressData = req.body;
    const tenentId = req.tenentId || req.headers['tenent-id'] || addressData.tenent_id;

    if (!tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Ensure tenent_id is set
    addressData.tenent_id = tenentId;

    // Create a new address
    const newAddress = new FromAddress(addressData);
    await newAddress.save();

    console.log(`New address saved for tenant: ${tenentId}`);
    res.status(201).json({
      success: true,
      message: 'Address saved successfully',
      data: newAddress
    });
  } catch (error) {
    console.error('Error saving from address:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error saving address'
    });
  }
});

router.post('/initialize-templates', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'] || req.body.tenent_id;

    if (!tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Check if tenant already has templates
    const existingTemplates = await Template.find({ tenent_id: tenentId });

    if (existingTemplates.length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Templates already exist for this tenant',
        count: existingTemplates.length
      });
    }

    // Create default templates
    await Template.createDefaultTemplates(tenentId);

    // Get the newly created templates
    const templates = await Template.find({ tenent_id: tenentId });

    res.status(201).json({
      success: true,
      message: 'Default templates created successfully',
      count: templates.length
    });
  } catch (error) {
    console.error('Error initializing templates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error initializing templates'
    });
  }
});

// GET endpoint to retrieve a single bill by ID
router.get('/print-bill/:billId', async (req, res) => {
  try {
    const { billId } = req.params;
    const tenentId = req.tenentId || req.headers['tenent-id'];
    console.log(`Fetching bill ${billId} for tenant: ${tenentId}`);

    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required' });
    }

    if (!tenentId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Build query to find order by multiple possible identifiers
    let query = {
      tenentId: tenentId
    };

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(billId);

    const orConditions = [
      { orderId: billId },
      { bill_no: billId }
    ];

    if (isValidObjectId) {
      orConditions.push({ _id: billId });
    }

    query.$or = orConditions;

    console.log('Query:', JSON.stringify(query, null, 2));

    // Find the order with the fixed query
    const order = await Order.findOne(query);

    if (!order) {
      console.log(`Bill ${billId} not found for tenant: ${tenentId}`);
      return res.status(404).json({ error: 'Bill not found' });
    }

    console.log(`Bill ${billId} found for tenant: ${tenentId}, ID: ${order._id}, Status: ${order.status}`);

    // ✅ NEW: Check if order status allows printing - block PENDING orders
    if (order.status === 'CREATED') {
      console.log(`Bill ${billId} cannot be printed due to PENDING status`);
      return res.status(400).json({
        error: 'Cannot print order with PENDING status. Order must be processed before printing.',
        currentStatus: order.status,
        billId: billId
      });
    }

    const fromAddress = await getOrganizationAddress(tenentId);
    const formattedBill = formatOrderForPrinting(order, fromAddress);

    // ✅ UPDATE: Conditionally update status based on current order status
    const preservedStatuses = ['COMPLETED', 'PACKED', 'HOLDED'];

    let updateFields = {
      print_status: 'PRINTED',
      last_printed_at: new Date()
    };

    // Only update status to 'PRINTED' if current status is not in preserved statuses
    if (!preservedStatuses.includes(order.status)) {
      updateFields.status = 'PRINTED';
    }

    await Order.updateOne(
      { _id: order._id },
      { $set: updateFields }
    );

    console.log(`Bill ${billId} marked as printed. Status: ${order.status} -> ${updateFields.status || order.status}`);

    res.status(200).json(formattedBill);
  } catch (error) {
    console.error('Error fetching bill for printing:', error);
    res.status(500).json({ error: 'Server error fetching bill details' });
  }
});

// GET endpoint for bulk printing - retrieves all unprinted orders
router.get('/bulkPrinting', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    const limit = parseInt(req.query.limit) || 50; // Default to max 50 orders at once
    const dryRun = req.query.dryRun === '1' || req.query.preview === '1'; // ✨ NEW

    console.log(`Fetching pending orders for bulk printing. Tenant: ${tenentId}, Limit: ${limit}, dryRun=${dryRun}`);

    // include both cases if you want (adjust as you already do elsewhere)
    const pendingOrders = await Order.find({
      tenentId: tenentId,
      print_status: 'PENDING',
      status: { $in: ['processing','PROCESSING'] } // add PACKED/PAID if desired
    }).limit(limit).sort({ created_at: 1 });

    console.log(`Found ${pendingOrders.length} pending orders for tenant: ${tenentId}`);

    if (pendingOrders.length === 0) {
      return res.status(200).json({
        bills: [],
        message: "No pending orders found to print",
        aggregatedProducts: [],      // ✨ for FE code simplicity
        totals: { totalBills: 0, totalItems: 0 }
      });
    }

    const fromAddress = await getOrganizationAddress(tenentId);
    const formattedBills = pendingOrders.map(order => formatOrderForPrinting(order, fromAddress));

    // ✨ NEW: aggregate product quantities across all bills (by name + selected unit)
    const productMap = new Map(); // key: productName, value: qty
    let totalItems = 0;

    for (const bill of formattedBills) {
      for (const p of bill.product_details) {
        const name = p.productName; // already includes (selectedunit) in your formatter
        const qty = Number(p.quantity || 0);
        totalItems += qty;
        productMap.set(name, (productMap.get(name) || 0) + qty);
      }
    }

    const aggregatedProducts = Array.from(productMap.entries())
      .map(([productName, quantity]) => ({ productName, quantity }))
      .sort((a, b) => a.productName.localeCompare(b.productName));

    const orderIds = pendingOrders.map(order => order._id);

    // ✨ Only mutate DB when NOT dryRun
    if (!dryRun) {
      await Order.updateMany(
        { _id: { $in: orderIds } },
        { $set: { print_status: 'PRINTED', status: 'PRINTED', last_printed_at: new Date() } }
      );
      console.log(`Marked ${orderIds.length} orders as printed with status updated`);
    } else {
      console.log(`Dry run enabled: no DB updates performed.`);
    }

    const remaining = dryRun ? await getRemainingPendingCount(tenentId) : await getRemainingPendingCount(tenentId);

    res.status(200).json({
      bills: formattedBills,                 // FE can still render previews if needed
      total: pendingOrders.length,
      remaining, 
      aggregatedProducts,                    // ✨ used for the popup list
      totals: { totalBills: pendingOrders.length, totalItems }  // ✨ quick stats
    });
  } catch (error) {
    console.error('Error fetching bills for bulk printing:', error);
    res.status(500).json({ error: 'Server error fetching bills for printing' });
  }
});


// Helper function to get remaining pending order count
async function getRemainingPendingCount(tenentId) {
  try {
    // ✅ UPDATE: Include 'PACKED' status in the query
    const count = await Order.countDocuments({
      tenentId: tenentId,
      print_status: 'PENDING',
      status: { $in: ['processing', 'PROCESSING'] }
    });
    console.log(`Counted ${count} remaining pending orders for tenant: ${tenentId}`);
    return count;
  } catch (error) {
    console.error('Error counting remaining pending orders:', error);
    return 0;
  }
}

// Helper function to get organization address
async function getOrganizationAddress(tenentId) {
  try {
    console.log(`Fetching organization address for tenant: ${tenentId}`);
    const address = await FromAddress.findOne({ tenent_id: tenentId })
      .sort({ _id: -1 });

    if (!address) {
      console.log(`No organization address found for tenant: ${tenentId}, using default`);
      return {
        shopName: 'Your Business',
        street: 'Main Street',
        district: 'District',
        state: 'State',
        pincode: '123456',
        phone: '1234567890'
      };
    }

    console.log(`Organization address found for tenant: ${tenentId}`);
    return {
      shopName: address.name,
      street: address.street,
      district: address.city,
      state: address.state,
      pincode: address.zipCode,
      phone: address.phone
    };
  } catch (error) {
    console.error('Error fetching organization address:', error);
    return {
      shopName: 'Your Business',
      street: 'Main Street',
      district: 'District',
      state: 'State',
      pincode: '123456',
      phone: '1234567890'
    };
  }
}

// Helper function to format order data for printing
function formatOrderForPrinting(order, orgAddress) {
  let addressObj = {};
  try {
    if (typeof order.address === 'string' && order.address.startsWith('{')) {
      addressObj = JSON.parse(order.address);
    } else {
      addressObj = {
        street: order.address,
        city: order.city,
        state: order.state,
        pincode: order.zip_code,
      };
    }
  } catch (e) {
    console.error('Error parsing address:', e);
    addressObj = {
      street: order.address,
      city: order.city,
      state: order.state,
      pincode: order.zip_code,
    };
  }

  const productCount = order.products.reduce((sum, product) => sum + (product.quantity || 1), 0);
  const totalWeight = calculateOrderWeight(order.products);

  // Create a product list showing quantity and number of specific products
  // Include selectedunit in product name if it exists
  const productDetails = order.products.map(product => {
    let productDisplayName = product.product_name;

    // Add selectedunit to product name if it exists
    if (product.selectedunit) {
      productDisplayName += ` (${product.selectedunit})`;
    }

    return {
      productName: productDisplayName,
      quantity: product.quantity || 1,
      productCount: order.products.filter(p => p.product_name === product.product_name).length,
      // Keep original data for reference
      originalProductName: product.product_name,
      selectedUnit: product.selectedunit || null
    };
  });

  return {
    bill_id: order.orderId || order.bill_no,
    customer_details: {
      name: order.customer_name,
      flat_no: addressObj.flat_no || '',
      street: addressObj.street || order.address || '',
      district: addressObj.district || order.city || '',
      state: addressObj.state || order.state || '',
      pincode: addressObj.pincode || order.zip_code || '',
      phone: order.phone_number
    },
    organisation_details: orgAddress,
    bill_details: {
      bill_no: order.orderId || order.bill_no,
      date: new Date(order.created_at).toLocaleDateString(),
      time: new Date(order.created_at).toLocaleTimeString(),
      payment_method: order.payment_method || order.paymentMethod || 'Online',
      payment_status: order.payment_status || order.paymentStatus || (order.status === 'paid' ? 'Paid' : 'Pending')
    },
    product_details: productDetails,
    shipping_details: {
      method_name: order.shipping_partner || 'Standard Shipping',
      tracking_id: order.tracking_id || '',
      weight: totalWeight,
      item_count: productCount
    }
  };
}

// Helper function to calculate order weight
function calculateOrderWeight(products) {
  if (!products || products.length === 0) return '0.5 kg';

  const totalWeight = products.reduce((sum, product) => {
    if (product.weight) {
      const weightMatch = /(\d+(\.\d+)?)\s*(g|kg|gm)?/i.exec(product.weight);
      if (weightMatch) {
        const value = parseFloat(weightMatch[1]);
        const unit = (weightMatch[3] || 'g').toLowerCase();
        const grams = unit === 'kg' ? value * 1000 : value;
        return sum + (grams * (product.quantity || 1));
      }
    }
    return sum + (100 * (product.quantity || 1));
  }, 0);

  if (totalWeight >= 1000) {
    return `${(totalWeight / 1000).toFixed(2)} kg`;
  } else {
    return `${totalWeight.toFixed(0)} g`;
  }
}

// PUT endpoint to update print status
router.put('/update-print-status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { print_status } = req.body;
    const tenentId = req.tenentId || req.headers['tenent-id'];

    console.log(`Updating print status for order ${orderId}, tenant: ${tenentId}, status: ${print_status}`);

    if (!orderId || !print_status) {
      return res.status(400).json({ error: 'Order ID and print status are required' });
    }

    const validStatuses = ['PENDING', 'PRINTED', 'FAILED'];
    if (!validStatuses.includes(print_status)) {
      return res.status(400).json({ error: 'Invalid print status' });
    }

    let query = {
      tenentId: tenentId
    };

    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(orderId);

    const orConditions = [
      { orderId: orderId },
      { bill_no: orderId }
    ];

    if (isValidObjectId) {
      orConditions.push({ _id: orderId });
    }

    query.$or = orConditions;

    // ✅ UPDATE: Update both print_status and status
    const updateObj = {
      $set: {
        print_status,
        status: print_status, // Update main status to match print_status
        ...(print_status === 'PRINTED' ? { last_printed_at: new Date() } : {})
      }
    };

    const result = await Order.updateOne(query, updateObj);

    if (result.matchedCount === 0) {
      console.log(`Order ${orderId} not found for tenant: ${tenentId}`);
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`Print status and main status updated successfully for order ${orderId}. Modified: ${result.modifiedCount}`);

    const remaining = await getRemainingPendingCount(tenentId);

    res.status(200).json({
      message: 'Print status updated successfully',
      remaining: remaining
    });
  } catch (error) {
    console.error('Error updating print status:', error);
    res.status(500).json({ error: 'Server error updating print status' });
  }
});

// GET endpoint to fetch pending print count
router.get('/pending-count', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    console.log(`Fetching pending print count for tenant: ${tenentId}`);

    if (!tenentId) {
      console.log('No tenant ID provided');
      return res.status(400).json({
        count: 0,
        error: 'Tenant ID is required'
      });
    }

    const totalOrders = await Order.countDocuments({
      tenentId: tenentId
    });

    console.log(`Total orders found for tenant ${tenentId}: ${totalOrders}`);

    // ✅ UPDATE: Include 'PACKED' status in the query
    const count = await Order.countDocuments({
      tenentId: tenentId,
      print_status: 'PENDING',
      status: { $in: ['processing', 'PROCESSING'] }
    });

    console.log(`Pending print count for tenant ${tenentId}: ${count} (out of ${totalOrders} total orders)`);

    const printedCount = await Order.countDocuments({
      tenentId: tenentId,
      print_status: 'PRINTED'
    });

    const failedCount = await Order.countDocuments({
      tenentId: tenentId,
      print_status: 'FAILED'
    });

    const nullCount = await Order.countDocuments({
      tenentId: tenentId,
      print_status: null
    });

    console.log(`Other print statuses: PRINTED=${printedCount}, FAILED=${failedCount}, NULL=${nullCount}`);

    res.status(200).json({
      count,
      debug: {
        total: totalOrders,
        printed: printedCount,
        failed: failedCount,
        null: nullCount
      }
    });
  } catch (error) {
    console.error('Error counting pending prints:', error);
    res.status(500).json({ error: 'Server error counting pending prints', count: 0 });
  }
});

// Helper function to update order print status (used by PDF generation)
async function updateOrderPrintStatus(billId, tenentId) {
  try {
    // ✅ UPDATE: Update both print_status and status to 'PRINTED'
    await Order.updateOne(
      {
        $or: [
          { orderId: billId },
          { bill_no: billId },
          { _id: /^[0-9a-fA-F]{24}$/.test(billId) ? billId : null }
        ].filter(Boolean),
        tenentId: tenentId
      },
      {
        $set: {
          print_status: 'PRINTED',
          status: 'PRINTED',
          last_printed_at: new Date()
        }
      }
    );
    console.log(`Order ${billId} print status and main status updated to PRINTED`);
  } catch (error) {
    console.error('Error updating order print status:', error);
  }
}

router.post('/generate-pdf', async (req, res) => {
  try {
    const { html, templateId, billId } = req.body;
    const tenentId = req.headers['tenent-id'];

    // Get template dimensions based on templateId
    const templateDimensions = getTemplateDimensions(templateId);

    // Launch a browser instance
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the page size based on the template
    await page.setViewport({
      width: templateDimensions.width,
      height: templateDimensions.height,
      deviceScaleFactor: 2 // for higher quality
    });

    // Set the content
    await page.setContent(html);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      width: `${templateDimensions.width / 96}in`,
      height: `${templateDimensions.height / 96}in`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    // ✅ UPDATE: Update order status if billId provided
    if (billId) {
      await updateOrderPrintStatus(billId, tenentId);
    }

    // Send the PDF as response
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send({ error: 'Failed to generate PDF' });
  }
});

function getTemplateDimensions(templateId) {
  // Return dimensions based on template ID
  const templates = {
    '4x4': { width: 384, height: 384 },
    '2x4': { width: 192, height: 384 },
    '4x6': { width: 384, height: 576 },
    'a4': { width: 793, height: 1123 }
  };

  return templates[templateId] || templates['4x4'];
}

router.post('/generate-bulk-pdf', async (req, res) => {
  try {
    const { html, templateId } = req.body;
    const tenentId = req.headers['tenent-id'];

    // Launch a browser instance
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the content
    await page.setContent(html);

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true
    });

    await browser.close();

    // Send the PDF as response
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating bulk PDF:', error);
    res.status(500).send({ error: 'Failed to generate bulk PDF' });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    console.log(`Fetching templates for tenant: ${tenentId}`);

    if (!tenentId) {
      console.log('No tenant ID provided');
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Find all templates for this tenant
    let templates = await Template.find({ tenent_id: tenentId })
      .sort({ createdAt: -1 });

    // If no templates found, create default templates
    if (templates.length === 0) {
      console.log(`No templates found for tenant: ${tenentId}, creating defaults`);

      // Create default templates
      await Template.createDefaultTemplates(tenentId);

      // Fetch the newly created templates
      templates = await Template.find({ tenent_id: tenentId })
        .sort({ createdAt: -1 });
    }

    console.log(`Found ${templates.length} templates for tenant: ${tenentId}`);

    // Format templates for frontend
    const formattedTemplates = templates.map(template => ({
      id: template.templateId,
      name: template.name,
      description: template.description,
      width: template.width,
      height: template.height,
      className: template.className,
      isDefault: template.isDefault
    }));

    res.status(200).json({
      success: true,
      data: formattedTemplates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching templates'
    });
  }
});

// POST endpoint to save a template
router.post('/templates', async (req, res) => {
  try {
    const templateData = req.body;
    const tenentId = req.tenentId || req.headers['tenent-id'] || templateData.tenent_id;

    if (!tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Ensure tenent_id is set
    templateData.tenent_id = tenentId;

    // If this is marked as default, unset default for other templates
    if (templateData.isDefault) {
      await Template.updateMany(
        { tenent_id: tenentId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    // Check if template already exists for this tenant
    const existingTemplate = await Template.findOne({
      tenent_id: tenentId,
      templateId: templateData.templateId
    });

    let savedTemplate;

    if (existingTemplate) {
      // Update existing template
      savedTemplate = await Template.findByIdAndUpdate(
        existingTemplate._id,
        templateData,
        { new: true }
      );
      console.log(`Updated existing template for tenant: ${tenentId}`);
    } else {
      // Create a new template
      const newTemplate = new Template(templateData);
      savedTemplate = await newTemplate.save();
      console.log(`New template saved for tenant: ${tenentId}`);
    }

    res.status(201).json({
      success: true,
      message: 'Template saved successfully',
      data: savedTemplate
    });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error saving template'
    });
  }
});

// GET endpoint to fetch default template
router.get('/default-template', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    console.log(`Fetching default template for tenant: ${tenentId}`);

    if (!tenentId) {
      console.log('No tenant ID provided');
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    // Find the default template for this tenant
    const defaultTemplate = await Template.findOne({
      tenent_id: tenentId,
      isDefault: true
    });

    if (!defaultTemplate) {
      console.log(`No default template found for tenant: ${tenentId}`);
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No default template found'
      });
    }

    console.log(`Default template found for tenant: ${tenentId}`);

    // Format template for frontend
    const formattedTemplate = {
      id: defaultTemplate.templateId,
      name: defaultTemplate.name,
      description: defaultTemplate.description,
      width: defaultTemplate.width,
      height: defaultTemplate.height,
      className: defaultTemplate.className
    };

    res.status(200).json({
      success: true,
      data: formattedTemplate
    });
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching default template'
    });
  }
});

// DELETE endpoint to remove a template
router.delete('/templates/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const tenentId = req.tenentId || req.headers['tenent-id'];

    if (!tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }

    const result = await Template.deleteOne({
      tenent_id: tenentId,
      templateId: templateId
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    console.log(`Template ${templateId} deleted for tenant: ${tenentId}`);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error deleting template'
    });
  }
});

// POST endpoint to reset print status (reprint all orders)
router.post('/reset-print-status', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];
    const { status, days } = req.body;

    const daysBack = parseInt(days) || 30;
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    console.log(`Resetting print status for tenant: ${tenentId}, days back: ${daysBack}`);

    // ✅ UPDATE: Include 'PACKED' and 'PRINTED' in valid statuses
    const validStatuses = ['processing', 'paid', 'shipped', 'delivered', 'completed', 'CREATED', 'PENDING', 'PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED', 'COMPLETED','HOLDED'];
    const orderStatuses = status ?
      (Array.isArray(status) ? status.filter(s => validStatuses.includes(s)) : [status].filter(s => validStatuses.includes(s)))
      : ['processing', 'paid', 'shipped', 'delivered', 'completed', 'CREATED', 'PENDING', 'PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED','COMPLETED','HOLDED'];

    if (orderStatuses.length === 0) {
      return res.status(400).json({ error: 'No valid order statuses provided' });
    }

    console.log(`Resetting orders with statuses: ${orderStatuses.join(', ')}`);

    const eligibleCount = await Order.countDocuments({
      tenentId: tenentId,
      status: { $in: orderStatuses },
      created_at: { $gte: cutoffDate }
    });

    console.log(`Found ${eligibleCount} eligible orders to reset`);

    const result = await Order.updateMany(
      {
        tenentId: tenentId,
        status: { $in: orderStatuses },
        created_at: { $gte: cutoffDate }
      },
      { $set: { print_status: 'PENDING' } }
    );

    console.log(`Reset ${result.modifiedCount} orders to PENDING status`);

    res.status(200).json({
      message: 'Print status reset successfully',
      eligible: eligibleCount,
      count: result.modifiedCount,
      statuses: orderStatuses
    });
  } catch (error) {
    console.error('Error resetting print status:', error);
    res.status(500).json({ error: 'Server error resetting print status' });
  }
});

// GET endpoint to view order schema
// GET endpoint to view order schema
router.get('/debug-schema', async (req, res) => {
  try {
    const tenentId = req.tenentId || req.headers['tenent-id'];

    const sampleOrder = await Order.findOne({ tenentId: tenentId }).lean();

    if (!sampleOrder) {
      return res.status(404).json({
        message: 'No orders found for this tenant',
        schema: Order.schema.paths
      });
    }

    delete sampleOrder.payment_details;
    delete sampleOrder.customer_password;

    res.status(200).json({
      message: 'Schema information retrieved',
      schema: Object.keys(Order.schema.paths),
      sampleOrder: sampleOrder
    });
  } catch (error) {
    console.error('Error retrieving schema info:', error);
    res.status(500).json({ error: 'Server error retrieving schema info' });
  }
 });

 module.exports = router;
