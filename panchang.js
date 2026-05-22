// panchang.js — Vedic Panchang Calculator
// Uses Lahiri ayanamsha to convert tropical → sidereal (the main fix)

const TITHIS = [
  'Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami',
  'Shashthi','Saptami','Ashtami','Navami','Dashami',
  'Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima',
  'Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami',
  'Shashthi','Saptami','Ashtami','Navami','Dashami',
  'Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Amavasya'
];

const NAKSHATRAS = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'
];

const YOGAS = [
  'Vishkambha','Priti','Ayushman','Saubhagya','Shobhana','Atiganda','Sukarma',
  'Dhriti','Shula','Ganda','Vriddhi','Dhruva','Vyaghata','Harshana','Vajra',
  'Siddhi','Vyatipata','Variyan','Parigha','Shiva','Siddha','Sadhya','Shubha',
  'Shukla','Brahma','Indra','Vaidhriti'
];

const VARAS       = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];
const VARA_DEITIES = ['Surya Dev','Chandra Dev','Mangal Dev','Budha Dev','Brihaspati Dev','Shukra Dev','Shani Dev'];

const RASHI_NAMES = [
  'Mesha (Aries)','Vrishabha (Taurus)','Mithuna (Gemini)','Karka (Cancer)',
  'Simha (Leo)','Kanya (Virgo)','Tula (Libra)','Vrischika (Scorpio)',
  'Dhanu (Sagittarius)','Makara (Capricorn)','Kumbha (Aquarius)','Meena (Pisces)'
];

// Normalize to [0, 360)
function norm(deg) {
  return ((deg % 360) + 360) % 360;
}

// Days since J2000.0 (Jan 1.5, 2000 = Jan 1 2000 12:00 UT)
function daysSinceJ2000(date) {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - J2000) / 86400000;
}

// Lahiri ayanamsha (degrees) — increases ~50.26" per year
// At J2000.0: 23.8530° — calibrated to match Drik Panchang
function lahiriAyanamsha(n) {
  const T = n / 36525; // Julian centuries
  return 23.85 + 0.013958 * T * 100; // ~50.26" per year
}

