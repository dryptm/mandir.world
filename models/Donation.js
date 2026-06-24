const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  receiptNo:  { type: String, unique: true },
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, default: null, trim: true },
  email:      { type: String, default: null, trim: true, lowercase: true },
  pan:        { type: String, default: null, uppercase: true, trim: true },
  cause_id:   { type: String, required: true },
  cause_name: { type: String, required: true },
  amount:     { type: Number, required: true, min: 1 },

  // Tier type — determines what the devotee receives
  // basic | sankalp | prasad | premium
  tier_type: {
    type: String,
    enum: ['basic', 'sankalp', 'prasad', 'premium'],
    default: 'basic'
  },

  // Stream-specific (when donated from a live darshan page)
  streamId:   { type: String, default: null },
  streamCity: { type: String, default: null },

  // User location (captured from browser geolocation)
  userLocation: {
    lat:     { type: Number, default: null },
    lon:     { type: Number, default: null },
    city:    { type: String, default: null },
    state:   { type: String, default: null },
    country: { type: String, default: null }
  },

  // Prasad / Premium delivery
  // Payment gateway details
  payment: {
    provider:  { type: String, default: 'razorpay' },
    orderId:   { type: String, default: null },
    paymentId: { type: String, default: null },
    status:    { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }
  },

  prasad: {
    requested:     { type: Boolean, default: false },
    shippingCost:  { type: Number,  default: 0 },
    address1:      { type: String,  default: null },
    address2:      { type: String,  default: null },
    city:          { type: String,  default: null },
    state:         { type: String,  default: null },
    pincode:       { type: String,  default: null },
    phone:         { type: String,  default: null },
    pujaCity:      { type: String,  default: null },
    distanceKm:    { type: Number,  default: null }
  }
}, {
  timestamps: true
});

donationSchema.pre('save', function (next) {
  if (!this.receiptNo) {
    this.receiptNo = `MDW-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('Donation', donationSchema);
