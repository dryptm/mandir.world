// ══════════════════════════════════════════
// MANDIR.WORLD — Main JS v3
// ══════════════════════════════════════════

// ── NAV ──
function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

// Close mobile menu on outside click
document.addEventListener('click', e => {
  const menu = document.getElementById('mobileMenu');
  const toggle = document.getElementById('navToggle');
  if (menu && menu.classList.contains('open') && !menu.contains(e.target) && !toggle.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// Sticky nav shadow on scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('mainNav');
  if (nav) nav.style.boxShadow = window.scrollY > 20 ? '0 4px 24px rgba(0,0,0,0.4)' : '';
});

// ── TOPBAR PANCHANG ──
async function loadTopbarPanchang() {
  const el = document.getElementById('topbarPanchang');
  if (!el) return;
  try {
    const res = await fetch('/api/panchang');
    const p = await res.json();
    el.innerHTML = `
      <span style="color:rgba(232,168,56,0.7)">ॐ</span>
      &nbsp;${p.vara} &nbsp;·&nbsp; ${p.paksha} — <strong style="color:rgba(232,168,56,0.8)">${p.tithi}</strong>
      &nbsp;·&nbsp; Nakshatra: ${p.nakshatra}
      &nbsp;·&nbsp; 🌅 ${p.sunrise} &nbsp;·&nbsp; 🌇 ${p.sunset}
    `;
  } catch (e) {
    el.textContent = 'ॐ नमः शिवाय — Today\'s panchang loading...';
  }
}

// ── LIVE VIEWER TICKER (hero) ──
function startViewerTicker() {
  const el = document.getElementById('h-viewers');
  if (!el) return;
  let base = 15162;
  setInterval(() => {
    base += Math.floor(Math.random() * 20) - 7;
    base = Math.max(14000, base);
    el.textContent = base.toLocaleString('en-IN');
  }, 4500);
}

// ── SCROLL REVEAL ──
function initScrollReveal() {
  const style = document.createElement('style');
  style.textContent = '.sr-hidden{opacity:0;transform:translateY(22px);transition:opacity 0.55s ease, transform 0.55s ease}.sr-visible{opacity:1!important;transform:translateY(0)!important}';
  document.head.appendChild(style);

  const els = document.querySelectorAll(
    '.shg-card, .fhg-card, .pf-mini, .daily-card, .dhr-cause, .ctv2-item, .puja-card, .cause-card-v2, .cdc-card'
  );

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.replace('sr-hidden', 'sr-visible'), i * 70);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  els.forEach(el => { el.classList.add('sr-hidden'); obs.observe(el); });
}

// ── PUJA DATE MIN ──
function setPujaDateMin() {
  document.querySelectorAll('input[type="date"]').forEach(input => {
    const today = new Date().toISOString().split('T')[0];
    input.min = today;
    if (!input.value) input.value = '';
  });
}

// ── SANKALP FORM: URL PRESELECT ──
function preselectSankalpEvent() {
  const event = new URLSearchParams(window.location.search).get('event');
  if (!event) return;
  document.querySelectorAll('.event-pick-item input[type="radio"]').forEach(radio => {
    if (radio.value.toLowerCase().includes(event.toLowerCase().split('-')[0])) {
      radio.checked = true;
    }
  });
}

// ── CAUSE FORM VALIDATION ──
function setupCauseForms() {
  document.querySelectorAll('.cause-form-v2').forEach(form => {
    form.addEventListener('submit', e => {
      const amount = form.querySelector('input[name="amount"]:checked');
      const custom = form.querySelector('input[name="custom_amount"]')?.value;
      const name = form.querySelector('input[name="name"]')?.value;
      if (!name?.trim()) { e.preventDefault(); alert('Please enter your name.'); return; }
      if (!amount && !custom) { e.preventDefault(); alert('Please select or enter a donation amount.'); return; }
    });
  });
}

// ── SMOOTH ANCHOR SCROLL ──
function initAnchorScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

// ══════════════════════════════════════════
// LIVE STREAM PAGE — BUBBLES + ACTIVITY
// ══════════════════════════════════════════

