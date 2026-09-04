require('dotenv').config();

const Razorpay              = require('razorpay');
const crypto                = require('crypto');
const MongoStore            = require('connect-mongo');
const bcrypt                = require('bcrypt');
const { sendDaanReceipt, sendDaanSMS, sendSankalpConfirmation, sendPujaConfirmation, sendLoginOtp, verifyEmailConfig } = require('./utils/notify');
const { fetchLiveViewers } = require('./utils/youtube');
const liveViewers = require('./utils/liveViewers');

const express    = require('express');
const bodyParser = require('body-parser');
const session    = require('express-session');
const path       = require('path');
const compression     = require('compression');
const cookieParser    = require('cookie-parser');
const rateLimit        = require('express-rate-limit');
const helmet          = require('helmet');
const { connectDB }   = require('./db/connect');
const { getPanchang } = require('./panchang');

// ── MONGOOSE MODELS ──────────────────────────────────────
const Sankalp     = require('./models/Sankalp');
const Donation    = require('./models/Donation');
const PujaBooking = require('./models/PujaBooking');
const Festival    = require('./models/Festival');
const Stream      = require('./models/Stream');
const PujaModel   = require('./models/Puja');
const City        = require('./models/City');
const User        = require('./models/User');
const Otp         = require('./models/Otp');
const Story       = require('./models/Story');

const app    = express();
const PORT   = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── RAZORPAY ──────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── SECURITY & COMPRESSION ───────────────────────────────
app.use(compression());
app.use(cookieParser());
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

// ── RATE LIMITING ─────────────────────────────────────────
// Applied only to endpoints where abuse actually costs money or risks
// security (OTP sends, payment order creation, admin login). Deliberately
// NOT applied to the live-viewer heartbeat/poll endpoints — those are
// legitimately high-frequency by design (every 15-20s per open tab) and
// throttling them would break the live viewer counter for real visitors.

// OTP requests — each one costs a real Resend API call. 5 per 15 min per IP.
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many code requests. Please wait a few minutes and try again.' }
});

// OTP verification attempts — guards against brute-forcing codes across many emails.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' }
});

// Payment order creation — each call hits Razorpay's API.
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many payment attempts. Please wait a few minutes and try again.' }
});

// Sankalp submissions — cheap to attempt, but should still not be scriptable at will.
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: 'Too many submissions from this device. Please wait a few minutes and try again.'
});

// Admin login — brute-force protection on top of the existing bcrypt delay.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});

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
  saveUninitialized: false,
  // Store sessions in MongoDB — survives server restarts and Railway redeploys
  store: process.env.MONGODB_URI
    ? MongoStore.create({
        mongoUrl:   process.env.MONGODB_URI,
        dbName:     'mandirworld',
        collectionName: 'sessions',
        ttl:        24 * 60 * 60  // 24 hours in seconds
      })
    : undefined,   // falls back to in-memory in dev without DB
  cookie: { secure: isProd, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── DATA — loaded purely from MongoDB ────────────────────
// JSON files are only used by scripts/seed.js (one-time setup)
// Server always reads from DB; run 'npm run seed' once to populate
let festivals = [];
let streams   = [];
let pujas     = [];
let citiesMap = {};

// ── HELPERS ──────────────────────────────────────────────
// All date/time formatting below explicitly sets timeZone: 'Asia/Kolkata'.
// Without this, Node renders dates in the SERVER's timezone (UTC on
// Render/Railway), not IST — 'en-IN' only controls formatting style
// (comma placement, month names), not the actual timezone used.

function formatDate(d) {
  if (!d || d === 'daily') return 'Daily';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata'
  });
}

// Full date + time, always IST, always labelled — e.g. "30 Aug 2026, 2:03 PM IST"
function formatDateTimeIST(d) {
  if (!d) return '—';
  const formatted = new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata'
  });
  return `${formatted} IST`;
}

// Time only, always IST, always labelled — e.g. "2:03 PM IST"
function formatTimeIST(d) {
  if (!d) return '—';
  const formatted = new Date(d).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  });
  return `${formatted} IST`;
}

function daysUntil(dateStr) {
  if (!dateStr || dateStr === 'daily') return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// Haversine distance in km between two lat/lon points
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Shipping cost slab based on distance
function calcShipping(km) {
  if (km <  100)  return 0;    // same city / nearby — free
  if (km <  500)  return 99;
  if (km < 1000)  return 149;
  if (km < 2000)  return 199;
  return 249;
}

// Enrich every festival with live isPast/isUpcoming based on TODAY's date
// This runs at request time — never goes stale
function enrichFestivals(list) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return list.map(f => {
    if (f.isDaily) return { ...f };
    const d = new Date(f.date);
    d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - now) / 86400000);
    return {
      ...f,
      isPast:     diff < 0,
      isUpcoming: diff >= 0,
      daysAway:   diff >= 0 ? diff : null
    };
  });
}

// Attach real combined view counts (platform concurrent viewers + YouTube LIVE viewers) to a list of streams.
// Both numbers are "right now" counts — nobody watching = 0, not a running total.
async function attachRealViews(streamList) {
  return Promise.all(streamList.map(async s => {
    const platformConcurrent = liveViewers.getConcurrentCount(s.id);
    const youtubeLiveViewers = (s.isLive && process.env.YOUTUBE_API_KEY)
      ? await fetchLiveViewers(s.youtubeVideoId)
      : 0;
    return { ...s, realViews: platformConcurrent + youtubeLiveViewers };
  }));
}

// ── ROUTES ───────────────────────────────────────────────

// Expose the logged-in user (if any) to every view as `currentUser`.
// This never blocks anything — pages render exactly the same for logged-out
// visitors, this just adds a small "Sign in" vs "My Account" link.
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.formatDateTimeIST = formatDateTimeIST;
  res.locals.formatTimeIST     = formatTimeIST;
  if (req.session?.userId) {
    try {
      res.locals.currentUser = await User.findById(req.session.userId).lean();
    } catch (err) { /* ignore — treat as logged out */ }
  }
  next();
});

// ── AUTH: EMAIL + OTP (no passwords) ─────────────────────

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

// Step 1 — request a code sent to their email
app.post('/api/auth/request-otp', otpRequestLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
    }

    // Rate-limit: don't allow more than 1 OTP request per email per 60 seconds
    const recent = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (recent && (Date.now() - recent.createdAt.getTime()) < 60 * 1000) {
      return res.status(429).json({ ok: false, error: 'Please wait a moment before requesting another code.' });
    }

    const code = generateOtp();
    await Otp.create({ email, code });

    const sent = await sendLoginOtp({ email, code });
    if (!sent) return res.status(500).json({ ok: false, error: 'Could not send code. Please try again.' });

    res.json({ ok: true });
  } catch (err) {
    console.error('OTP request error:', err.message);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

// Step 2 — verify the code, create/find the user, log them in
app.post('/api/auth/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const code  = (req.body.code  || '').trim();
    if (!email || !code) return res.status(400).json({ ok: false, error: 'Email and code are required.' });

    const otpDoc = await Otp.findOne({ email }).sort({ createdAt: -1 });
    if (!otpDoc) return res.status(400).json({ ok: false, error: 'Code expired or not found. Please request a new one.' });

    if (otpDoc.attempts >= 5) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ ok: false, error: 'Too many attempts. Please request a new code.' });
    }

    if (otpDoc.code !== code) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ ok: false, error: 'Incorrect code. Please try again.' });
    }

    // Correct — consume the OTP and log them in
    await Otp.deleteMany({ email });

    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email });
    user.lastLoginAt = new Date();
    await user.save();

    req.session.userId = user._id.toString();
    res.json({ ok: true, redirect: '/account' });
  } catch (err) {
    console.error('OTP verify error:', err.message);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.userId = null;
  res.json({ ok: true });
});

