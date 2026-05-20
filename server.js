require('dotenv').config();

const express    = require('express');
const bodyParser = require('body-parser');
const session    = require('express-session');
const path       = require('path');
const compression     = require('compression');
const helmet          = require('helmet');
const { connectDB }   = require('./db/connect');
const { getPanchang } = require('./panchang');

// ── MONGOOSE MODELS ──────────────────────────────────────
const Sankalp     = require('./models/Sankalp');
const Donation    = require('./models/Donation');
const PujaBooking = require('./models/PujaBooking');

const app    = express();
const PORT   = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── SECURITY & COMPRESSION ───────────────────────────────
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: isProd ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'https://www.youtube.com', 'https://fonts.googleapis.com'],
      frameSrc:   ["'self'", 'https://www.youtube.com'],
      imgSrc:     ["'self'", 'data:', 'https:'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"]
    }
  } : false
}));
app.set('trust proxy', 1);

// ── APP SETUP ────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isProd ? '7d' : 0,
  etag: true
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'mandir-world-dev-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: isProd, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── STATIC DATA (festivals/streams/pujas never change at runtime) ──
const festivals = require('./data/festivals.json');
const streams   = require('./data/streams.json');
const pujas     = require('./data/pujas.json');

// ── HELPERS ──────────────────────────────────────────────
function formatDate(d) {
  if (!d || d === 'daily') return 'Daily';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
function daysUntil(dateStr) {
  if (!dateStr || dateStr === 'daily') return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ── ROUTES ───────────────────────────────────────────────

// Health check
app.get('/health', async (req, res) => {
  const sankalpCount  = await Sankalp.countDocuments();
  const donationCount = await Donation.countDocuments();
  res.json({ status: 'ok', sankalpCount, donationCount, ts: new Date().toISOString() });
});

// ── HOME ─────────────────────────────────────────────────
app.get('/', async (req, res) => {
  const panchang          = getPanchang(new Date());
  const liveStreams        = streams.filter(s => s.isLive).slice(0, 4);
  const upcomingFestivals = festivals
    .filter(f => f.isUpcoming)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextBig      = upcomingFestivals[0] || null;
  const dailyEvents  = festivals.filter(f => f.isDaily);
  const popularPujas = pujas.filter(p => p.popular).slice(0, 4);

  // Live counts from MongoDB
  const [sankalpCount, donationAgg] = await Promise.all([
    Sankalp.countDocuments(),
    Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }])
  ]);
  const totalSankalpCount = sankalpCount + 18470;
  const totalDonations    = (donationAgg[0]?.total || 0) + 1847500;

  res.render('index', {
    panchang, liveStreams, upcomingFestivals, nextBig, dailyEvents,
    popularPujas, totalSankalpCount, totalDonations, formatDate, daysUntil, page: 'home'
  });
});

// ── DARSHAN ──────────────────────────────────────────────
app.get('/darshan', (req, res) => {
  const city     = req.query.city || '';
  const filtered = city ? streams.filter(s => s.city.toLowerCase() === city.toLowerCase()) : streams;
  const cities   = [...new Set(streams.map(s => s.city))];
  res.render('darshan', { streams: filtered, allStreams: streams, cities, selectedCity: city, page: 'darshan', formatDate });
});

app.get('/darshan/:id', (req, res) => {
  const stream = streams.find(s => s.id === req.params.id);
  if (!stream) return res.redirect('/darshan');
  const relatedStreams = streams.filter(s => s.id !== stream.id).slice(0, 3);
  res.render('stream', { stream, relatedStreams, page: 'darshan', formatDate });
});

// ── TEMPLES ──────────────────────────────────────────────
app.get('/temples', (req, res) => {
  const byCity = {};
  streams.forEach(s => { if (!byCity[s.city]) byCity[s.city] = []; byCity[s.city].push(s); });
  const cities = Object.keys(byCity).sort();
  res.render('temples', { streams, byCity, cities, page: 'temples', formatDate });
});

