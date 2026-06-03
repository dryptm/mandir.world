const mongoose = require('mongoose');

const nameFieldSchema = new mongoose.Schema({
  id:          String,
  label:       String,
  placeholder: String,
  type:        { type: String, default: 'text' },
  required:    { type: Boolean, default: false }
}, { _id: false });

const pujaSchema = new mongoose.Schema({
  id:                  { type: String, required: true, unique: true },
  name:                { type: String, required: true },
  hindi:               { type: String },
  deity:               { type: String },
  duration:            { type: String },
  price:               { type: Number, required: true },
  description:         { type: String },
  includes:            [{ type: String }],
  icon:                { type: String, default: '🙏' },
  popular:             { type: Boolean, default: false },
  prasad:              { type: Boolean, default: false },
  purpose:             { type: String },
  notFor:              [{ type: String }],
  compatibleOccasions: [{ type: String }],
  nameFields:          [nameFieldSchema],
  active:              { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Puja', pujaSchema);
