const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // Core identifier fields
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  flow_token: {
    type: String
  },
  orderId: {
    type: String,
    required: true
  },
  bill_no: {
    type: String
  },
  tenentId: {
    type: String
  },
  senderId: {
    type: String
  },
  customer_wa_id: {
    type: String
  },
  profile_name: {
    type: String
  },
    name: {
    type: String
  },
    username: {
    type: String
  },
  // Payment information
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpayPaymentLinkId: String,
  razorpayPaymentLinkUrl: String,
  paymentStatus: {
    type: String
  },
  paymentMethod: {
    type: String
  },
  payment_reminder_sent: {
    type: Boolean,
    default: false
  },
  payment_reminder_scheduled: {
    type: Boolean,
    default: true
  },
  
  // Products information
  products: [{
    sku: String,
    product_name: String,
    quantity: Number,
    selectedunit: String,
    price: Number
  }],
  
  // Financial information
  amount: {
    type: Number
  },
  amountPaid: {
    type: Number
  },
  shipping_cost: {
    type: Number,
    default: 0
  },
  total_amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['created', 'pending', 'processing', 'paid', 'shipped', 'delivered', 'failed', 'cancelled', 'completed', 'CREATED', 'PENDING', 'PROCESSING', 'PAID', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED', 'COMPLETED','HOLDED'],
    default: 'created'
  },
  confirmation_sent: {
    type: Boolean,
    default: false
  },
  print_status: {
    type: String,
    enum: ['PENDING', 'PRINTED', 'FAILED'],
    default: 'PENDING'
  },
  tracking_status: {
    type: String,
    enum: ['NOT_SHIPPED', 'SHIPPED', 'DELIVERED'],
    default: 'NOT_SHIPPED'
  },
  holding_status: {
    type: String,
    enum: ['NOT_ON_HOLD', 'ON_HOLD'],
    default: 'NOT_ON_HOLD'
  },
  is_on_hold: {
    type: Boolean,
    default: false
  },
  packing_status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'],
    default: 'PENDING'
  },
 
  // Shipping and address information
  customer_name: String,
  address: String,
  city: String,
  country: {
    type: String,
    default: 'India'
  },
  phone_number: String,
  state: String,
  zip_code: String,
  shipping_partner: {
    type: mongoose.Schema.Types.Mixed, // This allows objects or strings
    default: null
  },
  tracking_number: String,
  weight: Number,
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  timestamp: {
    type: String
  },
  updated_at: {
    type: Date
  }
});

// Create indexes for faster lookups
OrderSchema.index({ orderId: 1 });
OrderSchema.index({ tenentId: 1, orderId: 1 });
OrderSchema.index({ senderId: 1 });
OrderSchema.index({ customer_wa_id: 1 });
OrderSchema.index({ razorpayPaymentLinkId: 1 });
OrderSchema.index({ razorpayPaymentId: 1 });

const Order = mongoose.model('Order', OrderSchema);
module.exports = Order;
