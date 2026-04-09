const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Helper function to format date
const formatDate = (date) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

// Helper function to validate tenant ID
const validateTenantId = (tenentId) => {
  if (!tenentId || typeof tenentId !== 'string') {
    return false;
  }
  return true;
};

// Simplified helper function to format order for frontend
const formatOrderForFrontend = (order) => {
  console.log('=== FORMATTING ORDER ===');
  console.log('Raw orderId:', order.orderId);
  console.log('Raw customer_name:', order.customer_name);
  console.log('Raw name:', order.name);
  console.log('Raw username:', order.username);
  console.log('Raw total_amount:', order.total_amount);
  console.log('Raw created_at:', order.created_at);

  // Simple direct mapping without complex transformations
  const safeGet = (val, def = '') => {
    if (val === null || val === undefined) return def;
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object' && val !== null) {
      // Convert to string if it's an object
      return val.toString() || def;
    }
    return def;
  };

  const safeGetNumber = (val, def = 0) => {
    if (val === null || val === undefined) return def;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? def : num;
    }
    return def;
  };

  const formatted = {
    id: order.orderId || order._id?.toString() || '',
    date: formatDate(order.created_at),
    name: order.name || 'N/A',
    customer_name: order.customer_name || 'N/A',
    username: order.username || 'N/A', // Added username field
    phoneNumber: order.phone_number || 'N/A',
    totalAmount: safeGetNumber(order.total_amount, 0),
    status: (order.status || 'CREATED').toString().toUpperCase(),
    billNo: order.bill_no || '',
    paymentStatus: order.paymentStatus || '',
    paymentMethod: order.paymentMethod || '',

    products: Array.isArray(order.products)
      ? order.products.map(product => {
          const baseProduct = {
            sku: product.sku || '',
            product_name: product.product_name || '',
            quantity: safeGetNumber(product.quantity, 1),
            price: safeGetNumber(product.price, 0),
          };
          
          // Add selectedunit if it exists and append to product name
          if (product.selectedunit && product.selectedunit.trim()) {
            baseProduct.selectedunit = product.selectedunit.trim();
            baseProduct.product_name = `${baseProduct.product_name} (${baseProduct.selectedunit})`;
          }
          
          return baseProduct;
        })
      : [],

    address: order.address || '',
    city: order.city || '',
    state: order.state || '',
    zipCode: order.zip_code || order.zipCode || '',
    pincode: order.pincode || order.pin_code || '',
    country: order.country || '',
    fullAddress: order.full_address || '',
    landmark: order.landmark || '',
    trackingNumber: order.tracking_number || '',
    trackingStatus: order.tracking_status || '',
    packingStatus: order.packing_status || '',
    isPacked: Boolean(order.is_packed),
    razorpayOrderId: order.razorpayOrderId || '',
    razorpayPaymentId: order.razorpayPaymentId || '',
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    customerNotes: order.customer_notes || '',
  };

  console.log('Formatted result:', JSON.stringify(formatted, null, 2));
  console.log('========================');
  
  return formatted;
};

// Helper function to build search query
const buildSearchQuery = (tenentId, search, status, startDate, endDate) => {
  let query = { tenentId };
  
  // Add status filter - exact match, case-insensitive
  if (status && status.trim()) {
    const statusTrim = status.trim();
    query.status = { $regex: new RegExp(`^${statusTrim}$`, 'i') };
  }
  
  // Add date range filter
  if (startDate || endDate) {
    query.created_at = {};
    if (startDate) {
      query.created_at.$gte = new Date(startDate);
    }
    if (endDate) {
      query.created_at.$lte = new Date(endDate + 'T23:59:59.999Z');
    }
  }
  
  // Add search functionality with enhanced fields including name and username
  if (search && search.trim()) {
    const searchTerm = search.trim();
    query.$or = [
      { orderId: { $regex: searchTerm, $options: 'i' } },
      { customer_name: { $regex: searchTerm, $options: 'i' } },
      { profile_name: { $regex: searchTerm, $options: 'i' } },
      { name: { $regex: searchTerm, $options: 'i' } }, // Added name field
      { username: { $regex: searchTerm, $options: 'i' } }, // Added username field
      { phone_number: { $regex: searchTerm, $options: 'i' } },
      { bill_no: { $regex: searchTerm, $options: 'i' } },
      { address: { $regex: searchTerm, $options: 'i' } },
      { full_address: { $regex: searchTerm, $options: 'i' } },
      { city: { $regex: searchTerm, $options: 'i' } },
      { state: { $regex: searchTerm, $options: 'i' } },
      { country: { $regex: searchTerm, $options: 'i' } },
      { landmark: { $regex: searchTerm, $options: 'i' } },
      { zip_code: { $regex: searchTerm, $options: 'i' } },
      { pincode: { $regex: searchTerm, $options: 'i' } },
      { pin_code: { $regex: searchTerm, $options: 'i' } }
    ];
    
    // If search term is a number, also search by total amount and postal codes
    if (!isNaN(searchTerm) && searchTerm !== '') {
      query.$or.push(
        { total_amount: parseFloat(searchTerm) },
        { zip_code: searchTerm },
        { pincode: searchTerm },
        { pin_code: searchTerm }
      );
    }
  }
  
  return query;
};

