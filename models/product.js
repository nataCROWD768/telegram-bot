const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  image: { type: String, required: true },
  clubPrice: { type: Number, required: true },
  clientPrice: { type: Number, required: true },
  stock: { type: Number, required: true },
  averageRating: { type: Number, default: 0 }
});

module.exports = mongoose.model('Product', productSchema);