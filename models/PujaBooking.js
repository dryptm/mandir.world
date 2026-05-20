const mongoose = require('mongoose');

const pujaBookingSchema = new mongoose.Schema({
  bookingNo:      { type: String, unique: true },
  puja_id:        { type: String, required: true },
  puja_name:      { type: String, required: true },
  devotee_name:   { type: String, required: true, trim: true },
  gotra:          { type: String, default: 'Not specified', trim: true },
  occasion:       { type: String, required: true },
  preferred_date: { type: String, required: true },
  phone:          { type: String, required: true, trim: true },
  email:          { type: String, default: null, trim: true, lowercase: true },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled'],
    default: 'Confirmed'
  },
}, {
  timestamps: true
});

pujaBookingSchema.pre('save', function (next) {
  if (!this.bookingNo) {
    this.bookingNo = `MDW-P-${Date.now()}`;
  }
  next();
});

module.exports = mongoose.model('PujaBooking', pujaBookingSchema);
