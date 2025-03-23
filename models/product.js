const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  clubPrice: { type: Number, default: 0 },
  clientPrice: { type: Number, default: 0 },
  image: String,
  stock: { type: Number, default: 0 },
  averageRating: { type: Number, default: 0 }
});

module.exports = mongoose.model('Product', productSchema);