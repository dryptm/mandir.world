const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  receiptNo:  { type: String, unique: true },
  name:       { type: String, required: true, trim: true },
  cause_id:   { type: String, required: true },
  cause_name: { type: String, required: true },
  amount:     { type: Number, required: true, min: 10 },
  pan:        { type: String, default: null, uppercase: true, trim: true },

  // Stream-specific daan fields (populated when donated from a live stream)
  streamId:   { type: String, default: null },
  streamCity: { type: String, default: null },

  // Prasad delivery (for premium daan ₹501+)
  prasad: {
    requested: { type: Boolean, default: false },
    address1:  { type: String, default: null },
    address2:  { type: String, default: null },
    city:      { type: String, default: null },
    pincode:   { type: String, default: null },
    phone:     { type: String, default: null },
  }
}, {
  timestamps: true
});

// Generate receipt number before saving
donationSchema.pre('save', function (next) {
  if (!this.receiptNo) {
    this.receiptNo = `MDW-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);
