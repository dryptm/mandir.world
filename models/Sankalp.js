const mongoose = require('mongoose');

const sankalpSchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  gotra:     { type: String, default: 'Not specified', trim: true },
  wish:      { type: String, required: true, trim: true },
  event:     { type: String, required: true },
  city:      { type: String, default: 'Varanasi' },
  number:    { type: Number },
}, {
  timestamps: true   // adds createdAt + updatedAt automatically
});

// Auto-increment sankalp number before saving
sankalpSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Sankalp').countDocuments();
    this.number = count + 18471;
  }
  next();
});

module.exports = mongoose.model('Sankalp', sankalpSchema);
