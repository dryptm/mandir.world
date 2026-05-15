// panchang.js — Simplified Vedic Panchang Calculator
// Based on approximate astronomical algorithms

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

const VARAS = ['Ravivar','Somvar','Mangalvar','Budhvar','Guruvar','Shukravar','Shanivar'];
const VARA_DEITIES = ['Surya Dev','Chandra Dev','Mangal Dev','Budha Dev','Brihaspati Dev','Shukra Dev','Shani Dev'];

const RASHI_NAMES = [
  'Mesha (Aries)','Vrishabha (Taurus)','Mithuna (Gemini)','Karka (Cancer)',
  'Simha (Leo)','Kanya (Virgo)','Tula (Libra)','Vrischika (Scorpio)',
  'Dhanu (Sagittarius)','Makara (Capricorn)','Kumbha (Aquarius)','Meena (Pisces)'
];

// Approximate Sun longitude (degrees) for a given date
function sunLongitude(date) {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const n = (date - J2000) / 86400000; // days since J2000
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * Math.PI / 180;
  const lam = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  return ((lam % 360) + 360) % 360;
}

// Approximate Moon longitude (degrees) for a given date
function moonLongitude(date) {
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const n = (date - J2000) / 86400000;
  const L = (218.316 + 13.176396 * n) % 360;
  const M = (134.963 + 13.064993 * n) % 360;
  const F = (93.272 + 13.229350 * n) % 360;
  const lam = L + 6.289 * Math.sin(M * Math.PI / 180) 
                - 1.274 * Math.sin((2*F - M) * Math.PI / 180)
                + 0.658 * Math.sin((2*F) * Math.PI / 180);
  return ((lam % 360) + 360) % 360;
}

// Sunrise/sunset approximation for a given lat/lon
function getSunTimes(date, lat = 25.32, lon = 83.01) { // default: Varanasi
  const J2000 = new Date('2000-01-01T12:00:00Z');
  const n = (date - J2000) / 86400000;
  const J = Math.floor(n) + 2451545.0;
  const lw = -lon * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const d = J - 2451545.0;
  const M_deg = (357.5291 + 0.98560028 * d) % 360;
  const M = M_deg * Math.PI / 180;
  const C = 1.9148 * Math.sin(M) + 0.0200 * Math.sin(2*M) + 0.0003 * Math.sin(3*M);
  const lam = (M_deg + C + 180 + 102.9372) % 360;
  const lamR = lam * Math.PI / 180;
  const sinDec = Math.sin(lamR) * Math.sin(23.4397 * Math.PI / 180);
  const dec = Math.asin(sinDec);
  const cosHourAngle = (Math.sin(-0.0083 * Math.PI / 180) - Math.sin(phi) * sinDec) / (Math.cos(phi) * Math.cos(dec));
  if (Math.abs(cosHourAngle) > 1) return { sunrise: '06:00 AM', sunset: '06:00 PM' };
  const hourAngle = Math.acos(cosHourAngle);
  const Jset = 2451545.0 + 0.0009 + ((hourAngle * 180/Math.PI + lon) / 360) + Math.floor(n) + 0.5 - 0.0053 * Math.sin(M) + 0.0069 * Math.sin(2 * lamR);
  const Jrise = Jset - hourAngle * 2 * 180/Math.PI / 360;
  const toTime = (j) => {
    const t = (j - 2440587.5) * 86400000;
    const d = new Date(t + 5.5 * 3600000); // IST offset
    const h = d.getUTCHours();
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h % 12) || 12).toString().padStart(2, '0');
    return `${h12}:${m} ${ampm}`;
  };
  return { sunrise: toTime(Jrise), sunset: toTime(Jset) };
}

function getPanchang(date = new Date()) {
  const sunLon = sunLongitude(date);
  const moonLon = moonLongitude(date);
  
  // Tithi: each 12° of elongation = 1 tithi
  const elongation = ((moonLon - sunLon) + 360) % 360;
  const tithiIndex = Math.floor(elongation / 12);
  const tithi = TITHIS[tithiIndex] || 'Pratipada';
  const paksha = tithiIndex < 15 ? 'Shukla Paksha' : 'Krishna Paksha';

  // Nakshatra: Moon's longitude / (360/27)
  const nakshatraIndex = Math.floor((moonLon * 27) / 360) % 27;
  const nakshatra = NAKSHATRAS[nakshatraIndex];

  // Yoga: (sun + moon) / (360/27)
  const yogaIndex = Math.floor(((sunLon + moonLon) * 27) / 360) % 27;
  const yoga = YOGAS[yogaIndex];

  // Vara (weekday)
  const dayIndex = date.getDay();
  const vara = VARAS[dayIndex];
  const varaDeity = VARA_DEITIES[dayIndex];

  // Rashi (Moon sign)
  const rashiIndex = Math.floor(moonLon / 30);
  const moonRashi = RASHI_NAMES[rashiIndex];

  // Sun rashi
  const sunRashiIndex = Math.floor(sunLon / 30);
  const sunRashi = RASHI_NAMES[sunRashiIndex];

  // Sun times for Varanasi
  const { sunrise, sunset } = getSunTimes(date);

  // Auspicious times (muhurta) — simplified
  const isAuspicious = ![0, 6].includes(dayIndex) && tithiIndex !== 3 && tithiIndex !== 8;

  return {
    date: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    vara,
    varaDeity,
    tithi,
    paksha,
    nakshatra,
    yoga,
    moonRashi,
    sunRashi,
    sunrise,
    sunset,
    isAuspicious,
    tithiIndex,
  };
}

module.exports = { getPanchang };
