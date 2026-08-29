const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  location:  { type: String, required: true, trim: true }, // e.g. "London, UK" or "Toronto, Canada"
  story:     { type: String, required: true, trim: true, maxlength: 1200 },
  email:     { type: String, default: null, trim: true, lowercase: true }, // optional, for follow-up only — never shown publicly
  photoUrl:  { type: String, default: null }, // optional, for future use

  // Moderation — nothing shows publicly until an admin approves it.
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  featured:  { type: Boolean, default: false }, // shown in the homepage teaser when true

  consent:   { type: Boolean, default: false }, // confirms they're okay being shown publicly
}, { timestamps: true });

module.exports = mongoose.model('Story', storySchema);
