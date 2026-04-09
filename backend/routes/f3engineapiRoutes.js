const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Signup = require('../models/Signup'); // Using existing Signup model
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const axios = require('axios');
const crypto = require('crypto');

// Constants
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100
};

const ORDER_STATUS = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  PACKED: 'PACKED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED'
};

const WEBHOOK_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_PACKED: 'order.packed',
  ORDER_SHIPPED: 'order.shipped',
  ORDER_DELIVERED: 'order.delivered',
  ORDER_CANCELLED: 'order.cancelled'
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Safely format date to ISO string
 */
const formatDate = (date) => {
  if (!date) return null;
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch (error) {
    console.error('Date formatting error:', error);
    return null;
  }
};

/**
 * Safely get string value
 */
const safeString = (val, defaultVal = '') => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  return defaultVal;
};

/**
 * Safely get number value
 */
const safeNumber = (val, defaultVal = 0) => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    const num = parseFloat(val);
    return isNaN(num) ? defaultVal : num;
  }
  return defaultVal;
};

/**
 * Format order for API response
 */
const formatOrderResponse = (order) => {
  return {
    id: order._id.toString(),
    orderId: safeString(order.orderId),
    billNo: safeString(order.bill_no),
    
    // Customer Information
    customer: {
      name: safeString(order.customer_name || order.name, 'N/A'),
      username: safeString(order.username, 'N/A'),
      phone: safeString(order.phone_number, 'N/A'),
      email: safeString(order.email)
    },
    
    // Order Details
    status: safeString(order.status, 'CREATED').toUpperCase(),
    totalAmount: safeNumber(order.total_amount),
    
    // Payment Information
    payment: {
      status: safeString(order.paymentStatus),
      method: safeString(order.paymentMethod),
      razorpayOrderId: safeString(order.razorpayOrderId),
      razorpayPaymentId: safeString(order.razorpayPaymentId)
    },
    
    // Products
    items: Array.isArray(order.products) 
      ? order.products.map(product => ({
          sku: safeString(product.sku),
          name: safeString(product.product_name),
          quantity: safeNumber(product.quantity, 1),
          price: safeNumber(product.price),
          unit: safeString(product.selectedunit),
          displayName: product.selectedunit 
            ? `${product.product_name} (${product.selectedunit})`
            : product.product_name
        }))
      : [],
    
    // Shipping Address
    shippingAddress: {
      street: safeString(order.address),
      city: safeString(order.city),
      state: safeString(order.state),
      country: safeString(order.country),
      zipCode: safeString(order.zip_code || order.zipCode || order.pincode || order.pin_code),
      landmark: safeString(order.landmark),
      fullAddress: safeString(order.full_address)
    },
    
    // Tracking & Packing
    tracking: {
      number: safeString(order.tracking_number),
      status: safeString(order.tracking_status)
    },
    
    packing: {
      status: safeString(order.packing_status),
      isPacked: Boolean(order.is_packed)
    },
    
    // Notes
    customerNotes: safeString(order.customer_notes),
    
    // Timestamps
    createdAt: order.created_at || order.createdAt,
    updatedAt: order.updated_at || order.updatedAt
  };
};

/**
 * Build MongoDB query from filters
 */
