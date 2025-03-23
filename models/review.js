const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: String,
  username: String,
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  isApproved: { type: Boolean, default: false }
});

module.exports = mongoose.model('Review', reviewSchema);