// Route to fetch all orders with pagination and filtering
router.post('/fetch-orders', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      tenentId,
      startDate = '',
      endDate = ''
    } = req.body;

    // Validate required fields
    if (!validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tenant ID is required'
      });
    }

    // Validate and sanitize pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);

    console.log(`\n=== FETCH ORDERS REQUEST ===`);
    console.log(`TenantId: ${tenentId}`);
    console.log(`Page: ${pageNum} (requested: ${page})`);
    console.log(`Limit: ${limitNum} (requested: ${limit})`);
    console.log(`Status Filter: "${status}"`);
    console.log(`Search Term: "${search}"`);

    // Build query object
    const query = buildSearchQuery(tenentId, search, status, startDate, endDate);
    
    console.log(`MongoDB Query:`, JSON.stringify(query, null, 2));

    // Calculate pagination
    const skip = (pageNum - 1) * limitNum;
    console.log(`Skip: ${skip} records`);
    
    // Execute queries in parallel for better performance
    // Use .lean() to get plain JavaScript objects instead of Mongoose documents
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(), // This is crucial for avoiding MongoDB BSON objects
      Order.countDocuments(query)
    ]);
    
    console.log(`\n=== QUERY RESULTS ===`);
    console.log(`Total orders matching query: ${totalOrders}`);
    console.log(`Orders returned for page ${pageNum}: ${orders.length}`);

    // Format orders for frontend
    const formattedOrders = orders.map(formatOrderForFrontend);

    console.log('First formatted order final:', JSON.stringify(formattedOrders[0], null, 2));

    // Calculate pagination info
    const totalPages = Math.ceil(totalOrders / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    console.log(`\n=== PAGINATION INFO ===`);
    console.log(`Total Pages: ${totalPages}`);
    console.log(`Current Page: ${pageNum}`);
    console.log(`Has Next Page: ${hasNextPage}`);
    console.log(`Has Previous Page: ${hasPrevPage}`);
    console.log(`=========================\n`);

    // Ensure all response data is clean
    const response = {
      success: true,
      data: formattedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages: parseInt(totalPages),
        totalOrders: parseInt(totalOrders),
        hasNextPage: Boolean(hasNextPage),
        hasPrevPage: Boolean(hasPrevPage),
        itemsPerPage: parseInt(limitNum),
        startIndex: parseInt(skip + 1),
        endIndex: parseInt(Math.min(skip + limitNum, totalOrders))
      }
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Route to fetch all orders within a specific date range (no pagination)
router.post('/fetch-orders-by-date', async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      tenentId
    } = req.body;

    // Validate required fields
    if (!validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tenant ID is required'
      });
    }

    // Validate date parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'Both fromDate and toDate are required'
      });
    }

    // Validate date format and convert to Date objects
    let startDate, endDate;
    try {
      startDate = new Date(fromDate);
      endDate = new Date(toDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Ensure fromDate is not after toDate
      if (startDate > endDate) {
        return res.status(400).json({
          success: false,
          message: 'fromDate cannot be after toDate'
        });
      }
      
      // Set end date to end of day (23:59:59.999)
      endDate.setHours(23, 59, 59, 999);
      
    } catch (dateError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please use YYYY-MM-DD format'
      });
    }

    console.log(`\n=== FETCH ALL ORDERS BY DATE RANGE REQUEST ===`);
    console.log(`TenantId: ${tenentId}`);
    console.log(`From Date: ${fromDate} (${startDate.toISOString()})`);
    console.log(`To Date: ${toDate} (${endDate.toISOString()})`);

    // Build base query with date range
    let query = { 
      tenentId,
      created_at: {
        $gte: startDate,
        $lte: endDate
      }
    };

    console.log(`MongoDB Query:`, JSON.stringify(query, null, 2));

    // Fetch all orders without pagination, select only required fields
    const orders = await Order.find(query, {
      orderId: 1,
      tenentId: 1,
      total_amount: 1,
      _id: 0  // Exclude MongoDB _id field
    })
    .sort({ created_at: -1 })
    .lean();

    console.log(`\n=== QUERY RESULTS ===`);
    console.log(`Total orders in date range: ${orders.length}`);

    // Format orders to ensure clean response
    const formattedOrders = orders.map(order => ({
      orderId: order.orderId || '',
      tenentId: order.tenentId || '',
      total_amount: typeof order.total_amount === 'number' ? order.total_amount : parseFloat(order.total_amount) || 0
    }));

    if (formattedOrders.length > 0) {
      console.log('Sample formatted order:', JSON.stringify(formattedOrders[0], null, 2));
    }

    // Calculate date range statistics
    const dateRangeStats = {
      fromDate: fromDate,
      toDate: toDate,
      daysInRange: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
      totalOrdersInRange: orders.length,
      averageOrdersPerDay: orders.length > 0 ? (orders.length / Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))).toFixed(2) : 0,
      totalRevenue: formattedOrders.reduce((sum, order) => sum + order.total_amount, 0)
    };

    console.log(`Date Range Stats:`, JSON.stringify(dateRangeStats, null, 2));
    console.log(`=========================\n`);

    // Build response
    const response = {
      success: true,
      data: formattedOrders,
      dateRange: dateRangeStats,
      filters: {
        fromDate: fromDate,
        toDate: toDate
      },
      count: orders.length
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders by date range',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Route to update order status
router.post('/update-status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId, status } = req.body;
    
    // Validate required fields
    if (!orderNumber || !validateTenantId(tenentId) || !status || !status.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Order number, tenant ID, and status are required'
      });
    }

    const sanitizedStatus = status.trim().toUpperCase();
    console.log(`\n=== UPDATE ORDER STATUS ===`);
    console.log(`Order Number: ${orderNumber}`);
    console.log(`Tenant ID: ${tenentId}`);
    console.log(`New Status: ${sanitizedStatus}`);
    
    // Try to update by orderId first
    let result = await Order.updateOne(
      { 
        orderId: orderNumber,
        tenentId: tenentId 
      },
      { 
        status: sanitizedStatus,
        updated_at: new Date()
      }
    );
    
    console.log(`Update by orderId - Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    
    // If no match found by orderId, try by MongoDB _id
    if (result.matchedCount === 0 && mongoose.Types.ObjectId.isValid(orderNumber)) {
      console.log(`Trying update by MongoDB _id...`);
      result = await Order.updateOne(
        {
          _id: orderNumber,
          tenentId: tenentId
        },
        { 
          status: sanitizedStatus,
          updated_at: new Date()
        }
      );
      console.log(`Update by _id - Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    }
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    console.log(`Successfully updated order ${orderNumber} to status ${sanitizedStatus}`);
    console.log(`========================\n`);
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      updatedCount: parseInt(result.modifiedCount),
      newStatus: sanitizedStatus
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Route to fetch single order by ID
router.post('/fetch-order/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { tenentId } = req.body;
    
    if (!orderNumber || !validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Order number and valid tenant ID are required'
      });
    }

    console.log(`Fetching single order: ${orderNumber}, tenentId: ${tenentId}`);
    
    let order = null;
    
    order = await Order.findOne({ 
      orderId: orderNumber,
      tenentId: tenentId 
    }).lean();
    
    if (!order && mongoose.Types.ObjectId.isValid(orderNumber)) {
      order = await Order.findOne({
        _id: orderNumber,
        tenentId: tenentId
      }).lean();
    }
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    const formattedOrder = formatOrderForFrontend(order);
    
    res.status(200).json({
      success: true,
      data: formattedOrder
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
 
 // Route to get order statistics
 router.post('/fetch-stats', async (req, res) => {
  try {
    const { tenentId } = req.body;
    
    if (!validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tenant ID is required'
      });
    }
    
    console.log(`Fetching order stats for tenentId: ${tenentId}`);
    
    const stats = await Order.aggregate([
      { $match: { tenentId: tenentId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$total_amount', 0] } },
          completedOrders: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: '$status' }, ['COMPLETED', 'DELIVERED']] },
                1,
                0
              ]
            }
          },
          pendingOrders: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: '$status' }, ['PENDING', 'CREATED']] },
                1,
                0
              ]
            }
          },
          processingOrders: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: '$status' }, ['PROCESSING', 'PAID']] },
                1,
                0
              ]
            }
          },
          shippedOrders: {
            $sum: {
              $cond: [
                { $eq: [{ $toUpper: '$status' }, 'SHIPPED'] },
                1,
                0
              ]
            }
          },
          cancelledOrders: {
            $sum: {
              $cond: [
                { $in: [{ $toUpper: '$status' }, ['CANCELLED', 'FAILED']] },
                1,
                0
              ]
            }
          },
          packedOrders: {
            $sum: {
              $cond: [
                { $eq: ['$is_packed', true] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      completedOrders: 0,
      pendingOrders: 0,
      processingOrders: 0,
      shippedOrders: 0,
      cancelledOrders: 0,
      packedOrders: 0
    };
    
    res.status(200).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });
 
 // Route to get orders by status with pagination
 router.post('/fetch-by-status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const { tenentId, limit = 50, page = 1 } = req.body;
    
    if (!status || !validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Status and valid tenant ID are required'
      });
    }
 
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
    const skip = (pageNum - 1) * limitNum;
 
    console.log(`Fetching orders with status: ${status}, tenentId: ${tenentId}`);
 
    const query = {
      tenentId: tenentId,
      status: { $regex: new RegExp(`^${status.trim()}$`, 'i') }
    };
 
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);
 
    const formattedOrders = orders.map(formatOrderForFrontend);
 
    res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: pageNum < Math.ceil(totalOrders / limitNum),
        hasPrevPage: pageNum > 1
      },
      count: orders.length
    });
    
  } catch (error) {
    console.error('Error fetching orders by status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders by status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });
 
 // Route to get pending orders
 router.get('/pending-orders/:tenentId', async (req, res) => {
  try {
    const { tenentId } = req.params;
    const { limit = 50 } = req.query;
    
    if (!validateTenantId(tenentId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid tenant ID is required'
      });
    }
 
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 50), 100);
 
    const pendingOrders = await Order.find({
      tenentId: tenentId,
      $or: [
        { 
          status: { $regex: /^(paid|processing)$/i },
          $or: [{ is_packed: false }, { is_packed: { $exists: false } }]
        },
        {
          status: { $regex: /^(pending|created)$/i }
        }
      ]
    })
    .sort({ created_at: 1 })
    .limit(limitNum)
    .lean();
 
    const formattedOrders = pendingOrders.map(formatOrderForFrontend);
 
    res.status(200).json({
      success: true,
      orders: formattedOrders,
      count: pendingOrders.length
    });
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });
 
 // Route to bulk update order statuses
 router.post('/bulk-update-status', async (req, res) => {
  try {
    const { tenentId, orderIds, status } = req.body;
 
    if (!validateTenantId(tenentId) || 
        !orderIds || 
        !Array.isArray(orderIds) || 
        orderIds.length === 0 || 
        !status || 
        !status.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID, order IDs array, and status are required'
      });
    }
 
    if (orderIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 orders can be updated at once'
      });
    }
 
    const sanitizedStatus = status.trim().toUpperCase();
 
    const result = await Order.updateMany(
      { 
        orderId: { $in: orderIds },
        tenentId: tenentId 
      },
      { 
        status: sanitizedStatus,
        updated_at: new Date()
      }
    );
 
    res.status(200).json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} orders to ${sanitizedStatus}`,
      updatedCount: result.modifiedCount,
      requestedCount: orderIds.length
    });
    
  } catch (error) {
    console.error('Error bulk updating order statuses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk update order statuses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });
 
 // Consolidated search route
 router.post('/search', async (req, res) => {
  try {
    const { tenentId, searchTerm, limit = 20, page = 1 } = req.body;
    
    if (!validateTenantId(tenentId) || !searchTerm || !searchTerm.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID and search term are required'
      });
    }
 
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 20), 100);
    const skip = (pageNum - 1) * limitNum;
 
    const query = buildSearchQuery(tenentId, searchTerm, '', '', '');
 
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);
 
    const formattedOrders = orders.map(formatOrderForFrontend);
 
    res.status(200).json({
      success: true,
      data: formattedOrders,
      searchTerm: searchTerm.trim(),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalOrders / limitNum),
        totalOrders,
        hasNextPage: pageNum < Math.ceil(totalOrders / limitNum),
        hasPrevPage: pageNum > 1
      },
      count: orders.length
    });
    
  } catch (error) {
    console.error('Error searching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search orders',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
 });
 
 module.exports = router;