const buildOrderQuery = (tenentId, filters = {}) => {
  const query = { tenentId };
  
  // Status filter (exact match, case-insensitive)
  if (filters.status && filters.status.trim()) {
    query.status = new RegExp(`^${filters.status.trim()}$`, 'i');
  }
  
  // Date range filter
  if (filters.startDate || filters.endDate) {
    query.created_at = {};
    if (filters.startDate) {
      query.created_at.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.created_at.$lte = endDate;
    }
  }
  
  // Search across multiple fields
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim();
    const searchRegex = new RegExp(searchTerm, 'i');
    
    query.$or = [
      { orderId: searchRegex },
      { bill_no: searchRegex },
      { customer_name: searchRegex },
      { name: searchRegex },
      { username: searchRegex },
      { phone_number: searchRegex },
      { email: searchRegex },
      { address: searchRegex },
      { full_address: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
      { country: searchRegex },
      { landmark: searchRegex },
      { zip_code: searchRegex },
      { zipCode: searchRegex },
      { pincode: searchRegex },
      { pin_code: searchRegex }
    ];
    
    // If search is numeric, also search by amount and postal codes
    if (!isNaN(searchTerm) && searchTerm !== '') {
      const numericSearch = parseFloat(searchTerm);
      query.$or.push(
        { total_amount: numericSearch },
        { zip_code: searchTerm },
        { zipCode: searchTerm },
        { pincode: searchTerm },
        { pin_code: searchTerm }
      );
    }
  }
  
  return query;
};

/**
 * Get pagination parameters
 */
const getPaginationParams = (page, limit) => {
  const pageNum = Math.max(1, parseInt(page) || PAGINATION.DEFAULT_PAGE);
  const limitNum = Math.min(
    PAGINATION.MAX_LIMIT, 
    parseInt(limit) || PAGINATION.DEFAULT_LIMIT
  );
  return { page: pageNum, limit: limitNum };
};

/**
 * Calculate pagination metadata
 */
const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;
  
  return {
    page,
    limit,
    total,
    pages: totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    startIndex: total > 0 ? skip + 1 : 0,
    endIndex: Math.min(skip + limit, total)
  };
};

// ==========================================
// WEBHOOK & NOTIFICATION FUNCTIONS
// ==========================================

/**
 * Generate webhook signature for security
 */
const generateWebhookSignature = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

/**
 * Send webhook notification to external endpoint
 */
const sendWebhook = async (tenant, event, data) => {
  if (!tenant.webhookUrl) {
    console.log(`[Webhook] No webhook URL configured for tenant ${tenant.tenentId}`);
    return { success: false, reason: 'No webhook URL' };
  }

  const payload = {
    event,
    tenentId: tenant.tenentId,
    timestamp: new Date().toISOString(),
    data
  };

  // Use tenentId as secret if webhookSecret doesn't exist
  const secret = tenant.webhookSecret || tenant.tenentId;
  const signature = generateWebhookSignature(payload, secret);

  try {
    console.log(`[Webhook] Sending ${event} to ${tenant.webhookUrl}`);
    
    const response = await axios.post(tenant.webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Tenent-ID': tenant.tenentId,
        'User-Agent': 'Billzy-Webhook/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log(`[Webhook] ${event} sent successfully. Status: ${response.status}`);
    
    return { 
      success: true, 
      status: response.status,
      responseData: response.data 
    };
    
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    console.error(`[Webhook] Failed to send ${event}:`, errorMessage);
    
    return { 
      success: false, 
      error: errorMessage,
      status: error.response?.status 
    };
  }
};

/**
 * Send WhatsApp notification via GoWhats-style integration
 */
const sendWhatsAppNotification = async (tenant, order, notificationType) => {
  // Check if WhatsApp integration is enabled
  if (!tenant.whatsappConfig || !tenant.whatsappConfig.enabled) {
    console.log(`[WhatsApp] Integration disabled for tenant ${tenant.tenentId}`);
    return { success: false, reason: 'WhatsApp integration disabled' };
  }

  const { phoneNumberId, accessToken, templates } = tenant.whatsappConfig;

  if (!phoneNumberId || !accessToken) {
    console.log(`[WhatsApp] Missing credentials for tenant ${tenant.tenentId}`);
    return { success: false, reason: 'Missing WhatsApp credentials' };
  }

  // Get template for notification type
  const template = templates?.[notificationType];
  if (!template || !template.enabled) {
    console.log(`[WhatsApp] Template ${notificationType} not configured or disabled`);
    return { success: false, reason: 'Template not configured' };
  }

  // Format phone number
  const customerPhone = order.phone_number || order.customer?.phone;
  if (!customerPhone) {
    console.log(`[WhatsApp] No phone number for order ${order.orderId}`);
    return { success: false, reason: 'No phone number' };
  }

  let formattedPhone = customerPhone.replace(/[^\d]/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = formattedPhone.substring(1);
  }
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // India country code
  }

  // Build WhatsApp payload
  const API_VERSION = 'v19.0';
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "template",
    template: {
      name: template.templateName,
      language: { code: template.language || 'en' },
      components: buildTemplateComponents(order, notificationType)
    }
  };

  try {
    console.log(`[WhatsApp] Sending ${notificationType} notification to ${formattedPhone.substring(0, 4)}****`);
    
    const response = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      }
    );

    console.log(`[WhatsApp] Notification sent successfully`);
    
    return { 
      success: true, 
      messageId: response.data.messages?.[0]?.id 
    };
    
  } catch (error) {
    const errorMessage = error.response?.data?.error?.message || error.message;
    console.error(`[WhatsApp] Failed to send notification:`, errorMessage);
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
};

