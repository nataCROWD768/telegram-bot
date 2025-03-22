const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  clientPrice: Number,
  clubPrice: Number,
  image: String,
  certificates: [String],
  stock: Number,
  averageRating: { type: Number, default: 0 } // Средний рейтинг
});

module.exports = mongoose.model('Product', productSchema);