// ── PUJA SEWA ─────────────────────────────────────────────
app.get('/puja-sewa', (req, res) => {
  const upcomingFestivals = festivals
    .filter(f => f.isUpcoming)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  res.render('puja-sewa', {
    pujas, upcomingFestivals, page: 'puja',
    success:     req.session.pujaSuccess || null,
    lastBooking: req.session.lastPujaBooking || null,
    formatDate, daysUntil
  });
  req.session.pujaSuccess     = null;
  req.session.lastPujaBooking = null;
});

app.post('/puja-sewa', async (req, res) => {
  const { puja_id, puja_name, devotee_name, gotra, occasion, preferred_date, phone, email } = req.body;
  try {
    const booking = await PujaBooking.create({
      puja_id, puja_name,
      devotee_name,
      gotra:          gotra || 'Not specified',
      occasion,
      preferred_date,
      phone,
      email:          email || null
    });
    req.session.pujaSuccess     = true;
    req.session.lastPujaBooking = {
      bookingNo:    booking.bookingNo,
      puja_name:    booking.puja_name,
      devotee_name: booking.devotee_name,
      gotra:        booking.gotra,
      occasion:     booking.occasion,
      preferred_date: booking.preferred_date,
      phone:        booking.phone,
      status:       booking.status
    };
  } catch (err) {
    console.error('PujaBooking error:', err.message);
  }
  res.redirect('/puja-sewa');
});

// ── SANKALP ───────────────────────────────────────────────
app.get('/sankalp', (req, res) => {
  const activeEvents = festivals.filter(f => f.isLive || f.isUpcoming || f.isDaily).slice(0, 8);
  res.render('sankalp', {
    events: activeEvents, page: 'sankalp',
    success:      req.session.sankalpSuccess || null,
    lastSankalp:  req.session.lastSankalp || null,
    formatDate
  });
  req.session.sankalpSuccess = null;
  req.session.lastSankalp    = null;
});

app.post('/sankalp', async (req, res) => {
  const { name, gotra, wish, event, city } = req.body;
  if (!name || !wish || !event) return res.redirect('/sankalp?error=missing');
  try {
    const sankalp = await Sankalp.create({
      name, gotra, wish, event, city: city || 'Varanasi'
    });
    req.session.sankalpSuccess = true;
    req.session.lastSankalp    = {
      number:    sankalp.number,
      name:      sankalp.name,
      gotra:     sankalp.gotra,
      wish:      sankalp.wish,
      event:     sankalp.event,
      city:      sankalp.city,
      timestamp: sankalp.createdAt
    };
  } catch (err) {
    console.error('Sankalp error:', err.message);
  }
  res.redirect('/sankalp');
});

// ── CALENDAR ─────────────────────────────────────────────
app.get('/calendar', (req, res) => {
  const { month = '', category = '' } = req.query;
  let filtered = festivals.filter(f => !f.isDaily);
  if (month)    filtered = filtered.filter(f => f.month === month);
  if (category) filtered = filtered.filter(f => f.category === category);
  const months      = [...new Set(festivals.filter(f => f.month !== 'Daily').map(f => f.month))];
  const categories  = [...new Set(festivals.map(f => f.category))];
  const dailyEvents = festivals.filter(f => f.isDaily);
  const upcoming    = festivals.filter(f => f.isUpcoming).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past        = festivals.filter(f => f.isPast);
  res.render('calendar', {
    festivals: filtered, upcoming, past, dailyEvents, months, categories,
    selectedMonth: month, selectedCategory: category, page: 'calendar', formatDate, daysUntil
  });
});

app.get('/calendar/:id', (req, res) => {
  const festival = festivals.find(f => f.id === req.params.id);
  if (!festival) return res.redirect('/calendar');
  const related = festivals.filter(f =>
    f.id !== festival.id && (f.deity === festival.deity || f.category === festival.category)
  ).slice(0, 3);
  res.render('festival-detail', { festival, related, page: 'calendar', formatDate, daysUntil });
});

