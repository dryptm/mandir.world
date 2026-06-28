const mongoose = require('mongoose');

const pujaBookingSchema = new mongoose.Schema({
  bookingNo:      { type: String, unique: true },
  puja_id:        { type: String, required: true },
  puja_name:      { type: String, required: true },
  occasion:       { type: String, required: true },
  preferred_date: { type: String, required: true },
  phone:          { type: String, required: true, trim: true },
  email:          { type: String, default: null, trim: true, lowercase: true },

  // Core devotee — always present
  devotee_name:   { type: String, default: null, trim: true },
  gotra:          { type: String, default: null, trim: true },

  // Family puja
  family_members: { type: String, default: null },

  // Marriage specific
  groom_name:     { type: String, default: null, trim: true },
  groom_gotra:    { type: String, default: null, trim: true },
  bride_name:     { type: String, default: null, trim: true },
  bride_gotra:    { type: String, default: null, trim: true },
  wedding_date:   { type: String, default: null },

  // Ancestor liberation specific
  departed_name:     { type: String, default: null, trim: true },
  departed_relation: { type: String, default: null, trim: true },

  // Business / property
  business_name:  { type: String, default: null, trim: true },
  home_address:   { type: String, default: null },

  // Astrology
  date_of_birth:  { type: String, default: null },

  payment: {
    provider:  { type: String, default: 'razorpay' },
    orderId:   { type: String, default: null },
    paymentId: { type: String, default: null },
    status:    { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' }
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Confirmed'
  }
}, { timestamps: true });

pujaBookingSchema.pre('save', function (next) {
  if (!this.bookingNo) this.bookingNo = `MDW-P-${Date.now()}`;
  next();
});

module.exports = mongoose.model('PujaBooking', pujaBookingSchema);