app.get('/login', (req, res) => {
  if (res.locals.currentUser) return res.redirect('/account');
  res.render('login', { page: 'login' });
});

// ── ACCOUNT — sankalp/donation/booking history for the logged-in user ────
app.get('/account', async (req, res) => {
  if (!res.locals.currentUser) return res.redirect('/login');
  const email = res.locals.currentUser.email;

  const [sankalpas, donations, bookings] = await Promise.all([
    Sankalp.find({ email }).sort({ createdAt: -1 }).lean(),
    Donation.find({ email }).sort({ createdAt: -1 }).lean(),
    PujaBooking.find({ email }).sort({ createdAt: -1 }).lean()
  ]);

  res.render('account', {
    user: res.locals.currentUser,
    sankalpas, donations, bookings,
    page: 'account', formatDate
  });
});

// Health check
app.get('/health', async (req, res) => {
  const sankalpCount  = await Sankalp.countDocuments();
  const donationCount = await Donation.countDocuments();
  res.json({ status: 'ok', sankalpCount, donationCount, ts: new Date().toISOString() });
});

// ── HOME ─────────────────────────────────────────────────
app.get('/', async (req, res) => {
  const panchang          = getPanchang(new Date());
  const liveStreamsRaw    = streams.filter(s => s.isLive).slice(0, 4);
  const liveStreams       = await attachRealViews(liveStreamsRaw);
  const enrichedHome      = enrichFestivals(festivals);
  const upcomingFestivals = enrichedHome
    .filter(f => f.isUpcoming && !f.isDaily)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);
  const nextBig      = upcomingFestivals[0] || null;
  const dailyEvents  = enrichedHome.filter(f => f.isDaily);
  const popularPujas = pujas.filter(p => p.popular).slice(0, 4);

  // Live counts from MongoDB
  const [sankalpCount, donationAgg, watchesAgg] = await Promise.all([
    Sankalp.countDocuments(),
    Donation.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    Stream.aggregate([{ $group: { _id: null, total: { $sum: '$totalWatches' } } }])
  ]);
  const totalSankalpCount = sankalpCount; // real count only — no fabricated baseline
  const totalDonations    = donationAgg[0]?.total || 0; // real count only — no fabricated baseline
  const totalWatches      = watchesAgg[0]?.total || 0; // real count only — no fabricated baseline
  const nextSankalpNumber = sankalpCount + 1; // real next sequence number, for the certificate preview

  // Featured devotee stories for the homepage teaser — falls back to any
  // approved story if nothing is marked featured yet, so the section isn't
  // empty the moment the feature ships.
  let featuredStories = await Story.find({ status: 'approved', featured: true }).sort({ createdAt: -1 }).limit(3).lean();
  if (featuredStories.length === 0) {
    featuredStories = await Story.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(3).lean();
  }

  res.render('index', {
    panchang, liveStreams, upcomingFestivals, nextBig, dailyEvents, featuredStories,
    popularPujas, totalSankalpCount, totalDonations, totalWatches, nextSankalpNumber, formatDate, daysUntil, page: 'home'
  });
});

// ── DARSHAN ──────────────────────────────────────────────
app.get('/darshan', async (req, res) => {
  const city     = req.query.city || '';
  const filtered = city ? streams.filter(s => s.city.toLowerCase() === city.toLowerCase()) : streams;
  const cities   = [...new Set(streams.map(s => s.city))];
  const enrichedStreams = await attachRealViews(filtered);
  res.render('darshan', { streams: enrichedStreams, allStreams: streams, cities, selectedCity: city, page: 'darshan', formatDate });
});

app.get('/darshan/:id', async (req, res) => {
  const stream = streams.find(s => s.id === req.params.id);
  if (!stream) return res.redirect('/darshan');
  const relatedStreams = streams.filter(s => s.id !== stream.id).slice(0, 3);

  // Real combined view count for first paint (platform concurrent + YouTube LIVE viewers).
  // The actual "I'm watching" registration happens client-side via heartbeat —
  // see /api/streams/:id/heartbeat — so this is just a snapshot for the initial render.
  let initialViews = 0;
  try {
    const platformConcurrent = liveViewers.getConcurrentCount(stream.id);
    const youtubeLiveViewers = (stream.isLive && process.env.YOUTUBE_API_KEY)
      ? await fetchLiveViewers(stream.youtubeVideoId)
      : 0;
    initialViews = platformConcurrent + youtubeLiveViewers;
  } catch (err) {
    console.error('Initial view count error:', err.message);
  }

  res.render('stream', { stream, relatedStreams, page: 'darshan', formatDate, initialViews });
});