/**
 * Build WhatsApp template components based on notification type
 */
const buildTemplateComponents = (order, notificationType) => {
  const customerName = order.customer_name || order.name || 'Customer';
  const orderId = order.orderId || order.bill_no;

  switch (notificationType) {
    case 'order_created':
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderId },
            { type: "text", text: `₹${order.total_amount || 0}` }
          ]
        }
      ];

    case 'order_packed':
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderId }
          ]
        }
      ];

    case 'order_shipped':
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderId },
            { type: "text", text: order.tracking_number || 'N/A' }
          ]
        }
      ];

    case 'order_delivered':
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderId }
          ]
        }
      ];

    default:
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName },
            { type: "text", text: orderId }
          ]
        }
      ];
  }
};

/**
 * Trigger notifications based on order changes
 */
const triggerOrderNotifications = async (tenentId, order, eventType, oldStatus = null) => {
  try {
    // Find tenant by tenentId
    const tenant = await Signup.findOne({ tenentId: tenentId });
    if (!tenant) {
      console.log(`[Notification] Tenant ${tenentId} not found`);
      return;
    }

    // Check if tenant is blocked
    if (tenant.blocked) {
      console.log(`[Notification] Tenant ${tenentId} is blocked`);
      return;
    }

    const formattedOrder = formatOrderResponse(order);

    // Send webhook notification
    if (tenant.webhookEnabled) {
      await sendWebhook(tenant, eventType, {
        order: formattedOrder,
        oldStatus,
        newStatus: order.status
      });
    }

    // Send WhatsApp notification based on status
    const status = order.status.toUpperCase();
    
    if (eventType === WEBHOOK_EVENTS.ORDER_CREATED) {
      await sendWhatsAppNotification(tenant, order, 'order_created');
    } else if (status === 'PACKED' && oldStatus !== 'PACKED') {
      await sendWhatsAppNotification(tenant, order, 'order_packed');
    } else if (status === 'SHIPPED' && oldStatus !== 'SHIPPED') {
      await sendWhatsAppNotification(tenant, order, 'order_shipped');
    } else if (status === 'DELIVERED' && oldStatus !== 'DELIVERED') {
      await sendWhatsAppNotification(tenant, order, 'order_delivered');
    }

  } catch (error) {
    console.error('[Notification] Error triggering notifications:', error);
  }
};

// ==========================================
// ORDER ENDPOINTS WITH NOTIFICATIONS
// ==========================================

/**
 * GET /orders
 * Get all orders with pagination, filtering, and search
 */
