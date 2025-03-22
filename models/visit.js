const mongoose = require('mongoose');

const visitSchema = new mongoose.Schema({
  username: String,
  userId: Number,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Visit', visitSchema);