// Tropical Sun longitude
function sunLongitudeTropical(n) {
  const L = norm(280.460 + 0.9856474 * n);
  const g = norm(357.528 + 0.9856003 * n) * Math.PI / 180;
  return norm(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
}

// Tropical Moon longitude (more accurate with perturbations)
function moonLongitudeTropical(n) {
  // Mean longitude
  const L  = norm(218.3165 + 13.17639648 * n);
  // Mean anomaly of Moon
  const M  = norm(134.9634 + 13.06499295 * n);
  // Mean anomaly of Sun
  const Ms = norm(357.5291 + 0.98560028  * n);
  // Moon's argument of latitude
  const F  = norm(93.2721  + 13.22935024 * n);
  // Longitude of ascending node
  const Om = norm(125.0445 -  0.05295377 * n);

  const toRad = x => x * Math.PI / 180;

  const lam =
    L
    + 6.289  * Math.sin(toRad(M))
    - 1.274  * Math.sin(toRad(2 * F - M))
    + 0.658  * Math.sin(toRad(2 * F))
    - 0.214  * Math.sin(toRad(2 * M))
    - 0.186  * Math.sin(toRad(Ms))
    - 0.114  * Math.sin(toRad(2 * F - 2 * M))
    + 0.059  * Math.sin(toRad(2 * F - 2 * Ms - M))
    - 0.058  * Math.sin(toRad(2 * F - Ms - M))
    - 0.057  * Math.sin(toRad(2 * F + M - Ms))
    + 0.053  * Math.sin(toRad(2 * F + M))
    - 0.046  * Math.sin(toRad(2 * F - Ms))
    - 0.041  * Math.sin(toRad(M - Ms))
    + 0.034  * Math.sin(toRad(2 * F - 2 * M - Ms))
    - 0.030  * Math.sin(toRad(2 * Ms - M))
    + 0.017  * Math.sin(toRad(Om));

  return norm(lam);
}

// Sunrise/Sunset for a lat/lon (IST = UTC+5:30)
function getSunTimes(date, lat = 25.3176, lon = 82.9739) {
  const n   = daysSinceJ2000(date);
  const lw  = -lon * Math.PI / 180;
  const phi =  lat * Math.PI / 180;

  const Ms  = norm(357.5291 + 0.98560028 * n) * Math.PI / 180;
  const C   = 1.9148 * Math.sin(Ms) + 0.0200 * Math.sin(2 * Ms) + 0.0003 * Math.sin(3 * Ms);
  const lam = norm(norm(357.5291 + 0.98560028 * n) + C + 180 + 102.9372) * Math.PI / 180;
  const sinDec = Math.sin(lam) * Math.sin(23.4397 * Math.PI / 180);
  const dec    = Math.asin(sinDec);

  const cosH = (Math.sin(-0.0083 * Math.PI / 180) - Math.sin(phi) * sinDec)
               / (Math.cos(phi) * Math.cos(dec));

  if (Math.abs(cosH) > 1) return { sunrise: '05:45 AM', sunset: '07:00 PM' };

  const H        = Math.acos(cosH) * 180 / Math.PI;
  const transit  = 12 + (lon * 24 / 360 - n % 1 * 24) % 24 - 12;  // simplified
  const riseUTC  = 12 - H / 15 - (lon / 15);
  const setUTC   = 12 + H / 15 - (lon / 15);

  const toIST = h => {
    let ist = ((h + 5.5) % 24 + 24) % 24;
    const hh = Math.floor(ist);
    const mm = Math.round((ist - hh) * 60);
    const ampm  = hh >= 12 ? 'PM' : 'AM';
    const hh12  = ((hh % 12) || 12).toString().padStart(2, '0');
    return `${hh12}:${mm.toString().padStart(2, '0')} ${ampm}`;
  };

  return { sunrise: toIST(riseUTC), sunset: toIST(setUTC) };
}

// ── MAIN EXPORT ───────────────────────────────────────────
function getPanchang(date) {
  // Use noon IST (06:30 UTC) for calculation — standard panchang reference time
  const calcDate = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(), 6, 30, 0
  ));

  const n         = daysSinceJ2000(calcDate);
  const ayanamsha = lahiriAyanamsha(n);

  // Sidereal longitudes (tropical − ayanamsha)
  const sunSid  = norm(sunLongitudeTropical(n)  - ayanamsha);
  const moonSid = norm(moonLongitudeTropical(n) - ayanamsha);

  // ── TITHI ────────────────────────────────────────────
  // Every 12° of Moon−Sun elongation = 1 tithi
  const elongation  = norm(moonSid - sunSid);
  const tithiIndex  = Math.floor(elongation / 12) % 30;
  const tithi       = TITHIS[tithiIndex];
  const paksha      = tithiIndex < 15 ? 'Shukla Paksha' : 'Krishna Paksha';

  // ── NAKSHATRA ─────────────────────────────────────────
  // Moon's sidereal longitude divided into 27 equal parts of 13°20' each
  const nakshatraIndex = Math.floor((moonSid * 27) / 360) % 27;
  const nakshatra      = NAKSHATRAS[nakshatraIndex];

  // ── YOGA ─────────────────────────────────────────────
  // (Sun + Moon sidereal sum) divided into 27 equal parts
  const yogaIndex = Math.floor((norm(sunSid + moonSid) * 27) / 360) % 27;
  const yoga      = YOGAS[yogaIndex];

  // ── MOON RASHI ───────────────────────────────────────
  const rashiIndex  = Math.floor(moonSid / 30) % 12;
  const moonRashi   = RASHI_NAMES[rashiIndex];

  // ── SUN RASHI ────────────────────────────────────────
  const sunRashiIndex = Math.floor(sunSid / 30) % 12;
  const sunRashi      = RASHI_NAMES[sunRashiIndex];

  // ── VARA ─────────────────────────────────────────────
  const dayIndex   = date.getDay();
  const vara       = VARAS[dayIndex];
  const varaDeity  = VARA_DEITIES[dayIndex];

  // ── SUN TIMES ────────────────────────────────────────
  const { sunrise, sunset } = getSunTimes(date);

  // ── AUSPICIOUS ───────────────────────────────────────
  // Inauspicious: Chaturthi (3), Ashtami (7), Navami (8), Chaturdashi (13), Amavasya (29), Sundays/Saturdays
  const inauspiciousTithis = [3, 7, 8, 13, 29];
  const isAuspicious = !inauspiciousTithis.includes(tithiIndex) && ![0, 6].includes(dayIndex);

  return {
    date: date.toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }),
    vara,
    varaDeity,
    paksha,
    tithi,
    tithiIndex,
    nakshatra,
    yoga,
    moonRashi,
    sunRashi,
    sunrise,
    sunset,
    isAuspicious,
    ayanamsha: ayanamsha.toFixed(2)
  };
}

module.exports = { getPanchang };
