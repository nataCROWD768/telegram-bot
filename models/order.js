const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
  totalPrice: Number,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);