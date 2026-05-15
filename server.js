const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getPanchang } = require('./panchang');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'mandir-world-2025', resave: false, saveUninitialized: true }));

// Data
const festivals = require('./data/festivals.json');
const streams   = require('./data/streams.json');
const pujas     = require('./data/pujas.json');

// Stores
const sankalpStore  = [];
const donationStore = [];
const pujaBookings  = [];

// Helpers
function formatDate(d) {
  if (!d || d === 'daily') return 'Daily';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(dateStr) {
  if (!dateStr || dateStr === 'daily') return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

// ── HOME ──
app.get('/', (req, res) => {
  const panchang = getPanchang(new Date());
  const liveStreams = streams.filter(s => s.isLive).slice(0, 4);
  const upcomingFestivals = festivals
    .filter(f => f.isUpcoming)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const nextBig = upcomingFestivals[0] || null;
  const dailyEvents = festivals.filter(f => f.isDaily);
  const totalSankalpCount = sankalpStore.length + 18470;
  const totalDonations = donationStore.reduce((s, d) => s + d.amount, 0) + 1847500;
  const popularPujas = pujas.filter(p => p.popular).slice(0, 4);
  res.render('index', {
    panchang, liveStreams, upcomingFestivals, nextBig, dailyEvents,
    totalSankalpCount, totalDonations, popularPujas,
    formatDate, daysUntil, page: 'home'
  });
});

// ── DARSHAN ──
app.get('/darshan', (req, res) => {
  const city = req.query.city || '';
  const filtered = city ? streams.filter(s => s.city.toLowerCase() === city.toLowerCase()) : streams;
  const cities = [...new Set(streams.map(s => s.city))];
  res.render('darshan', { streams: filtered, allStreams: streams, cities, selectedCity: city, page: 'darshan', formatDate });
});

app.get('/darshan/:id', (req, res) => {
  const stream = streams.find(s => s.id === req.params.id);
  if (!stream) return res.redirect('/darshan');
  const relatedStreams = streams.filter(s => s.id !== stream.id).slice(0, 3);
  res.render('stream', { stream, relatedStreams, page: 'darshan', formatDate });
});

// ── PUJA SEWA ──
app.get('/puja-sewa', (req, res) => {
  const upcomingFestivals = festivals
    .filter(f => f.isUpcoming)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  res.render('puja-sewa', {
    pujas, upcomingFestivals, page: 'puja',
    success: req.session.pujaSuccess || null,
    lastBooking: req.session.lastPujaBooking || null,
    formatDate, daysUntil
  });
  req.session.pujaSuccess = null;
  req.session.lastPujaBooking = null;
});

app.post('/puja-sewa', (req, res) => {
  const { puja_id, puja_name, devotee_name, gotra, occasion, preferred_date, occasion_event, phone, email } = req.body;
  const booking = {
    id: uuidv4(),
    bookingNo: `MDW-P-${Date.now()}`,
    puja_id, puja_name, devotee_name, gotra: gotra || 'Not specified',
    occasion, preferred_date, occasion_event: occasion_event || '',
    phone, email: email || '',
    status: 'Confirmed',
    timestamp: new Date().toISOString()
  };
  pujaBookings.push(booking);
  req.session.pujaSuccess = true;
  req.session.lastPujaBooking = booking;
  res.redirect('/puja-sewa');
});

// ── SANKALP ──
app.get('/sankalp', (req, res) => {
  const activeEvents = festivals.filter(f => f.isLive || f.isUpcoming || f.isDaily).slice(0, 8);
  res.render('sankalp', {
    events: activeEvents, page: 'sankalp',
    success: req.session.sankalpSuccess || null,
    lastSankalp: req.session.lastSankalp || null,
    formatDate
  });
  req.session.sankalpSuccess = null;
  req.session.lastSankalp = null;
});

app.post('/sankalp', (req, res) => {
  const { name, gotra, wish, event, city } = req.body;
  if (!name || !wish || !event) return res.redirect('/sankalp?error=missing');
  const sankalp = {
    id: uuidv4(), name: name.trim(),
    gotra: gotra ? gotra.trim() : 'Not specified',
    wish: wish.trim(), event, city: city || 'Varanasi',
    timestamp: new Date().toISOString(),
    number: sankalpStore.length + 18471
  };
  sankalpStore.push(sankalp);
  req.session.sankalpSuccess = true;
  req.session.lastSankalp = sankalp;
  res.redirect('/sankalp');
});

// ── CALENDAR ──
app.get('/calendar', (req, res) => {
  const month = req.query.month || '';
  const category = req.query.category || '';
  let filtered = festivals.filter(f => !f.isDaily);
  if (month) filtered = filtered.filter(f => f.month === month);
  if (category) filtered = filtered.filter(f => f.category === category);
  const months = [...new Set(festivals.filter(f => f.month !== 'Daily').map(f => f.month))];
  const categories = [...new Set(festivals.map(f => f.category))];
  const dailyEvents = festivals.filter(f => f.isDaily);
  const upcoming = festivals.filter(f => f.isUpcoming).sort((a,b) => new Date(a.date)-new Date(b.date));
  const past = festivals.filter(f => f.isPast);
  res.render('calendar', { festivals: filtered, upcoming, past, dailyEvents, months, categories, selectedMonth: month, selectedCategory: category, page: 'calendar', formatDate, daysUntil });
});

app.get('/calendar/:id', (req, res) => {
  const festival = festivals.find(f => f.id === req.params.id);
  if (!festival) return res.redirect('/calendar');
  const related = festivals.filter(f => f.id !== festival.id && (f.deity === festival.deity || f.category === festival.category)).slice(0, 3);
  res.render('festival-detail', { festival, related, page: 'calendar', formatDate, daysUntil });
});

// ── DAAN ──
app.get('/daan', (req, res) => {
  const causes = [
    { id:'gau-seva', name:'Gau Seva', hindi:'गौ सेवा', description:'Support the care, feeding, and medical treatment of sacred cows at verified goshalas in Varanasi and Mathura.', icon:'🐄', raised:384600, goal:1000000, tier:[51,251,501,1100,5100] },
    { id:'annadaan', name:'Annadaan at Kashi', hindi:'अन्नदान', description:'Fund daily meals for pilgrims, priests, sadhus, and the underprivileged at the ghats of Varanasi.', icon:'🍛', raised:241200, goal:500000, tier:[51,251,1100,5100] },
    { id:'ganga-seva', name:'Ganga Safai Abhiyan', hindi:'गंगा सफाई', description:'Support ghat cleaning drives, river conservation, and Ganga rejuvenation efforts.', icon:'🌊', raised:161900, goal:300000, tier:[51,501,1100,2100] },
    { id:'vidya-daan', name:'Vidya Daan', hindi:'विद्या दान', description:'Provide education support, books, and scholarships to children from underprivileged families near temple towns.', icon:'📚', raised:94000, goal:250000, tier:[51,251,501,1100] },
    { id:'ghat-dev', name:'Ghat Preservation', hindi:'घाट संरक्षण', description:'Contribute to the restoration, maintenance, and beautification of ancient ghats in Varanasi and Haridwar.', icon:'🏛️', raised:178000, goal:500000, tier:[251,501,1100,5100] },
    { id:'platform', name:'Support Mandir.World', hindi:'मंदिर.वर्ल्ड सेवा', description:'Help us build better streams, reach more pilgrims, and bring darshan to those who cannot travel.', icon:'📡', raised:84800, goal:200000, tier:[51,251,501,1100] }
  ];
  res.render('daan', {
    causes, page: 'daan',
    success: req.session.donationSuccess || null,
    lastDonation: req.session.lastDonation || null,
    formatDate
  });
  req.session.donationSuccess = null;
  req.session.lastDonation = null;
});

app.post('/daan', (req, res) => {
  const { name, cause_id, cause_name, amount, custom_amount, pan } = req.body;
  const finalAmount = parseInt(custom_amount) || parseInt(amount);
  if (!name || !cause_id || !finalAmount) return res.redirect('/daan?error=missing');
  const donation = {
    id: uuidv4(), receiptNo: `MDW-${Date.now()}`,
    name: name.trim(), cause_id, cause_name, amount: finalAmount,
    pan: pan || null, timestamp: new Date().toISOString()
  };
  donationStore.push(donation);
  req.session.donationSuccess = true;
  req.session.lastDonation = donation;
  res.redirect('/daan');
});

// ── TEMPLES ──
app.get('/temples', (req, res) => {
  const byCity = {};
  streams.forEach(s => {
    if (!byCity[s.city]) byCity[s.city] = [];
    byCity[s.city].push(s);
  });
  const cities = Object.keys(byCity).sort();
  res.render('temples', { streams, byCity, cities, page: 'temples', formatDate });
});

// ── ABOUT ──
app.get('/about', (req, res) => {
  res.render('about', { page: 'about', formatDate });
});

// ── API ──
app.get('/api/streams', (req, res) => res.json(streams));
app.get('/api/festivals', (req, res) => res.json(festivals));
app.get('/api/panchang', (req, res) => res.json(getPanchang(new Date())));
app.get('/api/stats', (req, res) => res.json({
  sankalpCount: sankalpStore.length + 18470,
  totalDonations: donationStore.reduce((s,d) => s+d.amount, 0) + 1847500,
  liveViewers: streams.filter(s => s.isLive).reduce((s,st) => s + st.viewers, 0),
  pujaBookings: pujaBookings.length
}));

app.use((req, res) => res.status(404).render('404', { page: '' }));

app.listen(PORT, () => {
  console.log(`\n🕉️  Mandir.World running → http://localhost:${PORT}\n`);
});