// ── DAAN ─────────────────────────────────────────────────
app.get('/daan', (req, res) => {
  const causes = [
    { id:'gau-seva',   name:'Gau Seva',             hindi:'गौ सेवा',           description:'Support the care and feeding of sacred cows at verified goshalas in Varanasi and Mathura.',   icon:'🐄', raised:384600, goal:1000000, tier:[51,251,501,1100,5100] },
    { id:'annadaan',   name:'Annadaan at Kashi',    hindi:'अन्नदान',           description:'Fund daily meals for pilgrims, priests, and the underprivileged at the ghats of Varanasi.',   icon:'🍛', raised:241200, goal:500000,  tier:[51,251,1100,5100]   },
    { id:'ganga-seva', name:'Ganga Safai Abhiyan',  hindi:'गंगा सफाई',         description:'Support ghat cleaning drives and Ganga river conservation efforts.',                           icon:'🌊', raised:161900, goal:300000,  tier:[51,501,1100,2100]   },
    { id:'vidya-daan', name:'Vidya Daan',            hindi:'विद्या दान',        description:'Provide education, books, and scholarships to children near temple towns.',                     icon:'📚', raised:94000,  goal:250000,  tier:[51,251,501,1100]    },
    { id:'ghat-dev',   name:'Ghat Preservation',    hindi:'घाट संरक्षण',       description:'Contribute to the restoration of ancient ghats in Varanasi and Haridwar.',                     icon:'🏛️', raised:178000, goal:500000,  tier:[251,501,1100,5100]  },
    { id:'platform',   name:'Support Mandir.World', hindi:'मंदिर.वर्ल्ड सेवा', description:'Help us build better streams and bring darshan to those who cannot travel.',                  icon:'📡', raised:84800,  goal:200000,  tier:[51,251,501,1100]    }
  ];
  res.render('daan', {
    causes, page: 'daan',
    success:      req.session.donationSuccess || null,
    lastDonation: req.session.lastDonation || null,
    formatDate
  });
  req.session.donationSuccess = null;
  req.session.lastDonation    = null;
});

app.post('/daan', async (req, res) => {
  const { name, cause_id, cause_name, amount, custom_amount, pan } = req.body;
  const finalAmount = parseInt(custom_amount) || parseInt(amount);
  if (!name || !cause_id || !finalAmount) return res.redirect('/daan?error=missing');
  try {
    const donation = await Donation.create({
      name, cause_id, cause_name,
      amount: finalAmount,
      pan:    pan || null
    });
    req.session.donationSuccess = true;
    req.session.lastDonation    = {
      receiptNo:  donation.receiptNo,
      name:       donation.name,
      cause_name: donation.cause_name,
      amount:     donation.amount,
      timestamp:  donation.createdAt
    };
  } catch (err) {
    console.error('Donation error:', err.message);
  }
  res.redirect('/daan');
});

// ── ABOUT ────────────────────────────────────────────────
app.get('/about', (req, res) => res.render('about', { page: 'about', formatDate }));

// ── API ──────────────────────────────────────────────────
app.get('/api/streams',   (req, res) => res.json(streams));
app.get('/api/festivals', (req, res) => res.json(festivals));
app.get('/api/panchang',  (req, res) => res.json(getPanchang(new Date())));

app.get('/api/stats', async (req, res) => {
  const [sankalpCount, donationAgg, pujaCount] = await Promise.all([
    Sankalp.countDocuments(),
    Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    PujaBooking.countDocuments()
  ]);
  res.json({
    sankalpCount:   sankalpCount + 18470,
    totalDonations: (donationAgg[0]?.total || 0) + 1847500,
    pujaBookings:   pujaCount,
    liveViewers:    streams.filter(s => s.isLive).reduce((s, st) => s + st.viewers, 0)
  });
});

// 404
app.use((req, res) => res.status(404).render('404', { page: '' }));

// ── START ─────────────────────────────────────────────────
async function start() {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🕉️  Mandir.World → http://localhost:${PORT}  [${isProd ? 'production' : 'development'}]\n`);
  });
}

start();
