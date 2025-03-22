const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
  createdAt: { type: Date, default: Date.now },
  isApproved: { type: Boolean, default: false } // Добавлено для модерации
});

module.exports = mongoose.model('Review', reviewSchema);