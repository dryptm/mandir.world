const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema({
  id:                { type: String, required: true, unique: true },
  title:             { type: String, required: true },
  hindi:             { type: String },
  city:              { type: String, required: true },
  state:             { type: String },
  location:          { type: String },
  description:       { type: String },
  schedule:          { type: String },
  thumbnail:         { type: String },
  youtubeChannelId:  { type: String, default: '' },
  youtubeVideoId:    { type: String, default: '' },
  isLive:            { type: Boolean, default: false },
  viewers:           { type: Number, default: 0 },
  deity:             { type: String },
  tags:              [{ type: String }],
  active:            { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Stream', streamSchema);
