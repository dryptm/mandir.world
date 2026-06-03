const mongoose = require('mongoose');

const festivalSchema = new mongoose.Schema({
  id:          { type: String, required: true, unique: true },
  name:        { type: String, required: true },
  hindi:       { type: String },
  date:        { type: String, required: true },   // 'YYYY-MM-DD' or 'daily'
  endDate:     { type: String, default: null },
  month:       { type: String },
  deity:       { type: String },
  category:    { type: String },
  description: { type: String },
  significance:{ type: String },
  rituals:     [{ type: String }],
  cities:      [{ type: String }],
  donationCauses: [{ type: String }],
  mantra:      { type: String },
  color:       { type: String, default: '#FF6B00' },
  icon:        { type: String, default: '🕉️' },
  isLive:      { type: Boolean, default: false },
  isDaily:     { type: Boolean, default: false },
  active:      { type: Boolean, default: true }   // employees can disable without deleting
}, { timestamps: true });

module.exports = mongoose.model('Festival', festivalSchema);
