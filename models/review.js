// models/review.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: String,
  username: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  rating: Number,
  comment: String,
  isApproved: Boolean
}, { timestamps: true }); // Включает createdAt и updatedAt

module.exports = mongoose.model('Review', reviewSchema);