// Combined view count: platform concurrent viewers (real-time) + YouTube LIVE viewers.
// Client polls this every ~20s to show a live-updating number.
// Real activity feed for the stream page — pulls actual sankalp/donation
// records instead of fabricated names+messages. First name only, since
// full names weren't collected with public-display in mind. Prioritizes
// donations made ON this specific stream, falls back to recent site-wide
// activity if this stream doesn't have enough on its own yet.
app.get('/api/streams/:id/activity', async (req, res) => {
  try {
    const streamId = req.params.id;

    const [streamDonations, recentDonations, recentSankalpas] = await Promise.all([
      Donation.find({ streamId, 'payment.status': 'paid' }).sort({ createdAt: -1 }).limit(8).lean(),
      Donation.find({ 'payment.status': 'paid' }).sort({ createdAt: -1 }).limit(8).lean(),
      Sankalp.find().sort({ createdAt: -1 }).limit(8).lean()
    ]);

    // Prefer this stream's own donations; top up with recent site-wide ones if sparse
    const seenIds = new Set();
    const donations = [];
    for (const d of [...streamDonations, ...recentDonations]) {
      const id = d._id.toString();
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      donations.push(d);
      if (donations.length >= 8) break;
    }

    const firstName = (fullName) => (fullName || 'A devotee').trim().split(' ')[0];

    const items = [
      ...donations.map(d => ({
        type: 'daan',
        name: firstName(d.name),
        text: `gave ₹${Number(d.amount).toLocaleString('en-IN')} to ${d.cause_name}`,
        time: d.createdAt
      })),
      ...recentSankalpas.map(s => ({
        type: 'sankalp',
        name: firstName(s.name),
        text: 'recorded a sankalp',
        time: s.createdAt
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 8);

    res.json({ items });
  } catch (err) {
    console.error('Activity fetch error:', err.message);
    res.json({ items: [] });
  }
});

app.get('/api/streams/:id/views', async (req, res) => {
  try {
    const stream = streams.find(s => s.id === req.params.id);
    if (!stream) return res.status(404).json({ error: 'Stream not found' });

    const platformConcurrent = liveViewers.getConcurrentCount(stream.id);

    const youtubeLiveViewers = (stream.isLive && process.env.YOUTUBE_API_KEY)
      ? await fetchLiveViewers(stream.youtubeVideoId)
      : 0;

    res.json({
      platformConcurrent,
      youtubeLiveViewers,
      total: platformConcurrent + youtubeLiveViewers,
      youtubeConfigured: !!process.env.YOUTUBE_API_KEY
    });
  } catch (err) {
    console.error('View count fetch error:', err.message);
    res.status(500).json({ error: 'Could not fetch view count' });
  }
});

// Heartbeat: sent every ~15s while someone has a stream page open.
// This is what actually registers them as "watching right now."
app.post('/api/streams/:id/heartbeat', (req, res) => {
  const { viewerId } = req.body;
  const isNewSession = liveViewers.heartbeat(req.params.id, viewerId);

  // Only bump the permanent lifetime counter once per session (not every 15s ping).
  // Fire-and-forget — don't make the viewer wait on a DB write for their heartbeat.
  if (isNewSession) {
    Stream.findOneAndUpdate({ id: req.params.id }, { $inc: { totalWatches: 1 } })
      .catch(err => console.error('totalWatches increment failed:', err.message));
  }

  res.json({ ok: true });
});

// Leave: sent via sendBeacon when the tab closes or the user navigates away.
// Immediately removes them instead of waiting for the heartbeat to time out.
app.post('/api/streams/:id/leave', (req, res) => {
  liveViewers.leave(req.params.id, req.body?.viewerId);
  res.json({ ok: true });
});

// ── TEMPLES ──────────────────────────────────────────────
app.get('/temples', async (req, res) => {
  const enrichedStreams = await attachRealViews(streams);
  const byCity = {};
  enrichedStreams.forEach(s => { if (!byCity[s.city]) byCity[s.city] = []; byCity[s.city].push(s); });
  const cities = Object.keys(byCity).sort();
  res.render('temples', { streams: enrichedStreams, byCity, cities, page: 'temples', formatDate });
});

// ── PUJA SEWA ─────────────────────────────────────────────
app.get('/puja-sewa', async (req, res) => {
  const upcomingFestivals = enrichFestivals(festivals)
    .filter(f => f.isUpcoming && !f.isDaily)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  // Handle redirect from Razorpay payment success — look up the real saved
  // booking by its bookingNo instead of rebuilding a partial one from URL
  // query params (which was silently dropping occasion/date/phone before).
  let lastBooking = req.session.lastPujaBooking || null;
  if (req.query.success === '1' && req.query.booking) {
    try {
      const saved = await PujaBooking.findOne({ bookingNo: req.query.booking }).lean();
      lastBooking = saved || {
        bookingNo: req.query.booking, puja_name: req.query.puja,
        devotee_name: req.query.name, amount: req.query.amount, status: 'Confirmed'
      };
    } catch (err) {
      console.error('Booking lookup failed:', err.message);
    }
  }

  res.render('puja-sewa', {
    pujas, upcomingFestivals, page: 'puja',
    success:     (req.query.success === '1') || req.session.pujaSuccess || null,
    lastBooking,
    formatDate, daysUntil
  });
  req.session.pujaSuccess     = null;
  req.session.lastPujaBooking = null;
});

// ── SANKALP ───────────────────────────────────────────────
app.get('/sankalp', (req, res) => {
  const activeEvents = enrichFestivals(festivals).filter(f => f.isLive || f.isUpcoming || f.isDaily).slice(0, 8);
  res.render('sankalp', {
    events: activeEvents, page: 'sankalp',
    success:      req.session.sankalpSuccess || null,
    lastSankalp:  req.session.lastSankalp || null,
    formatDate
  });
  req.session.sankalpSuccess = null;
  req.session.lastSankalp    = null;
});

app.post('/sankalp', formLimiter, async (req, res) => {
  const { name, gotra, wish, event, city, phone, email } = req.body;
  if (!name || !wish || !event) return res.redirect('/sankalp?error=missing');
  if (!phone || !/^\d{10}$/.test(phone)) return res.redirect('/sankalp?error=phone');
  try {
    const sankalp = await Sankalp.create({
      name, gotra, wish, event,
      city:  city  || 'Varanasi',
      phone: phone || null,
      email: email || null
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
    // Send email + SMS confirmation (non-blocking)
    sendSankalpConfirmation({
      name, phone, email,
      event, wish,
      number: sankalp.number,
      city:   sankalp.city
    }).catch(() => {});
  } catch (err) {
    console.error('Sankalp error:', err.message);
  }
  res.redirect('/sankalp');
});

// ── CALENDAR ─────────────────────────────────────────────
app.get('/calendar', (req, res) => {
  const { month = '', category = '' } = req.query;
  const enriched    = enrichFestivals(festivals);
  let filtered = enriched.filter(f => !f.isDaily);
  if (month)    filtered = filtered.filter(f => f.month === month);
  if (category) filtered = filtered.filter(f => f.category === category);
  const months      = [...new Set(enriched.filter(f => f.month !== 'Daily').map(f => f.month))];
  const categories  = [...new Set(enriched.map(f => f.category))];
  const dailyEvents = enriched.filter(f => f.isDaily);
  const upcoming    = enriched.filter(f => f.isUpcoming && !f.isDaily).sort((a, b) => new Date(a.date) - new Date(b.date));
  const past        = enriched.filter(f => f.isPast && !f.isDaily);
  res.render('calendar', {
    festivals: filtered, upcoming, past, dailyEvents, months, categories,
    selectedMonth: month, selectedCategory: category, page: 'calendar', formatDate, daysUntil
  });
});

app.get('/calendar/:id', (req, res) => {
  const enriched = enrichFestivals(festivals);
  const festival = enriched.find(f => f.id === req.params.id);
  if (!festival) return res.redirect('/calendar');
  const related = enriched.filter(f =>
    f.id !== festival.id && !f.isDaily && (f.deity === festival.deity || f.category === festival.category)
  ).slice(0, 3);
  res.render('festival-detail', { festival, related, page: 'calendar', formatDate, daysUntil });
});

// ── DAAN ─────────────────────────────────────────────────
app.get('/daan', async (req, res) => {
  // Standard tiers (all causes): 11, 21, 51, 101, 251
  // Special tiers (coming after temple partnerships): 1001, 3001+ship, 4001+ship
  const STANDARD_TIERS = [11, 21, 51, 101, 251];
  const SPECIAL_TIERS  = [
    { amount: 1001, type: 'sankalp', label: 'Personalised Sankalp', desc: 'Pandit includes your name in the puja' },
    { amount: 3001, type: 'prasad',  label: 'Prasad Dispatch',      desc: 'Blessed prasad delivered to your address (+shipping)' },
    { amount: 4001, type: 'premium', label: 'Name + Prasad',        desc: 'Your name in puja & prasad dispatch (+shipping)' }
  ];

  const causes = [
    { id:'gau-seva',   name:'Gau Seva',             hindi:'गौ सेवा',           description:'Support the care and feeding of sacred cows at verified goshalas in Varanasi and Mathura.',   icon:'🐄', raised:384600, goal:1000000, pujaCity:'Varanasi' },
    { id:'annadaan',   name:'Annadaan at Kashi',    hindi:'अन्नदान',           description:'Fund daily meals for pilgrims, priests, and the underprivileged at the ghats of Varanasi.',   icon:'🍛', raised:241200, goal:500000,  pujaCity:'Varanasi' },
    { id:'ganga-seva', name:'Ganga Safai Abhiyan',  hindi:'गंगा सफाई',         description:'Support ghat cleaning drives and Ganga river conservation efforts.',                           icon:'🌊', raised:161900, goal:300000,  pujaCity:'Haridwar' },
    { id:'vidya-daan', name:'Vidya Daan',            hindi:'विद्या दान',        description:'Provide education, books, and scholarships to children near temple towns.',                     icon:'📚', raised:94000,  goal:250000,  pujaCity:'Varanasi' },
    { id:'ghat-dev',   name:'Ghat Preservation',    hindi:'घाट संरक्षण',       description:'Contribute to the restoration of ancient ghats in Varanasi and Haridwar.',                     icon:'🏛️', raised:178000, goal:500000,  pujaCity:'Varanasi' },
    { id:'platform',   name:'Support Mandir.World', hindi:'मंदिर.वर्ल्ड सेवा', description:'Help us build better streams and bring darshan to those who cannot travel.',                  icon:'📡', raised:84800,  goal:200000,  pujaCity:'Varanasi' }
  ];
  // Build lastDonation from the real saved record (Razorpay redirect) or session fallback.
  // Looking it up by receiptNo instead of rebuilding from query params avoids
  // silently dropping fields (PAN, prasad info, real timestamp) — same class
  // of bug that was hiding occasion/date/phone on the puja booking receipt.
  let lastDonation = req.session.lastDonation || null;
  if (req.query.success === '1' && req.query.receipt) {
    try {
      const saved = await Donation.findOne({ receiptNo: req.query.receipt }).lean();
      lastDonation = saved
        ? { ...saved, timestamp: saved.createdAt } // template expects .timestamp, DB has .createdAt
        : { receiptNo: req.query.receipt, name: req.query.name,
            amount: Number(req.query.amount) / 100, cause_name: req.query.cause,
            timestamp: new Date().toISOString() };
    } catch (err) {
      console.error('Donation lookup failed:', err.message);
    }
  }

  res.render('daan', {
    causes, STANDARD_TIERS, SPECIAL_TIERS, cities: citiesMap, page: 'daan',
    success:      (req.query.success === '1') || req.session.donationSuccess || null,
    lastDonation,
    formatDate
  });
  req.session.donationSuccess = null;
  req.session.lastDonation    = null;
});

app.post('/daan', async (req, res) => {
  const { name, phone, email, cause_id, cause_name, amount, custom_amount, pan,
          tier_type, userLat, userLon, userCity, userState } = req.body;
  const finalAmount = parseInt(custom_amount) || parseInt(amount);
  if (!name || !cause_id || !finalAmount) return res.redirect('/daan?error=missing');
  try {
    const donation = await Donation.create({
      name, phone: phone || null, email: email || null,
      cause_id, cause_name,
      amount:    finalAmount,
      pan:       pan || null,
      tier_type: tier_type || 'basic',
      userLocation: {
        lat:   userLat   ? parseFloat(userLat)   : null,
        lon:   userLon   ? parseFloat(userLon)   : null,
        city:  userCity  || null,
        state: userState || null
      }
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

// ── DEVOTEE STORIES (diaspora testimonials) ──────────────
app.get('/stories', async (req, res) => {
  const stories = await Story.find({ status: 'approved' }).sort({ featured: -1, createdAt: -1 }).limit(60).lean();
  res.render('stories', { stories, page: 'stories' });
});

app.get('/share-your-story', (req, res) => {
  res.render('share-story', { submitted: false, page: 'share-story', error: null, formData: null });
});

app.post('/stories/submit', formLimiter, async (req, res) => {
  try {
    const { name, location, story, email, consent } = req.body;
    const formData = { name, location, story, email };

    if (!name?.trim() || !location?.trim() || !story?.trim()) {
      return res.render('share-story', { submitted: false, page: 'share-story', formData,
        error: 'Please fill in your name, location, and story.' });
    }
    if (consent !== 'yes') {
      return res.render('share-story', { submitted: false, page: 'share-story', formData,
        error: 'Please check the consent box to confirm you\'re okay sharing your story publicly.' });
    }

    await Story.create({
      name: name.trim(), location: location.trim(), story: story.trim().slice(0, 1200),
      email: email?.trim() || null, consent: true
    });
    res.render('share-story', { submitted: true, page: 'share-story', error: null, formData: null });
  } catch (err) {
    console.error('Story submission error:', err.message);
    res.render('share-story', { submitted: false, page: 'share-story', formData: req.body,
      error: 'Something went wrong on our end. Please try again in a moment.' });
  }
});

app.get('/privacy', (req, res) => res.render('privacy', { page: 'privacy' }));
app.get('/terms',   (req, res) => res.render('terms',   { page: 'terms' }));
app.get('/refund',  (req, res) => res.render('refund',  { page: 'refund' }));

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
  const liveStreamsList = streams.filter(s => s.isLive);
  const enrichedLive = await attachRealViews(liveStreamsList);
  const liveViewers = enrichedLive.reduce((sum, s) => sum + (s.realViews || 0), 0);
  res.json({
    sankalpCount:   sankalpCount, // real count only — no fabricated baseline
    totalDonations: donationAgg[0]?.total || 0, // real count only — no fabricated baseline
    pujaBookings:   pujaCount,
    liveViewers
  });
});

// ── STREAM DAAN API (called from stream page JS modal) ────
app.post('/api/daan/stream', async (req, res) => {
  try {
    const { name, phone, email, pan, amount, streamId, streamCity, cause_id, cause_name, prasad, userLocation } = req.body;

    if (!name || !amount || amount < 10) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ ok: false, error: 'Valid 10-digit mobile number is required' });
    }

    const donation = await Donation.create({
      name:        name.trim(),
      phone:       phone.trim(),
      email:       email?.trim() || null,
      pan:         pan?.trim()   || null,
      cause_id:    cause_id    || streamId  || 'stream-daan',
      cause_name:  cause_name  || `Live Daan — ${streamCity || 'Temple'}`,
      amount:      Number(amount),
      streamId:    streamId   || null,
      streamCity:  streamCity || null,
      userLocation: userLocation ? {
        lat:   userLocation.lat   || null,
        lon:   userLocation.lon   || null,
        city:  userLocation.city  || null,
        state: userLocation.state || null
      } : {},
      prasad: {
        requested: !!(prasad && prasad.requested),
        address1:  prasad?.address1  || null,
        address2:  prasad?.address2  || null,
        city:      prasad?.city      || null,
        pincode:   prasad?.pincode   || null,
        phone:     prasad?.phone     || null,
      }
    });

    res.json({
      ok:        true,
      receiptNo: donation.receiptNo,
      name:      donation.name,
      amount:    donation.amount,
      cause:     donation.cause_name,
      timestamp: donation.createdAt
    });

  } catch (err) {
    console.error('Stream daan error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not save donation' });
  }
});

// ── SHIPPING CALCULATOR ──────────────────────────────────
app.post('/api/shipping', (req, res) => {
  const { userLat, userLon, pujaCity } = req.body;
  if (!userLat || !userLon || !pujaCity) {
    return res.json({ shippingCost: 149, distanceKm: null, note: 'Location unavailable — standard rate applied' });
  }
  const dest = citiesMap[pujaCity];
  if (!dest) {
    return res.json({ shippingCost: 149, distanceKm: null, note: 'City not in database' });
  }
  const km   = Math.round(haversineKm(parseFloat(userLat), parseFloat(userLon), dest.lat, dest.lon));
  const cost = calcShipping(km);
  res.json({ shippingCost: cost, distanceKm: km, pujaCity, note: cost === 0 ? 'Free — nearby delivery' : null });
});

// ── ADMIN ─────────────────────────────────────────────────

// Auth middleware
function requireAdmin(req, res, next) {
  if (req.session.adminLoggedIn) return next();
  res.redirect('/admin/login');
}

// Login
app.get('/admin/login', (req, res) => {
  if (req.session.adminLoggedIn) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

app.post('/admin/login', adminLoginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USER;
  // Support both plain text (legacy) and bcrypt hash in ADMIN_PASS
  let validPass = false;
  const storedPass = process.env.ADMIN_PASS || '';
  if (storedPass.startsWith('$2b$')) {
    validPass = await bcrypt.compare(password, storedPass);
  } else {
    validPass = password === storedPass;  // plain text fallback
  }
  if (validUser && validPass) {
    req.session.adminLoggedIn = true;
    return res.redirect('/admin');
  }
  // Add a small delay to prevent brute-force
  await new Promise(r => setTimeout(r, 800));
  res.render('admin/login', { error: 'Invalid username or password' });
});

app.get('/admin/logout', (req, res) => {
  req.session.adminLoggedIn = false;
  res.redirect('/admin/login');
});

// Dashboard
// Quick self-diagnostic: send a real test email to any address, right from the admin panel.
// Visit /admin/test-email?to=you@example.com while logged into admin.
app.get('/admin/test-email', requireAdmin, async (req, res) => {
  const to = req.query.to;
  if (!to) return res.json({ ok: false, error: 'Add ?to=your@email.com to the URL.' });

  const sent = await sendLoginOtp({ email: to, code: '000000' });
  res.json({
    ok: sent,
    message: sent
      ? `Test email sent to ${to} — check the inbox (and spam folder).`
      : 'Send failed — check your logs for the exact error, or RESEND_API_KEY may be missing/wrong in your host\'s environment variables.'
  });
});

app.get('/admin', requireAdmin, async (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);

  const [donationAgg, donationCount, paidCount, recentDonations,
         bookingCount, bookingToday, recentBookings,
         sankalpCount, sankalpToday, recentSankalpas] = await Promise.all([
    Donation.aggregate([{ $match: { 'payment.status': 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Donation.countDocuments(),
    Donation.countDocuments({ 'payment.status': 'paid' }),
    Donation.find().sort({ createdAt: -1 }).limit(8).lean(),
    PujaBooking.countDocuments(),
    PujaBooking.countDocuments({ createdAt: { $gte: today } }),
    PujaBooking.find().sort({ createdAt: -1 }).limit(6).lean(),
    Sankalp.countDocuments(),
    Sankalp.countDocuments({ createdAt: { $gte: today } }),
    Sankalp.find().sort({ createdAt: -1 }).limit(6).lean()
  ]);

  const totalRevenue = donationAgg[0]?.total || 0;
  const liveCount    = streams.filter(s => s.isLive).length;
  const enrichedLiveStreams = await attachRealViews(streams.filter(s => s.isLive));
  const liveViewers  = enrichedLiveStreams.reduce((a, s) => a + (s.realViews || 0), 0);

  res.render('admin/dashboard', {
    totalRevenue, donationCount, paidCount, recentDonations,
    bookingCount, bookingToday, recentBookings,
    sankalpCount, sankalpToday, recentSankalpas,
    liveCount, liveViewers
  });
});

// Donations
app.get('/admin/donations', requireAdmin, async (req, res) => {
  const donations = await Donation.find().sort({ createdAt: -1 }).limit(200).lean();
  res.render('admin/donations', { donations });
});

// Puja Bookings
app.get('/admin/bookings', requireAdmin, async (req, res) => {
  const bookings = await PujaBooking.find().sort({ createdAt: -1 }).limit(200).lean();
  res.render('admin/bookings', { bookings });
});

app.post('/admin/bookings/:id/status', requireAdmin, async (req, res) => {
  await PujaBooking.findByIdAndUpdate(req.params.id, { status: req.body.status });
  res.redirect('/admin/bookings');
});

// Sankalpas
app.get('/admin/sankalpas', requireAdmin, async (req, res) => {
  const sankalpas = await Sankalp.find().sort({ createdAt: -1 }).limit(200).lean();
  res.render('admin/sankalpas', { sankalpas });
});

// ── STORIES (moderation) ──────────────────────────────────
app.get('/admin/stories', requireAdmin, async (req, res) => {
  const stories = await Story.find().sort({ createdAt: -1 }).limit(200).lean();
  res.render('admin/stories', { stories });
});

app.post('/admin/stories/:id/approve', requireAdmin, async (req, res) => {
  await Story.findByIdAndUpdate(req.params.id, { status: 'approved' });
  res.redirect('/admin/stories');
});

app.post('/admin/stories/:id/reject', requireAdmin, async (req, res) => {
  await Story.findByIdAndUpdate(req.params.id, { status: 'rejected' });
  res.redirect('/admin/stories');
});

app.post('/admin/stories/:id/toggle-featured', requireAdmin, async (req, res) => {
  const s = await Story.findById(req.params.id);
  await Story.findByIdAndUpdate(req.params.id, { featured: !s.featured });
  res.redirect('/admin/stories');
});

app.post('/admin/stories/:id/delete', requireAdmin, async (req, res) => {
  await Story.findByIdAndDelete(req.params.id);
  res.redirect('/admin/stories');
});

// Streams
app.get('/admin/streams', requireAdmin, async (req, res) => {
  const dbStreams = await Stream.find().sort({ city: 1 }).lean();
  const enriched = dbStreams.map(s => ({
    ...s,
    concurrentViewers: liveViewers.getConcurrentCount(s.id)
  }));
  res.render('admin/streams', { streams: enriched });
});

app.get('/admin/streams/new', requireAdmin, (req, res) => {
  res.render('admin/stream-form', { stream: null });
});

app.get('/admin/streams/:id/edit', requireAdmin, async (req, res) => {
  const stream = await Stream.findById(req.params.id).lean();
  if (!stream) return res.redirect('/admin/streams');
  res.render('admin/stream-form', { stream });
});

app.post('/admin/streams/new', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await Stream.create({
      id: b.id, title: b.title, hindi: b.hindi || '', city: b.city, state: b.state || '',
      location: b.location || '', description: b.description || '', schedule: b.schedule || '',
      thumbnail: b.thumbnail || '', youtubeChannelId: b.youtubeChannelId || '',
      youtubeVideoId: b.youtubeVideoId || '', deity: b.deity || '',
      tags: (b.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      isLive: b.isLive === 'on', viewers: Number(b.viewers) || 0, active: true
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Create stream error:', err.message);
  }
  res.redirect('/admin/streams');
});

app.post('/admin/streams/:id/edit', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await Stream.findByIdAndUpdate(req.params.id, {
      id: b.id, title: b.title, hindi: b.hindi || '', city: b.city, state: b.state || '',
      location: b.location || '', description: b.description || '', schedule: b.schedule || '',
      thumbnail: b.thumbnail || '', youtubeChannelId: b.youtubeChannelId || '',
      youtubeVideoId: b.youtubeVideoId || '', deity: b.deity || '',
      tags: (b.tags || '').split(',').map(t => t.trim()).filter(Boolean),
      isLive: b.isLive === 'on', viewers: Number(b.viewers) || 0
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Edit stream error:', err.message);
  }
  res.redirect('/admin/streams');
});

app.post('/admin/streams/:id/delete', requireAdmin, async (req, res) => {
  await Stream.findByIdAndDelete(req.params.id);
  await loadDataFromDB();
  res.redirect('/admin/streams');
});

app.post('/admin/streams/:id/toggle-live', requireAdmin, async (req, res) => {
  const s = await Stream.findById(req.params.id);
  await Stream.findByIdAndUpdate(req.params.id, { isLive: !s.isLive });
  await loadDataFromDB();
  res.redirect('/admin/streams');
});

app.post('/admin/streams/:id/toggle-active', requireAdmin, async (req, res) => {
  const s = await Stream.findById(req.params.id);
  await Stream.findByIdAndUpdate(req.params.id, { active: !s.active });
  await loadDataFromDB();
  res.redirect('/admin/streams');
});

// ── FESTIVALS ─────────────────────────────────────────────
app.get('/admin/festivals', requireAdmin, async (req, res) => {
  const dbFestivals = await Festival.find().sort({ date: 1 }).lean();
  res.render('admin/festivals', { festivals: dbFestivals });
});

app.get('/admin/festivals/new', requireAdmin, (req, res) => {
  res.render('admin/festival-form', { festival: null });
});

app.get('/admin/festivals/:id/edit', requireAdmin, async (req, res) => {
  const festival = await Festival.findById(req.params.id).lean();
  if (!festival) return res.redirect('/admin/festivals');
  res.render('admin/festival-form', { festival });
});

app.post('/admin/festivals/new', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await Festival.create({
      id: b.id, name: b.name, hindi: b.hindi || '', date: b.date, endDate: b.endDate || null,
      month: b.month || '', deity: b.deity || '', category: b.category || '',
      description: b.description || '', significance: b.significance || '',
      rituals: (b.rituals || '').split(',').map(r => r.trim()).filter(Boolean),
      cities: (b.cities || '').split(',').map(c => c.trim()).filter(Boolean),
      donationCauses: (b.donationCauses || '').split(',').map(c => c.trim()).filter(Boolean),
      mantra: b.mantra || '', color: b.color || '#FF6B00', icon: b.icon || '🕉️',
      isDaily: b.isDaily === 'on', active: true
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Create festival error:', err.message);
  }
  res.redirect('/admin/festivals');
});

app.post('/admin/festivals/:id/edit', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await Festival.findByIdAndUpdate(req.params.id, {
      id: b.id, name: b.name, hindi: b.hindi || '', date: b.date, endDate: b.endDate || null,
      month: b.month || '', deity: b.deity || '', category: b.category || '',
      description: b.description || '', significance: b.significance || '',
      rituals: (b.rituals || '').split(',').map(r => r.trim()).filter(Boolean),
      cities: (b.cities || '').split(',').map(c => c.trim()).filter(Boolean),
      donationCauses: (b.donationCauses || '').split(',').map(c => c.trim()).filter(Boolean),
      mantra: b.mantra || '', color: b.color || '#FF6B00', icon: b.icon || '🕉️',
      isDaily: b.isDaily === 'on'
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Edit festival error:', err.message);
  }
  res.redirect('/admin/festivals');
});

app.post('/admin/festivals/:id/delete', requireAdmin, async (req, res) => {
  await Festival.findByIdAndDelete(req.params.id);
  await loadDataFromDB();
  res.redirect('/admin/festivals');
});

app.post('/admin/festivals/:id/toggle-active', requireAdmin, async (req, res) => {
  const f = await Festival.findById(req.params.id);
  await Festival.findByIdAndUpdate(req.params.id, { active: !f.active });
  await loadDataFromDB();
  res.redirect('/admin/festivals');
});

// Bulk JSON upload — for adding a full year's festival calendar at once
app.get('/admin/festivals/bulk-upload', requireAdmin, (req, res) => {
  res.render('admin/festival-bulk', { result: null, error: null });
});

app.post('/admin/festivals/bulk-upload', requireAdmin, async (req, res) => {
  try {
    const parsed = JSON.parse(req.body.jsonData);
    if (!Array.isArray(parsed)) throw new Error('JSON must be an array of festival objects');

    let inserted = 0, updated = 0;
    for (const f of parsed) {
      if (!f.id || !f.name || !f.date) continue;
      const existing = await Festival.findOne({ id: f.id });
      const doc = {
        id: f.id, name: f.name, hindi: f.hindi || '', date: f.date, endDate: f.endDate || null,
        month: f.month || '', deity: f.deity || '', category: f.category || '',
        description: f.description || '', significance: f.significance || '',
        rituals: f.rituals || [], cities: f.cities || [], donationCauses: f.donationCauses || [],
        mantra: f.mantra || '', color: f.color || '#FF6B00', icon: f.icon || '🕉️',
        isDaily: !!f.isDaily, active: true
      };
      if (existing) {
        await Festival.findByIdAndUpdate(existing._id, doc);
        updated++;
      } else {
        await Festival.create(doc);
        inserted++;
      }
    }
    await loadDataFromDB();
    res.render('admin/festival-bulk', { result: { inserted, updated, total: parsed.length }, error: null });
  } catch (err) {
    res.render('admin/festival-bulk', { result: null, error: err.message });
  }
});

// ── PUJAS ─────────────────────────────────────────────────
app.get('/admin/pujas', requireAdmin, async (req, res) => {
  const dbPujas = await PujaModel.find().sort({ name: 1 }).lean();
  res.render('admin/pujas', { pujas: dbPujas });
});

app.get('/admin/pujas/new', requireAdmin, (req, res) => {
  res.render('admin/puja-form', { puja: null });
});

app.get('/admin/pujas/:id/edit', requireAdmin, async (req, res) => {
  const puja = await PujaModel.findById(req.params.id).lean();
  if (!puja) return res.redirect('/admin/pujas');
  res.render('admin/puja-form', { puja });
});

app.post('/admin/pujas/new', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await PujaModel.create({
      id: b.id, name: b.name, hindi: b.hindi || '', deity: b.deity || '',
      duration: b.duration || '', price: Number(b.price) || 0, description: b.description || '',
      includes: (b.includes || '').split(',').map(i => i.trim()).filter(Boolean),
      icon: b.icon || '🙏',
      purpose: b.purpose || '',
      notFor: (b.notFor || '').split(',').map(i => i.trim()).filter(Boolean),
      compatibleOccasions: (b.compatibleOccasions || '').split(',').map(i => i.trim()).filter(Boolean),
      popular: b.popular === 'on', prasad: b.prasad === 'on', active: true
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Create puja error:', err.message);
  }
  res.redirect('/admin/pujas');
});

app.post('/admin/pujas/:id/edit', requireAdmin, async (req, res) => {
  try {
    const b = req.body;
    await PujaModel.findByIdAndUpdate(req.params.id, {
      id: b.id, name: b.name, hindi: b.hindi || '', deity: b.deity || '',
      duration: b.duration || '', price: Number(b.price) || 0, description: b.description || '',
      includes: (b.includes || '').split(',').map(i => i.trim()).filter(Boolean),
      icon: b.icon || '🙏',
      purpose: b.purpose || '',
      notFor: (b.notFor || '').split(',').map(i => i.trim()).filter(Boolean),
      compatibleOccasions: (b.compatibleOccasions || '').split(',').map(i => i.trim()).filter(Boolean),
      popular: b.popular === 'on', prasad: b.prasad === 'on'
    });
    await loadDataFromDB();
  } catch (err) {
    console.error('Edit puja error:', err.message);
  }
  res.redirect('/admin/pujas');
});

app.post('/admin/pujas/:id/delete', requireAdmin, async (req, res) => {
  await PujaModel.findByIdAndDelete(req.params.id);
  await loadDataFromDB();
  res.redirect('/admin/pujas');
});

app.post('/admin/pujas/:id/update-price', requireAdmin, async (req, res) => {
  await PujaModel.findByIdAndUpdate(req.params.id, { price: Number(req.body.price) });
  await loadDataFromDB();
  res.redirect('/admin/pujas');
});

app.post('/admin/pujas/:id/toggle-popular', requireAdmin, async (req, res) => {
  const p = await PujaModel.findById(req.params.id);
  await PujaModel.findByIdAndUpdate(req.params.id, { popular: !p.popular });
  await loadDataFromDB();
  res.redirect('/admin/pujas');
});

app.post('/admin/pujas/:id/toggle-active', requireAdmin, async (req, res) => {
  const p = await PujaModel.findById(req.params.id);
  await PujaModel.findByIdAndUpdate(req.params.id, { active: !p.active });
  await loadDataFromDB();
  res.redirect('/admin/pujas');
});

// ── PUJA PAYMENT ROUTES ──────────────────────────────────

app.post('/api/payment/puja/create-order', paymentLimiter, async (req, res) => {
  try {
    const { puja_id, puja_name, amount, name, phone, email, occasion, preferred_date, gotra } = req.body;
    if (!amount || !name || !phone) return res.status(400).json({ ok: false, error: 'Missing required fields' });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ ok: false, error: 'Valid 10-digit mobile required' });

    const order = await razorpay.orders.create({
      amount:          Math.round(amount * 100),
      currency:        'INR',
      receipt:         `MDW-P-${Date.now()}`,
      payment_capture: 1,
      // Enough context here so the webhook can reconstruct a usable booking
      // even if the browser never confirms back to us (closed tab, crash).
      notes: {
        name, phone, email: email || '', puja_id, puja_name, occasion,
        preferred_date: preferred_date || '', gotra: gotra || ''
      }
    });

    res.json({
      ok:       true,
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      prefill:  { name, email: email || '', contact: phone }
    });
  } catch (err) {
    console.error('Puja order error:', err.message);
    res.status(500).json({ ok: false, error: 'Could not create payment order' });
  }
});

app.post('/api/payment/puja/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      name, phone, email, gotra, puja_id, puja_name,
      occasion, preferred_date, amount, ...rest
    } = req.body;

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Payment verification failed' });
    }

    // Save booking to MongoDB
    const booking = await PujaBooking.create({
      puja_id, puja_name,
      devotee_name:      name,
      gotra:             gotra || 'Not specified',
      occasion,
      preferred_date,
      phone,
      email:             email || null,
      groom_name:        rest.groom_name        || null,
      groom_gotra:       rest.groom_gotra       || null,
      bride_name:        rest.bride_name        || null,
      bride_gotra:       rest.bride_gotra       || null,
      wedding_date:      rest.wedding_date      || null,
      departed_name:     rest.departed_name     || null,
      departed_relation: rest.departed_relation || null,
      business_name:     rest.business_name     || null,
      home_address:      rest.home_address      || null,
      family_members:    rest.family_members    || null,
      date_of_birth:     rest.date_of_birth     || null,
      payment: {
        provider:  'razorpay',
        orderId:   razorpay_order_id,
        paymentId: razorpay_payment_id,
        status:    'paid'
      },
      status: 'Confirmed'
    });

    // Send confirmation notifications
    sendPujaConfirmation({
      name, phone, email,
      puja_name, occasion, preferred_date,
      bookingNo: booking.bookingNo,
      amount:    Number(amount) / 100
    }).catch(() => {});

    res.json({
      ok:        true,
      bookingNo: booking.bookingNo,
      name:      booking.devotee_name,
      puja_name: booking.puja_name,
      amount:    Number(amount) / 100
    });
  } catch (err) {
    console.error('Puja verify error:', err.message);
    res.status(500).json({ ok: false, error: 'Booking could not be saved' });
  }
});

// ── PAYMENT ROUTES ───────────────────────────────────────

// Step 1: Create Razorpay order
app.post('/api/payment/create-order', paymentLimiter, async (req, res) => {
  try {
    const { amount, name, email, phone, cause_id, cause_name, streamId, streamCity, tier_type } = req.body;

    if (!amount || amount < 10)  return res.status(400).json({ ok: false, error: 'Invalid amount' });
    if (!name)                   return res.status(400).json({ ok: false, error: 'Name is required' });
    if (!phone || !/^\d{10}$/.test(phone)) return res.status(400).json({ ok: false, error: 'Valid 10-digit mobile required' });

    const order = await razorpay.orders.create({
      amount:          Math.round(amount * 100),  // Razorpay expects paise
      currency:        'INR',
      receipt:         `MDW-${Date.now()}`,
      payment_capture: 1,  // auto-capture on authorization — moves to "paid" immediately
      notes: { name, email: email || '', phone, cause_id, cause_name: cause_name || '', streamId: streamId || '' }
    });

    res.json({
      ok:        true,
      orderId:   order.id,
      amount:    order.amount,
      currency:  order.currency,
      keyId:     process.env.RAZORPAY_KEY_ID,
      prefill: { name, email: email || '', contact: phone }
    });
  } catch (err) {
    console.error('Create order error:', err.message, err.error || '');
    res.status(500).json({ ok: false, error: 'Could not create payment order' });
  }
});

// Step 2: Verify payment signature + save donation + send receipts
app.post('/api/payment/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id, razorpay_payment_id, razorpay_signature,
      name, phone, email, pan, amount, cause_id, cause_name,
      streamId, streamCity, tier_type, prasad, userLocation
    } = req.body;

    // Verify Razorpay signature
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Payment verification failed — signature mismatch' });
    }

    // Save donation to MongoDB
    const donation = await Donation.create({
      name,
      phone:      phone || null,
      email:      email || null,
      pan:        pan   || null,
      cause_id:   cause_id   || 'daan',
      cause_name: cause_name || 'Mandir.World Daan',
      amount:     Number(amount) / 100,   // convert paise back to rupees
      tier_type:  tier_type || 'basic',
      streamId:   streamId   || null,
      streamCity: streamCity || null,
      payment: {
        provider:   'razorpay',
        orderId:    razorpay_order_id,
        paymentId:  razorpay_payment_id,
        status:     'paid'
      },
      userLocation: userLocation || {},
      prasad: prasad?.requested ? {
        requested: true,
        address1:  prasad.address1  || null,
        address2:  prasad.address2  || null,
        city:      prasad.city      || null,
        pincode:   prasad.pincode   || null,
        phone:     prasad.phone     || null,
      } : { requested: false }
    });

    // Send email + SMS confirmations (non-blocking)
    const receiptData = {
      name,
      email,
      phone,
      amount:    donation.amount,
      cause_name: donation.cause_name,
      receiptNo: donation.receiptNo,
      createdAt: donation.createdAt
    };
    sendDaanReceipt(receiptData).catch(() => {});
    sendDaanSMS(receiptData).catch(() => {});

    res.json({
      ok:        true,
      receiptNo: donation.receiptNo,
      name:      donation.name,
      amount:    donation.amount,
      cause:     donation.cause_name,
      paymentId: razorpay_payment_id
    });

  } catch (err) {
    console.error('Payment verify error:', err.message);
    res.status(500).json({ ok: false, error: 'Payment verification failed' });
  }
});

