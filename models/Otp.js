const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email:     { type: String, required: true, trim: true, lowercase: true },
  code:      { type: String, required: true },
  attempts:  { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 600 } // auto-deletes after 10 minutes
});

module.exports = mongoose.model('Otp', otpSchema);
