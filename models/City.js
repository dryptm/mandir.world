const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name:  { type: String, required: true, unique: true },
  lat:   { type: Number, required: true },
  lon:   { type: Number, required: true },
  state: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('City', citySchema);