// Step 3: Razorpay webhook — the real safety net.
//
// The frontend `handler` callback (in puja-sewa.ejs / daan.ejs / stream.ejs)
// is how bookings/donations normally get saved. But if the browser tab
// closes, the connection drops, or the app crashes between "payment
// succeeded" and "we called /verify" — Razorpay still captured the money,
// and without this webhook, that transaction would vanish from our
// database with no trace of who paid or for what.
//
// IMPORTANT: this uses RAZORPAY_WEBHOOK_SECRET, a separate secret you set
// yourself in the Razorpay Dashboard (Settings → Webhooks → Add New
// Webhook) — it is NOT the same as RAZORPAY_KEY_SECRET used elsewhere.
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody    = req.body.toString();

  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error('❌  RAZORPAY_WEBHOOK_SECRET not set — webhook cannot verify signatures, rejecting.');
    return res.status(500).send('Webhook not configured');
  }

  let validSignature = false;
  try {
    validSignature = Razorpay.validateWebhookSignature(rawBody, signature, process.env.RAZORPAY_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature check threw:', err.message);
  }
  if (!validSignature) return res.status(400).send('Invalid signature');

  // Acknowledge fast — Razorpay retries on non-2xx or slow responses.
  // Do the actual work after responding so a slow DB write can't cause Razorpay to retry unnecessarily.
  res.json({ status: 'ok' });

  try {
    const event = JSON.parse(rawBody);
    if (event.event !== 'payment.captured') return;

    const payment  = event.payload.payment.entity;
    const notes    = payment.notes || {};
    const orderId  = payment.order_id;
    const isPuja   = !!notes.puja_id;
    const isDaan   = !!notes.cause_id;

    if (isPuja) {
      const existing = await PujaBooking.findOne({ 'payment.orderId': orderId });
      if (existing) return; // frontend already saved this one — nothing to do

      const booking = await PujaBooking.create({
        puja_id:        notes.puja_id,
        puja_name:      notes.puja_name || 'Puja',
        devotee_name:   notes.name || 'Unknown',
        gotra:          notes.gotra || 'Not specified',
        occasion:       notes.occasion || 'Not specified',
        preferred_date: notes.preferred_date || 'To be confirmed',
        phone:          notes.phone || payment.contact || '',
        email:          notes.email || payment.email || null,
        payment: {
          provider: 'razorpay', orderId, paymentId: payment.id,
          status: 'paid', source: 'webhook_fallback'
        },
        status: 'Confirmed'
      });

      console.warn(`⚠️  Recovered puja booking via webhook (frontend never confirmed): ${booking.bookingNo}`);
      sendPujaConfirmation({
        name: booking.devotee_name, phone: booking.phone, email: booking.email,
        puja_name: booking.puja_name, occasion: booking.occasion, preferred_date: booking.preferred_date,
        bookingNo: booking.bookingNo, amount: payment.amount / 100
      }).catch(() => {});

    } else if (isDaan) {
      const existing = await Donation.findOne({ 'payment.orderId': orderId });
      if (existing) return;

      const donation = await Donation.create({
        name:       notes.name || 'Unknown',
        phone:      notes.phone || payment.contact || null,
        email:      notes.email || payment.email || null,
        cause_id:   notes.cause_id || 'daan',
        cause_name: notes.cause_name || 'Mandir.World Daan',
        amount:     payment.amount / 100,
        streamId:   notes.streamId || null,
        payment: {
          provider: 'razorpay', orderId, paymentId: payment.id,
          status: 'paid', source: 'webhook_fallback'
        }
      });

      console.warn(`⚠️  Recovered donation via webhook (frontend never confirmed): ${donation.receiptNo}`);
      sendDaanReceipt({
        name: donation.name, email: donation.email, phone: donation.phone,
        amount: donation.amount, cause_name: donation.cause_name,
        receiptNo: donation.receiptNo, createdAt: donation.createdAt
      }).catch(() => {});
      sendDaanSMS({
        name: donation.name, phone: donation.phone,
        amount: donation.amount, receiptNo: donation.receiptNo
      }).catch(() => {});
    } else {
      console.warn('Webhook: payment.captured with unrecognized notes shape —', JSON.stringify(notes));
    }
  } catch (err) {
    // Never let a webhook processing error take down the server —
    // we already responded 200, this is just background recovery work.
    console.error('Webhook processing error:', err.message);
  }
});