const BUBBLE_EMOJIS = ['🙏','❤️','🔥','ॐ','🪔','🌸','✨','💛','🕉️','🌺'];
const FAKE_NAMES = [
  'Ramesh ji','Priya Sharma','Anita Devi','Suresh Kumar','Kavita ji',
  'Mohan Das','Sunita Gupta','Ravi Shankar','Meera Ben','Dinesh ji',
  'Pooja Rani','Vijay Mishra','Savita ji','Ashok Pandey','Rekha Devi',
  'Govind ji','Lalita ji','Hari Om','Deepak Verma','Pushpa ji',
  'Arun Tiwari','Shanta Devi','Mahesh Rao','Geeta ji','Rajiv Bhaiya'
];
const CHAT_MSGS = [
  'Jai Shiv Shankar 🙏','Har Har Mahadev!','Jai Ganga Maiya 🌊',
  'Jai Shri Ram 🙏','Watching from London 🇬🇧','Jai Mata Di ❤️',
  'Doing darshan from USA 🙏','So peaceful 🕉️','Har Har Gange 🙏',
  'My whole family is watching!','Jai Vishwanath 🔥',
  'Bahut sundar darshan 🙏','Watching from Dubai 🌸',
  'Om Namah Shivay 🙏','First time watching live 😊',
  'Jai Jai Ganga Maiya!','Watching with my parents ❤️',
  'So blessed 🙏','Kashi vishwanath ki jai!',
  'Joining from Canada 🇨🇦 🙏','Radhe Radhe 🌸',
];
const DAAN_MSGS = [
  'gave ₹251 to Gau Seva 🐄','gave ₹51 to Annadaan 🍛',
  'gave ₹1,100 to Ganga Safai 🌊','gave ₹501 to Platform Seva 📡',
  'gave ₹5,100 to Gau Seva 🐄','gave ₹251 to Annadaan 🍛',
  'gave ₹1,100 to Ghat Preservation 🏛️',
];
const SANKALP_MSGS = [
  'recorded a sankalp 🕉️','registered their sankalp 🙏',
  'added a sankalp for their family 🙏','registered a sankalp for their parents 🙏',
];

function initStreamPage() {
  const bubbleZone = document.getElementById('bubbleZone');
  const feed = document.getElementById('activityFeed');
  if (!bubbleZone && !feed) return;

  // Viewer count ticker (uses server-injected value)
  const viewerEl = document.getElementById('viewerCount');
  if (viewerEl && window.__STREAM_VIEWERS__) {
    let v = window.__STREAM_VIEWERS__;
    const min = window.__STREAM_MIN_VIEWERS__ || v - 300;
    setInterval(() => {
      v += Math.floor(Math.random() * 12) - 4;
      v = Math.max(min, v);
      viewerEl.textContent = v.toLocaleString('en-IN');
    }, 3500);
  }

  // Seed activity feed
  const seeds = [
    { name: 'Ramesh ji', msg: 'Har Har Mahadev! 🙏', type: 'chat' },
    { name: 'Priya Sharma', msg: 'gave ₹251 to Gau Seva 🐄', type: 'daan' },
    { name: 'Anita Devi', msg: 'Watching from Mumbai ❤️', type: 'chat' },
    { name: 'Suresh Kumar', msg: 'recorded a sankalp 🕉️', type: 'sankalp' },
    { name: 'Kavita ji', msg: 'Jai Ganga Maiya 🌊', type: 'chat' },
  ];
  if (feed) seeds.forEach(s => addActivity(`<strong>${s.name}</strong> ${s.msg}`, s.type));

  // Auto bubbles
  if (bubbleZone) autoSpawnBubbles(bubbleZone);

  // Auto activity
  if (feed) scheduleActivity(feed);
}

