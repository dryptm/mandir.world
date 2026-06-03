require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Festival = require('../models/Festival');
const Stream   = require('../models/Stream');
const Puja     = require('../models/Puja');
const City     = require('../models/City');
const festivalsData = require('../data/festivals.json');
const streamsData   = require('../data/streams.json');
const pujaData      = require('../data/pujas.json');
const citiesData    = require('../data/cities.json');

async function seed() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }
  console.log('Connecting...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected\n');

  await Festival.deleteMany({});
  await Festival.insertMany(festivalsData.map(f => ({ ...f, active: true })));
  console.log(`Festivals: ${festivalsData.length} inserted`);

  await Stream.deleteMany({});
  await Stream.insertMany(streamsData.map(s => ({ ...s, active: true })));
  console.log(`Streams: ${streamsData.length} inserted`);

  await Puja.deleteMany({});
  await Puja.insertMany(pujaData.map(p => ({ ...p, active: true })));
  console.log(`Pujas: ${pujaData.length} inserted`);

  await City.deleteMany({});
  const cityDocs = Object.entries(citiesData).map(([name, c]) => ({ name, lat: c.lat, lon: c.lon, state: c.state }));
  await City.insertMany(cityDocs);
  console.log(`Cities: ${cityDocs.length} inserted`);

  console.log('\nDatabase seeded. Connect with MongoDB Compass to manage data.');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
