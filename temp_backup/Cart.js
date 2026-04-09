const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
  senderId: { type: String, required: true }, // User's Instagram ID
  tenentId: { type: String, required: true }, // Tenant ID for multi-tenancy
  items: [
    {
      sku: { type: String, required: true },
      productName: { type: String, required: true },
      productPhotoUrl: { type: String },
      price: { type: Number, required: true },
      quantity: { type: Number, default: 1 }
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

const Cart = mongoose.model('Cart', CartSchema);
module.exports = Cart;
