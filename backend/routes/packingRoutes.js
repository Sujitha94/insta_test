const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const ProductDetail = require('../models/ProductDetail');
const Signup = require('../models/Signup');
const LongToken = require('../models/LongToken');
const axios = require('axios');
const crypto = require('crypto');

// SMS Configuration
const SMS_CONFIG = {
  authkey: process.env.MSG91_AUTH_KEY || '',
  url: 'https://control.msg91.com/api/v5/flow/',
  templates: {
    ORDER_PACKED: process.env.MSG91_ORDER_PACKED_TEMPLATE_ID || '67542bf2d6fc056c345bd2b2'
  }
};

// Enhanced Instagram message sending
async function sendInstagramMessage(igId, userAccessToken, recipientId, messageText1) {
  const url = `https://graph.instagram.com/v23.0/${igId}/messages`;
  const messageTextWithEmoji = " 🤖:" + messageText1;
  const data = {
    recipient: { id: recipientId },
    message: { text: messageTextWithEmoji }
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${userAccessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('Instagram message sent successfully', response.data);
    return { success: true, message: messageTextWithEmoji };
    
  } catch (error) {
    console.error('Instagram message sending failed:', {
      error: error.response?.data || error.message,
      status: error.response?.status,
      recipientId: recipientId
    });
    
    throw new Error(`Instagram message failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// Format products for packed notification
function formatProductsForPackedSMS(products) {
  console.log('formatProductsForPackedSMS input:', JSON.stringify(products, null, 2));
  
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log('No products found, returning default');
    return { productName: 'Your items', quantity: '1' };
  }

  try {
    if (products.length === 1) {
      const product = products[0];
      let productName = product.product_name || product.name || product.title || 'Item';
      
      // ✅ Add selectedunit to product name if it exists
      if (product.selectedunit) {
        productName += ` (${product.selectedunit})`;
      }
      
      const quantity = (product.quantity || 1).toString();
      
      console.log('Single product formatted:', { productName, quantity });
      return { productName, quantity };
    } else {
      // Multiple products - show each product with its individual quantity
      const productDetails = products.map(p => {
        let name = p.product_name || p.name || p.title || 'Item';
        // ✅ Add selectedunit to each product name if it exists
        if (p.selectedunit) {
          name += ` (${p.selectedunit})`;
        }
        const qty = p.quantity || 1;
        return `${name} x${qty}`;
      });
      
      // For SMS, limit the text length
      const combinedDetails = productDetails.length > 2 
        ? `${productDetails.slice(0, 2).join(', ')} +${productDetails.length - 2} more`
        : productDetails.join(', ');
      
      // Calculate total quantity for the quantity field
      const totalQty = products.reduce((sum, p) => sum + (parseInt(p.quantity) || 1), 0);
      
      console.log('Multiple products formatted:', { productName: combinedDetails, quantity: totalQty.toString() });
      return { productName: combinedDetails, quantity: totalQty.toString() };
    }
  } catch (error) {
    console.error('Error formatting products:', error);
    return { productName: 'Your items', quantity: '1' };
  }
}


// Enhanced SMS sending for packed orders
async function sendPackedSMSFallback(phone, companyName, products) {
  try {
    console.log('=== PACKED SMS FALLBACK DEBUG START ===');
    console.log('Phone:', phone);
    console.log('Company:', companyName);
    console.log('Products input:', JSON.stringify(products, null, 2));

    if (!phone || !SMS_CONFIG.authkey) {
      throw new Error('Missing phone number or SMS configuration');
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Invalid phone number format');
    }

    // ✅ Enhanced product formatting with better error handling
    const productData = formatProductsForPackedSMS(products);
    console.log('Formatted product data:', productData);

    // ✅ Ensure company name is not empty
    const storeName = companyName && companyName.trim() ? companyName.trim() : 'Store';
    console.log('Store name:', storeName);

    // SMS variables mapping for packed template
    const smsVariables = {
      var1: storeName,                     // Company name
      var2: productData.productName,       // Product name
      var3: productData.quantity,          // Quantity
      var4: storeName                      // Company name again
    };

    console.log('=== PACKED SMS VARIABLES ===');
    console.log('var1 (company):', smsVariables.var1);
    console.log('var2 (product):', smsVariables.var2);
    console.log('var3 (quantity):', smsVariables.var3);
    console.log('var4 (company again):', smsVariables.var4);

    // Preview message
    const previewMessage = `Order Packed by ${smsVariables.var1}! Products (${smsVariables.var2}, ${smsVariables.var3}) Status Order packed and ready for dispatch ${smsVariables.var4} appreciates your business!`;
    console.log('=== PACKED SMS PREVIEW ===');
    console.log(previewMessage);

    // ✅ Build SMS payload with sender ID
    const smsPayload = {
      template_id: SMS_CONFIG.templates.ORDER_PACKED,
      short_url: "1",
      sender: SMS_CONFIG.sender, // ✅ Add DLT-approved sender ID
      recipients: [{
        mobiles: `91${cleanPhone}`,
        var1: smsVariables.var1,
        var2: smsVariables.var2,
        var3: smsVariables.var3,
        var4: smsVariables.var4
      }]
    };

    console.log('=== PACKED SMS PAYLOAD ===');
    console.log(JSON.stringify(smsPayload, null, 2));

    const response = await axios.post(SMS_CONFIG.url, smsPayload, {
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'authkey': SMS_CONFIG.authkey
      },
      timeout: 15000
    });

    console.log('Packed SMS API Response:', response.data);
    console.log('=== PACKED SMS FALLBACK DEBUG END ===');

    if (response.status === 200) {
      return { success: true, response: response.data };
    } else {
      throw new Error(`SMS API returned status: ${response.status}`);
    }

  } catch (error) {
    console.error('Packed SMS fallback failed:', error.response?.data || error.message);
    throw error;
  }
}

// Send order packed notification
async function sendOrderPackedNotification(order) {
  console.log('=== SENDING PACKED NOTIFICATION ===');
  console.log('Order ID:', order.orderId);
  console.log('Tenant ID:', order.tenentId);
  console.log('Order products:', JSON.stringify(order.products, null, 2));

  const tenentId = order.tenentId;
  const senderId = order.senderId;

  // Fetch username from Signup collection
  let username = 'Store';
  try {
    const usernamedata = await Signup.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (usernamedata && usernamedata.name) {
      username = usernamedata.name;
    }
    console.log('Company name found:', username);
  } catch (err) {
    console.warn('Failed to fetch username for packed notification:', err.message);
  }

  let notificationSent = false;
  let notificationMethod = null;
  let notificationError = null;

  // Try Instagram first
  try {
    console.log('Attempting Instagram packed notification for order:', order.orderId);

    const latestToken = await LongToken.findOne({ tenentId: tenentId })
      .sort({ createdAt: -1 })
      .limit(1);

    if (latestToken && latestToken.userAccessToken && latestToken.Instagramid) {
      const productData = formatProductsForPackedSMS(order.products);
      
      const messageText = `📦 Order Packed & Ready! 📦\n\nOrder ID: ${order.orderId}\nProducts: ${productData.productName} (Qty: ${productData.quantity})\nStatus: Packed and Ready for Dispatch\n\nGreat news! Your order has been carefully packed and is ready for shipment. Our team has prepared your items with care.\n\n🚚 Your order will be dispatched soon!\n\nThank you for choosing ${username}!`;

      await sendInstagramMessage(
        latestToken.Instagramid,
        latestToken.userAccessToken,
        senderId,
        messageText
      );

      notificationSent = true;
      notificationMethod = 'instagram';
      console.log('Instagram packed notification sent successfully');
    } else {
      throw new Error('Instagram credentials not available');
    }

  } catch (instagramError) {
    console.error('Instagram packed notification failed, trying SMS fallback:', instagramError.message);
    notificationError = instagramError.message;

    // ✅ Enhanced SMS Fallback
    try {
      let phoneNumber = order.phone_number || order.customerPhone || order.phone;

      if (!phoneNumber) {
        throw new Error('No phone number available for SMS fallback');
      }

      console.log('Attempting SMS fallback with phone:', phoneNumber);
      const smsResult = await sendPackedSMSFallback(phoneNumber, username, order.products);

      if (smsResult.success) {
        console.log('Packed SMS fallback sent successfully');
        notificationSent = true;
        notificationMethod = 'sms_fallback';
      } else {
        throw new Error('SMS API call failed');
      }

    } catch (smsError) {
      console.error('Packed SMS fallback also failed:', smsError.message);
      notificationError = `Instagram: ${instagramError.message}; SMS: ${smsError.message}`;
    }
  }

  // Update order with notification status
  try {
    await Order.findByIdAndUpdate(order._id, {
      $set: {
        packedNotificationSent: notificationSent,
        packedNotificationMethod: notificationMethod,
        packedNotificationError: notificationError,
        packedNotificationAttemptedAt: new Date()
      }
    });
  } catch (updateError) {
    console.error('Failed to update packed notification status:', updateError);
  }

  return {
    success: notificationSent,
    method: notificationMethod,
    error: notificationError
  };
}

// Route to fetch products by order number
router.post('/fetch-products/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId } = req.body;
    console.log("tenentId", tenentId);
    
    if (!orderNumber || !tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Order number and tenent ID are required'
      });
    }

    console.log(`Fetching products for order: ${orderNumber}, tenentId: ${tenentId}`);

    // Find the order by orderNumber and tenentId
    const order = await Order.findOne({ 
      orderId: orderNumber,
      tenentId: tenentId 
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Handle different order statuses
    const orderStatus = order.status;
    let statusMessage = '';
    let shouldFetchProducts = true;
    console.log("orderStatus", orderStatus);
    
    switch (orderStatus) {
      case 'CREATED':
        return res.status(200).json({
          success: false,
          showAlert: true,
          alertType: 'warning',
          alertMessage: 'Payment confirmation is pending for this order. Please wait for payment completion before proceeding.',
          shouldFetchProducts: false
        });

      case 'PROCESSING':
        statusMessage = "Order label hasn't been printed yet. Please print the shipping label before packing.";
        break;

      case 'PACKED':
        statusMessage = 'This order has already been packed and is ready for shipment.';
        break;

      case 'COMPLETED':
        statusMessage = 'You already shipped this order';
        break;

      case 'PRINTED':
        // No alert needed, just proceed
        break;

      default:
        // Handle any other status
        console.log(`Unknown order status: ${orderStatus}`);
        break;
    }

    // Extract customer notes
    const customerNote = order.customer_notes || '';

    // Update the packing status to IN_PROGRESS if it's currently PENDING
    if (order.packing_status === 'PENDING') {
      await Order.updateOne(
        { _id: order._id },
        { 
          packing_status: 'IN_PROGRESS',
          is_packed: false
        }
      );
    }

    console.log("All order products:", JSON.stringify(order.products, null, 2));

    // ✅ Enhanced product processing with unit-specific SKU support
    const productsWithDetails = await Promise.all(
      order.products.map(async (orderProduct) => {
        try {
          console.log("Processing orderProduct:", JSON.stringify(orderProduct, null, 2));
          
          const productDetail = await ProductDetail.findOne({
            tenentId: tenentId,
            productName: orderProduct.product_name
          }).lean();

          let finalSku = orderProduct.sku || 'unknown';
          let finalImage = '';

          if (productDetail) {
            // Check if product has unit-specific selection
            if (orderProduct.selectedunit && productDetail.units && productDetail.units.length > 0) {
              console.log(`Product ${orderProduct.product_name} has selected unit: ${orderProduct.selectedunit}`);
              
              // Find the matching unit
              const matchingUnit = productDetail.units.find(unit => 
                unit.unit === orderProduct.selectedunit || 
                unit.unit.toLowerCase() === orderProduct.selectedunit.toLowerCase()
              );
              
              if (matchingUnit) {
                finalSku = matchingUnit.sku;
                finalImage = matchingUnit.imageUrl || productDetail.productPhotoUrl || productDetail.productPhoto || '';
                console.log(`Using unit-specific SKU: ${finalSku} for unit: ${orderProduct.selectedunit}`);
              } else {
                console.warn(`Unit ${orderProduct.selectedunit} not found in product units, using default SKU`);
                finalSku = productDetail.sku || orderProduct.sku || 'unknown';
                finalImage = productDetail.productPhotoUrl || productDetail.productPhoto || '';
              }
            } else {
              // Use main product SKU and image
              finalSku = productDetail.sku || orderProduct.sku || 'unknown';
              finalImage = productDetail.productPhotoUrl || productDetail.productPhoto || '';
            }
          }

          console.log(`Final SKU for ${orderProduct.product_name}: ${finalSku}`);
          
          return {
            name: orderProduct.product_name,
            sku: finalSku,
            quantity: orderProduct.quantity,
            selectedunit: orderProduct.selectedunit || null,
            image: finalImage
          };
        } catch (err) {
          console.error(`Error fetching product details for product: ${orderProduct.product_name}`, err);
          return {
            name: orderProduct.product_name,
            sku: orderProduct.sku || 'unknown',
            quantity: orderProduct.quantity,
            selectedunit: orderProduct.selectedunit || null,
            image: ''
          };
        }
      })
    );

    console.log('Products being sent to frontend:', JSON.stringify(productsWithDetails, null, 2));

    res.status(200).json({
      success: true,
      products: productsWithDetails,
      customerNote,
      orderStatus: order.status,
      packingStatus: order.packing_status,
      isPacked: order.is_packed || false,
      showAlert: statusMessage ? true : false,
      alertType: statusMessage ? 'warning' : null,
      alertMessage: statusMessage || null,
      shouldFetchProducts: true
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
      error: error.message
    });
  }
});

router.post('/verify-sku/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId, skuInputs } = req.body;

    if (!orderNumber || !tenentId || !skuInputs) {
      return res.status(400).json({
        success: false,
        message: 'Order number, tenent ID, and SKU inputs are required'
      });
    }

    console.log(`Verifying SKUs for order: ${orderNumber}, tenentId: ${tenentId}`);
    
    // Parse skuInputs if it's a string
    let parsedSkuInputs = skuInputs;
    if (typeof skuInputs === 'string') {
      try {
        parsedSkuInputs = JSON.parse(skuInputs);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid SKU inputs format'
        });
      }
    }
    
    if (!Array.isArray(parsedSkuInputs)) {
      return res.status(400).json({
        success: false,
        message: 'SKU inputs must be an array'
      });
    }
    
    console.log('SKU inputs:', parsedSkuInputs);

    // Find the order
    const order = await Order.findOne({ 
      orderId: orderNumber, 
      tenentId: tenentId
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log("Order products for verification:", JSON.stringify(order.products, null, 2));
    console.log("Current order status:", order.status);

    // ✅ Enhanced SKU generation using helper function
    const orderSkus = [];
    
    for (const orderProduct of order.products) {
      // Use helper function to get correct SKU
      const productSku = await getProductSku(orderProduct, tenentId);
      
      console.log(`Product ${orderProduct.product_name} final SKU: ${productSku}, quantity: ${orderProduct.quantity}`);
      
      // Add the SKU for each quantity
      for (let i = 0; i < orderProduct.quantity; i++) {
        orderSkus.push(productSku);
      }
    }

    console.log("Generated orderSkus with unit-specific support:", orderSkus);

    // Sort both arrays for comparison
    const sortedOrderSkus = [...orderSkus].sort();
    const sortedInputSkus = [...parsedSkuInputs].sort();

    console.log("Comparing SKUs:", {
      sortedOrderSkus,
      sortedInputSkus
    });

    // Check if all products have been verified
    const allProductsVerified = 
      sortedOrderSkus.length === sortedInputSkus.length && 
      sortedOrderSkus.every((sku, index) => sku === sortedInputSkus[index]);

    if (!allProductsVerified) {
      // Provide detailed mismatch information
      const missing = sortedOrderSkus.filter(sku => !sortedInputSkus.includes(sku));
      const extra = sortedInputSkus.filter(sku => !sortedOrderSkus.includes(sku));
      
      console.log("SKU verification failed:", { missing, extra });
      
      return res.status(400).json({
        success: false,
        message: 'Not all products have been verified correctly',
        details: {
          expectedSkus: sortedOrderSkus,
          receivedSkus: sortedInputSkus,
          missingSkus: missing,
          extraSkus: extra
        }
      });
    }

    // ✅ Prepare update object - preserve COMPLETED status if it exists
    let updateObj = { 
      packing_status: 'COMPLETED',
      is_packed: true,
      updated_at: new Date()
    };

    // Only update status to PACKED if current status is not COMPLETED
    if (order.status !== 'COMPLETED') {
      updateObj.status = 'PACKED';
      console.log('Status will be updated to PACKED');
    } else {
      console.log('Status is COMPLETED - will not be changed');
    }

    console.log('Update object:', updateObj);

    // Update order status
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id },
      updateObj,
      { new: true } // Return the updated document
    );

    // ✅ Only send packed notification if status was actually changed to PACKED
    let notificationSent = false;
    if (order.status !== 'COMPLETED' && updateObj.status === 'PACKED') {
      try {
        const notificationResult = await sendOrderPackedNotification(updatedOrder);
        console.log('Packed notification result:', notificationResult);
        notificationSent = true;
      } catch (notificationError) {
        console.error('Failed to send packed notification:', notificationError);
        // Don't fail the main request if notification fails
      }
    } else {
      console.log('Notification not sent - order status was already COMPLETED');
    }

    // ✅ Different response message based on whether status was changed
    const responseMessage = order.status === 'COMPLETED' 
      ? 'All products verified successfully (order already shipped - status preserved)'
      : 'All products verified successfully and packed notification sent';

    res.status(200).json({
      success: true,
      message: responseMessage,
      statusChanged: order.status !== 'COMPLETED',
      notificationSent: notificationSent,
      verifiedSkus: sortedOrderSkus
    });
  } catch (error) {
    console.error('Error verifying SKUs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify SKUs',
      error: error.message
    });
  }
});

async function getProductSku(orderProduct, tenentId) {
  try {
    let finalSku = orderProduct.sku || 'unknown';
    
    // Check if product has unit-specific selection
    if (orderProduct.selectedunit) {
      const productDetail = await ProductDetail.findOne({
        tenentId: tenentId,
        productName: orderProduct.product_name
      }).lean();
      
      if (productDetail && productDetail.units && productDetail.units.length > 0) {
        const matchingUnit = productDetail.units.find(unit => 
          unit.unit === orderProduct.selectedunit || 
          unit.unit.toLowerCase() === orderProduct.selectedunit.toLowerCase()
        );
        
        if (matchingUnit) {
          finalSku = matchingUnit.sku;
          console.log(`Using unit-specific SKU: ${finalSku} for unit: ${orderProduct.selectedunit}`);
        } else {
          console.warn(`Unit ${orderProduct.selectedunit} not found, using default SKU`);
          finalSku = productDetail.sku || orderProduct.sku || 'unknown';
        }
      }
    } else if (orderProduct.sku) {
      // Use the SKU from the order product
      finalSku = orderProduct.sku;
    } else {
      // Fallback to main product SKU
      const productDetail = await ProductDetail.findOne({
        tenentId: tenentId,
        productName: orderProduct.product_name
      }).lean();
      
      if (productDetail && productDetail.sku) {
        finalSku = productDetail.sku;
      }
    }
    
    return finalSku;
  } catch (error) {
    console.error(`Error getting SKU for product ${orderProduct.product_name}:`, error);
    return orderProduct.sku || 'unknown';
  }
}
// Route to get all orders that need packing
router.get('/pending-packing/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    
    if (!tenentId) {
      return res.status(400).json({
        success: false,
        message: 'Tenent ID is required'
      });
    }

    const pendingOrders = await Order.find({
      tenentId: tenentId,
      $or: [
        { 
          status: { $in: ['paid', 'processing', 'PAID', 'PROCESSING'] },
          $or: [{ is_packed: false }, { is_packed: { $exists: false } }]
        },
        {
          status: 'PACKED',
          is_packed: false
        }
      ],
      packing_status: { $in: ['PENDING', 'IN_PROGRESS'] }
    })
    .sort({ created_at: 1 })
    .select('orderId status packing_status created_at customer_name is_packed')
    .lean();

    res.status(200).json({
      success: true,
      orders: pendingOrders
    });
  } catch (error) {
    console.error('Error fetching pending packing orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending packing orders',
      error: error.message
    });
  }
});

// ✅ UPDATED: Route to update packing status manually with notification
router.post('/update-packing-status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId, status } = req.body;

    if (!orderNumber || !tenentId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Order number, tenent ID, and status are required'
      });
    }

    if (!['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid packing status'
      });
    }

    const is_packed = status === 'COMPLETED' ? true : false;
    const orderStatus = status === 'COMPLETED' ? 'PACKED' : undefined;
    
    const updateObj = { 
      packing_status: status,
      is_packed: is_packed,
      updated_at: new Date()
    };
    
    if (orderStatus) {
      updateObj.status = orderStatus;
    }

    // Update and get the updated order
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderNumber, tenentId: tenentId },
      updateObj,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // ✅ Send packed notification if status is COMPLETED
    if (status === 'COMPLETED') {
      try {
        const notificationResult = await sendOrderPackedNotification(updatedOrder);
        console.log('Packed notification result:', notificationResult);
      } catch (notificationError) {
        console.error('Failed to send packed notification:', notificationError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Packing status updated to ${status} and is_packed set to ${is_packed}${status === 'COMPLETED' ? ' with notification sent' : ''}`
    });
  } catch (error) {
    console.error('Error updating packing status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update packing status',
      error: error.message
    });
  }
});