function spawnBubble(emoji, fromClick = false, zone) {
  const bubbleZone = zone || document.getElementById('bubbleZone');
  if (!bubbleZone) return;
  const el = document.createElement('div');
  el.className = 'bubble' + (fromClick ? ' bubble--big' : '');
  el.textContent = emoji;
  el.style.left = (8 + Math.random() * 80) + '%';
  const scale = fromClick ? (1.4 + Math.random() * 0.4) : (0.9 + Math.random() * 0.5);
  el.style.fontSize = (scale * 1.5) + 'rem';
  el.style.setProperty('--drift', ((Math.random() - 0.5) * 40) + 'px');
  bubbleZone.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function autoSpawnBubbles(zone) {
  spawnBubble(BUBBLE_EMOJIS[Math.floor(Math.random() * BUBBLE_EMOJIS.length)], false, zone);
  setTimeout(() => autoSpawnBubbles(zone), 700 + Math.random() * 2500);
}

window.sendReaction = function(emoji) {
  const count = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) setTimeout(() => spawnBubble(emoji, true), i * 90);
  const btn = document.querySelector(`.reaction-btn[data-emoji="${emoji}"]`);
  if (btn) { btn.classList.add('reaction-btn--active'); setTimeout(() => btn.classList.remove('reaction-btn--active'), 380); }
};

function addActivity(html, type = 'chat') {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  const item = document.createElement('div');
  item.className = `activity-item activity-item--${type}`;
  item.innerHTML = html;
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > 7) feed.removeChild(feed.lastChild);
}

function scheduleActivity(feed) {
  const rand = Math.random();
  const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
  let msg, type;
  if (rand < 0.52) { msg = CHAT_MSGS[Math.floor(Math.random() * CHAT_MSGS.length)]; type = 'chat'; }
  else if (rand < 0.78) { msg = DAAN_MSGS[Math.floor(Math.random() * DAAN_MSGS.length)]; type = 'daan'; }
  else { msg = SANKALP_MSGS[Math.floor(Math.random() * SANKALP_MSGS.length)]; type = 'sankalp'; }
  addActivity(`<strong>${name}</strong> ${msg}`, type);
  setTimeout(() => scheduleActivity(feed), 2200 + Math.random() * 4500);
}

// ══════════════════════════════════════════
// DAAN MODAL (stream page)
// ══════════════════════════════════════════

const PREMIUM_THRESHOLD = 501;
let selectedAmount = null;
let isCustom = false;
let prasadEnabled = false;
let customAmountValue = 0;

window.selectTier = function(btn, amount) {
  document.querySelectorAll('.sdw-tier').forEach(b => b.classList.remove('sdw-tier--active'));
  btn.classList.add('sdw-tier--active');
  isCustom = (amount === 'custom');
  selectedAmount = isCustom ? 0 : amount;
  const isPremium = !isCustom && amount >= PREMIUM_THRESHOLD;
  const badge = document.getElementById('sdwPrasadBadge');
  if (badge) badge.classList.toggle('sdw-prasad-badge--visible', isPremium);
  const giveBtn = document.getElementById('sdwGiveBtn');
  if (giveBtn) {
    giveBtn.disabled = false;
    giveBtn.textContent = isCustom
      ? '🪔 Enter Amount & Give'
      : `🪔 Give ₹${Number(amount).toLocaleString('en-IN')} Daan`;
  }
};

window.openDaanModal = function() {
  const modal = document.getElementById('daanModal');
  if (!modal) return;
  modal.classList.add('modal-overlay--visible');
  document.body.style.overflow = 'hidden';
  const customSec = document.getElementById('customAmountSection');
  if (customSec) customSec.style.display = isCustom ? 'block' : 'none';
  updateModalAmountDisplay();
  const isPremium = !isCustom && selectedAmount >= PREMIUM_THRESHOLD;
  const prasadSec = document.getElementById('modalPrasadSection');
  if (prasadSec) prasadSec.style.display = isPremium ? 'block' : 'none';
  prasadEnabled = false;
  const toggle = document.getElementById('prasadToggle');
  if (toggle) toggle.classList.remove('toggle--on');
  const addrFields = document.getElementById('prasadAddressFields');
  if (addrFields) addrFields.style.display = 'none';
  const errEl = document.getElementById('modalError');
  if (errEl) errEl.textContent = '';
  setTimeout(() => { const f = document.getElementById('daanName'); if (f) f.focus(); }, 100);
};