// 404
app.use((req, res) => res.status(404).render('404', { page: '' }));

// ── START ─────────────────────────────────────────────────

// ── DB DATA LOADER ────────────────────────────────────────
async function loadDataFromDB() {
  // Always reads from DB — no JSON fallback
  // If collections are empty, run: npm run seed
  const [dbFestivals, dbStreams, dbPujas, dbCities] = await Promise.all([
    Festival.find({ active: true }).lean(),
    Stream.find({ active: true }).lean(),
    PujaModel.find({ active: true }).lean(),
    City.find({}).lean()
  ]);

  festivals = dbFestivals;
  streams   = dbStreams;
  pujas     = dbPujas;
  citiesMap = {};
  dbCities.forEach(c => { citiesMap[c.name] = { lat: c.lat, lon: c.lon, state: c.state }; });

  console.log(`✅  DB → ${festivals.length} festivals | ${streams.length} streams | ${pujas.length} pujas | ${dbCities.length} cities`);
}

async function start() {
  await connectDB();
  // Load data from DB (enriches the JSON defaults)
  await loadDataFromDB();
  // Refresh every 5 minutes so employee edits reflect without restart
  setInterval(loadDataFromDB, 5 * 60 * 1000);

  // Check email is actually working — logs a clear ✅/❌ right at boot
  await verifyEmailConfig();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🕉️  Mandir.World → http://localhost:${PORT}  [${isProd ? 'production' : 'development'}]\n`);
  });
}

start();
