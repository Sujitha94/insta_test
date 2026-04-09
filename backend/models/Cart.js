const mongoose = require('mongoose');

// This is the sub-document schema for each item within the cart.
const CartItemSchema = new mongoose.Schema({
  sku: { 
    type: String, 
    required: true 
  },
  productName: { 
    type: String, 
    required: true 
  },
  productPhotoUrl: { 
    type: String 
  },
  price: { 
    type: Number, 
    required: true 
  },
  quantity: { 
    type: Number, 
    default: 1,
    min: 1
  },
  selectedUnit: { // <-- THIS IS THE NEW FIELD FOR SIZE/UNIT VARIATION
    type: String,
    
  }
}, { _id: false }); // Using _id: false prevents MongoDB from creating a separate ID for each cart item sub-document.

const CartSchema = new mongoose.Schema({
  senderId: { 
    type: String, 
    required: true,
    index: true // Add index for faster lookups by senderId
  },
  tenentId: { 
    type: String, 
    required: true 
  },
  items: [CartItemSchema], // Use the defined sub-document schema
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add a compound index for the most common query
CartSchema.index({ senderId: 1, tenentId: 1 });

// Middleware to update the `updatedAt` field on save
CartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Cart = mongoose.model('Cart', CartSchema);

module.exports = Cart;
