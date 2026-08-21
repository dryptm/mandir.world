const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, trim: true, lowercase: true },
  name:       { type: String, default: null, trim: true },
  phone:      { type: String, default: null, trim: true },
  gotra:      { type: String, default: null, trim: true }, // convenient default for future sankalp/puja forms

  // Every sankalp/donation/booking made anonymously before signing up can be
  // linked back to this account once they verify the same email — see
  // linkPastActivity() usage in server.js.
  lastLoginAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