router.get('/orders', apiKeyAuth(['orders.read']), async (req, res) => {
  try {
    const tenentId = req.user.tenentId;
    console.log("tenentid for f3engine",tenentId);
    const {
      page,
      limit,
      search,
      status,
      startDate,
      endDate
    } = req.query;

    // Validate pagination
    const { page: pageNum, limit: limitNum } = getPaginationParams(page, limit);
    
    // Build query
    const query = buildOrderQuery(tenentId, {
      search,
      status,
      startDate,
      endDate
    });
    
    // Calculate skip
    const skip = (pageNum - 1) * limitNum;
    
    // Execute queries in parallel
    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query)
    ]);
    console.log("order for f3engine",orders);
    // Format response
    const formattedOrders = orders.map(formatOrderResponse);
    const pagination = getPaginationMeta(pageNum, limitNum, totalOrders);
    
    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        pagination
      }
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
});

/**
 * POST /orders
 * Create new order with notifications
 */
router.post('/orders', apiKeyAuth(['orders.write']), async (req, res) => {
  try {
    const tenentId = req.user.tenentId;
    const orderData = req.body;

    // Validate required fields
    if (!orderData.customer_name && !orderData.name) {
      return res.status(400).json({
        success: false,
        error: 'Customer name is required'
      });
    }

    // Create order
    const order = new Order({
      ...orderData,
      tenentId,
      status: orderData.status || 'CREATED',
      created_at: new Date(),
      updated_at: new Date()
    });

    await order.save();

    // Trigger notifications asynchronously (don't wait)
    setImmediate(() => {
      triggerOrderNotifications(
        tenentId, 
        order, 
        WEBHOOK_EVENTS.ORDER_CREATED
      );
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: formatOrderResponse(order)
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
});

/**
 * GET /orders/:orderId
 * Get single order by ID
 */
router.get('/orders/:orderId', apiKeyAuth(['orders.read']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenentId = req.user.tenentId;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }

    // Try finding by orderId first
    let order = await Order.findOne({ 
      orderId,
      tenentId 
    }).lean();
    
    // If not found and valid MongoDB ObjectId, try by _id
    if (!order && mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findOne({
        _id: orderId,
        tenentId
      }).lean();
    }
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }
    
    res.json({
      success: true,
      data: formatOrderResponse(order)
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
});

/**
 * PATCH /orders/:orderId/status
 * Update order status with notifications
 */
router.patch('/orders/:orderId/status', apiKeyAuth(['orders.update']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes, tracking_number } = req.body;
    const tenentId = req.user.tenentId;
    
    // Validate inputs
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required'
      });
    }
    
    if (!status || !status.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    const sanitizedStatus = status.trim().toUpperCase();
    
    // Validate status
    if (!Object.values(ORDER_STATUS).includes(sanitizedStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses: Object.values(ORDER_STATUS)
      });
    }

    // Find existing order to get old status
    let existingOrder = await Order.findOne({ orderId, tenentId });
    if (!existingOrder && mongoose.Types.ObjectId.isValid(orderId)) {
      existingOrder = await Order.findOne({ _id: orderId, tenentId });
    }

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const oldStatus = existingOrder.status;
    
    // Update data
    const updateData = {
      status: sanitizedStatus,
      updated_at: new Date()
    };
    
    if (notes) {
      updateData.notes = notes.trim();
    }

    if (tracking_number) {
      updateData.tracking_number = tracking_number.trim();
    }

    // Update based on status
    if (sanitizedStatus === 'PACKED') {
      updateData.is_packed = true;
      updateData.packing_status = 'COMPLETED';
    } else if (sanitizedStatus === 'SHIPPED') {
      updateData.is_packed = true;
    }
    
    // Perform update
    existingOrder.set(updateData);
    await existingOrder.save();
    
    // Trigger notifications asynchronously
    setImmediate(() => {
      triggerOrderNotifications(
        tenentId,
        existingOrder,
        WEBHOOK_EVENTS.ORDER_STATUS_CHANGED,
        oldStatus
      );
    });
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: formatOrderResponse(existingOrder)
    });
    
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: error.message
    });
  }
});

/**
 * PATCH /orders/bulk/status
 * Bulk update order statuses with notifications
 */