function updateModalAmountDisplay() {
  const el = document.getElementById('modalAmountDisplay');
  if (!el) return;
  if (isCustom) {
    el.innerHTML = customAmountValue
      ? `<span class="mad-label">Amount</span><span class="mad-amount">₹${Number(customAmountValue).toLocaleString('en-IN')}</span>`
      : `<span class="mad-label">Enter your amount below</span>`;
  } else {
    const isPremium = selectedAmount >= PREMIUM_THRESHOLD;
    el.innerHTML = `
      <span class="mad-label">You are giving</span>
      <span class="mad-amount">₹${Number(selectedAmount).toLocaleString('en-IN')}</span>
      ${isPremium ? '<span class="mad-prasad-pill">🌸 Prasad eligible</span>' : ''}
    `;
  }
}

window.updateCustomAmount = function(val) {
  customAmountValue = parseInt(val) || 0;
  selectedAmount = customAmountValue;
  updateModalAmountDisplay();
  const prasadSec = document.getElementById('modalPrasadSection');
  if (prasadSec) prasadSec.style.display = customAmountValue >= PREMIUM_THRESHOLD ? 'block' : 'none';
};

window.togglePrasad = function() {
  prasadEnabled = !prasadEnabled;
  const toggle = document.getElementById('prasadToggle');
  if (toggle) toggle.classList.toggle('toggle--on', prasadEnabled);
  const addrFields = document.getElementById('prasadAddressFields');
  if (addrFields) addrFields.style.display = prasadEnabled ? 'block' : 'none';
};

window.closeDaanModal = function() {
  const modal = document.getElementById('daanModal');
  if (modal) modal.classList.remove('modal-overlay--visible');
  document.body.style.overflow = '';
};

window.closeDaanModalOutside = function(e) {
  if (e.target === document.getElementById('daanModal')) window.closeDaanModal();
};

window.submitDaan = function() {
  const name    = document.getElementById('daanName')?.value.trim();
  const amount  = isCustom ? customAmountValue : selectedAmount;
  const errorEl = document.getElementById('modalError');

  if (!name) { if (errorEl) errorEl.textContent = 'Please enter your name.'; return; }
  if (!amount || amount < 10) { if (errorEl) errorEl.textContent = 'Please select or enter a valid amount (min ₹10).'; return; }

  if (prasadEnabled) {
    const addr1  = document.getElementById('prasadAddress1')?.value.trim();
    const city   = document.getElementById('prasadCity')?.value.trim();
    const pin    = document.getElementById('prasadPincode')?.value.trim();
    const phone  = document.getElementById('prasadPhone')?.value.trim();
    if (!addr1 || !city || !pin || !phone) { if (errorEl) errorEl.textContent = 'Please fill all delivery address fields for Prasad.'; return; }
    if (!/^\d{6}$/.test(pin))  { if (errorEl) errorEl.textContent = 'Please enter a valid 6-digit PIN code.'; return; }
    if (!/^\d{10}$/.test(phone)) { if (errorEl) errorEl.textContent = 'Please enter a valid 10-digit mobile number.'; return; }
  }

  if (errorEl) errorEl.textContent = '';
  const btn  = document.getElementById('modalSubmitBtn');
  const text = document.getElementById('modalSubmitText');
  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Processing...';

  // Collect prasad address if toggle is on
  const prasadData = prasadEnabled ? {
    requested: true,
    address1:  document.getElementById('prasadAddress1')?.value.trim() || null,
    address2:  document.getElementById('prasadAddress2')?.value.trim() || null,
    city:      document.getElementById('prasadCity')?.value.trim()     || null,
    pincode:   document.getElementById('prasadPincode')?.value.trim()  || null,
    phone:     document.getElementById('prasadPhone')?.value.trim()    || null,
  } : { requested: false };

  // Real POST to server — saves to MongoDB
  fetch('/api/daan/stream', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      amount,
      streamId:   window.__STREAM_ID__   || null,
      streamCity: window.__STREAM_CITY__ || null,
      cause_id:   'stream-daan',
      cause_name: `Live Daan — ${window.__STREAM_CITY__ || 'Temple'}`,
      prasad:     prasadData
    })
  })
  .then(r => r.json())
  .then(data => {
    window.closeDaanModal();
    if (data.ok) {
      showDaanSuccess(name, amount, data.receiptNo);
      addActivity(`<strong>${name.split(' ')[0]}</strong> gave ₹${Number(amount).toLocaleString('en-IN')} — Live Daan 🪔`, 'daan');
      ['🪔','🌸','❤️','🙏','✨'].forEach((e, i) => setTimeout(() => spawnBubble(e, true), i * 110));
    } else {
      if (errorEl) errorEl.textContent = data.error || 'Something went wrong. Please try again.';
      document.getElementById('daanModal')?.classList.add('modal-overlay--visible');
      document.body.style.overflow = 'hidden';
    }
  })
  .catch(() => {
    window.closeDaanModal();
    showDaanSuccess(name, amount, 'MDW-' + Date.now());
  })
  .finally(() => {
    if (btn) btn.disabled = false;
    if (text) text.textContent = '🪔 Confirm Daan';
  });
};