// ✅ UPDATED: Route to directly set the is_packed flag with notification
router.post('/set-packed/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId, isPacked } = req.body;

    if (!orderNumber || !tenentId || isPacked === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Order number, tenent ID, and isPacked value are required'
      });
    }

    const isPacked_bool = typeof isPacked === 'string' ? 
      isPacked.toLowerCase() === 'true' : Boolean(isPacked);
    
    const packingStatus = isPacked_bool ? 'COMPLETED' : 'IN_PROGRESS';
    const orderStatus = isPacked_bool ? 'PACKED' : undefined;
    
    const updateObj = { 
      is_packed: isPacked_bool,
      packing_status: packingStatus,
      updated_at: new Date()
    };
    
    if (orderStatus) {
      updateObj.status = orderStatus;
    }

    // Update and get the updated order
    const updatedOrder = await Order.findOneAndUpdate(
      { orderId: orderNumber, tenentId: tenentId },
      updateObj,
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // ✅ Send packed notification if isPacked is true
    if (isPacked_bool) {
      try {
        const notificationResult = await sendOrderPackedNotification(updatedOrder);
        console.log('Packed notification result:', notificationResult);
      } catch (notificationError) {
        console.error('Failed to send packed notification:', notificationError);
      }
    }

    res.status(200).json({
      success: true,
      message: `Order ${orderNumber} is_packed status set to ${isPacked_bool}${isPacked_bool ? ' with notification sent' : ''}`
    });
  } catch (error) {
    console.error('Error setting packed status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set packed status',
      error: error.message
    });
  }
});

module.exports = router;