router.patch('/orders/bulk/status', apiKeyAuth(['orders.update']), async (req, res) => {
  try {
    const { orderIds, status } = req.body;
    const tenentId = req.user.tenentId;

    // Validate inputs
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'orderIds must be a non-empty array'
      });
    }
    
    if (!status || !status.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    if (orderIds.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 orders can be updated at once'
      });
    }

    const sanitizedStatus = status.trim().toUpperCase();
    
    // Validate status
    if (!Object.values(ORDER_STATUS).includes(sanitizedStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses: Object.values(ORDER_STATUS)
      });
    }

    // Find all orders first to get old statuses
    const existingOrders = await Order.find({
      orderId: { $in: orderIds },
      tenentId
    });

    const updateData = {
      status: sanitizedStatus,
      updated_at: new Date()
    };

    if (sanitizedStatus === 'PACKED') {
      updateData.is_packed = true;
      updateData.packing_status = 'COMPLETED';
    }

    const result = await Order.updateMany(
      { 
        orderId: { $in: orderIds },
        tenentId 
      },
      updateData
    );

    // Trigger notifications for each updated order asynchronously
    setImmediate(async () => {
      for (const order of existingOrders) {
        const oldStatus = order.status;
        order.set(updateData);
        await triggerOrderNotifications(
          tenentId,
          order,
          WEBHOOK_EVENTS.ORDER_STATUS_CHANGED,
          oldStatus
        );
      }
    });

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} of ${orderIds.length} orders`,
      data: {
        updatedCount: result.modifiedCount,
        requestedCount: orderIds.length,
        status: sanitizedStatus
      }
    });
    
  } catch (error) {
    console.error('Error bulk updating orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update orders',
      message: error.message
    });
  }
});

// ==========================================
// STATISTICS & ANALYTICS
// ==========================================

/**
 * GET /orders/stats/summary
 * Get order statistics summary
 */
router.get('/orders/stats/summary', apiKeyAuth(['orders.read']), async (req, res) => {
  try {
    const tenentId = req.user.tenentId;
    
    const stats = await Order.aggregate([
      { $match: { tenentId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$total_amount', 0] } },
          
          // Count by status
          createdOrders: {
            $sum: { $cond: [{ $eq: [{ $toUpper: '$status' }, 'CREATED'] }, 1, 0] }
          },
          pendingOrders: {
            $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['PENDING', 'CREATED']] }, 1, 0] }
          },
          processingOrders: {
            $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['PROCESSING', 'PAID']] }, 1, 0] }
          },
          packedOrders: {
            $sum: { $cond: [{ $eq: [{ $toUpper: '$status' }, 'PACKED'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: [{ $toUpper: '$status' }, 'SHIPPED'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['DELIVERED', 'COMPLETED']] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['CANCELLED', 'FAILED']] }, 1, 0] }
          }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      createdOrders: 0,
      pendingOrders: 0,
      processingOrders: 0,
      packedOrders: 0,
      shippedOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0
    };
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics',
      message: error.message
    });
  }
});

/**
 * GET /orders/filter/pending
 * Get pending orders that need processing
 */
router.get('/orders/filter/pending', apiKeyAuth(['orders.read']), async (req, res) => {
  try {
    const tenentId = req.user.tenentId;
    const { limit = 50 } = req.query;

    const limitNum = Math.min(
      Math.max(1, parseInt(limit) || 50), 
      PAGINATION.MAX_LIMIT
    );

    const pendingOrders = await Order.find({
      tenentId,
      $or: [
        { 
          status: { $in: ['PAID', 'PROCESSING'] },
          $or: [
            { is_packed: false }, 
            { is_packed: { $exists: false } }
          ]
        },
        {
          status: { $in: ['PENDING', 'CREATED'] }
        }
      ]
    })
    .sort({ created_at: 1 }) // Oldest first for FIFO processing
    .limit(limitNum)
    .lean();

    res.json({
      success: true,
      data: pendingOrders.map(formatOrderResponse),
      count: pendingOrders.length
    });
    
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending orders',
      message: error.message
    });
  }
});

module.exports = router;