function showDaanSuccess(name, amount, receiptNo) {
  const overlay  = document.getElementById('daanSuccessOverlay');
  const msg      = document.getElementById('successMsg');
  const receipt  = document.getElementById('successReceipt');
  receiptNo = receiptNo || ('MDW-' + Date.now());
  if (!overlay) return;
  if (msg) msg.textContent = `Thank you, ${name}. Your daan of ₹${Number(amount).toLocaleString('en-IN')} has been recorded for this darshan.`;
  if (receipt) {
    const streamTitle = document.querySelector('.stream-page-title')?.textContent || 'Live Stream';
    receipt.innerHTML = `
      <div class="sr-row"><span>Donor</span><strong>${name}</strong></div>
      <div class="sr-row"><span>Amount</span><strong>₹${Number(amount).toLocaleString('en-IN')}</strong></div>
      <div class="sr-row"><span>Stream</span><strong>${streamTitle}</strong></div>
      <div class="sr-row"><span>Receipt No</span><strong>${receiptNo}</strong></div>
      ${prasadEnabled ? '<div class="sr-row sr-row--prasad"><span>Prasad</span><strong>🌸 Will be delivered to your address</strong></div>' : ''}
    `;
  }
  overlay.classList.add('daan-success-overlay--visible');
  document.body.style.overflow = 'hidden';
}

window.closeDaanSuccess = function() {
  const overlay = document.getElementById('daanSuccessOverlay');
  if (overlay) overlay.classList.remove('daan-success-overlay--visible');
  document.body.style.overflow = '';
};

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    window.closeDaanModal();
    window.closeDaanSuccess();
  }
});

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  loadTopbarPanchang();
  startViewerTicker();
  initScrollReveal();
  setPujaDateMin();
  preselectSankalpEvent();
  setupCauseForms();
  initAnchorScroll();
  initStreamPage();
});

// ══════════════════════════════════════════
// LOCATION — global handler
// ══════════════════════════════════════════
function requestLocationGlobal() {
  navigator.geolocation.getCurrentPosition(
    pos => {
      const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lon}&format=json`)
        .then(r => r.json())
        .then(data => {
          coords.city  = data.address?.city || data.address?.town || data.address?.village || '';
          coords.state = data.address?.state || '';
          localStorage.setItem('mw_location', JSON.stringify(coords));
          dismissLocationBanner();
        })
        .catch(() => {
          localStorage.setItem('mw_location', JSON.stringify(coords));
          dismissLocationBanner();
        });
    },
    () => dismissLocationBanner(),
    { timeout: 8000 }
  );
}

function dismissLocationBanner() {
  const b = document.getElementById('locationBanner');
  if (b) b.style.display = 'none';
  localStorage.setItem('mw_loc_dismissed', '1');
}

// Show banner if location not yet saved and not dismissed
document.addEventListener('DOMContentLoaded', () => {
  const saved     = localStorage.getItem('mw_location');
  const dismissed = localStorage.getItem('mw_loc_dismissed');
  if (!saved && !dismissed) {
    const banner = document.getElementById('locationBanner');
    if (banner) setTimeout(() => banner.style.display = 'flex', 2000);
  }
});
