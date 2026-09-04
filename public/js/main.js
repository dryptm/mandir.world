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
// LIVE STREAM PAGE — BUBBLES + REAL ACTIVITY
// ══════════════════════════════════════════

const BUBBLE_EMOJIS = ['🙏','❤️','🔥','ॐ','🪔','🌸','✨','💛','🕉️','🌺'];

function initStreamPage() {
  const bubbleZone = document.getElementById('bubbleZone');
  const feed = document.getElementById('activityFeed');
  if (!bubbleZone && !feed) return;

  // Auto bubbles (purely decorative animation, not a data claim — fine as-is)
  if (bubbleZone) autoSpawnBubbles(bubbleZone);

  // Real activity — no fabricated names or messages. Pulled from actual
  // sankalp/donation records. Polls periodically so new real activity
  // appears without a page refresh.
  if (feed && window.__STREAM_ID__) {
    loadRealActivity();
    setInterval(loadRealActivity, 45000);
  }
}

async function loadRealActivity() {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  try {
    const res  = await fetch(`/api/streams/${window.__STREAM_ID__}/activity`);
    const data = await res.json();
    renderActivityFeed(data.items || []);
  } catch (err) {
    // Leave whatever was already showing rather than erroring the UI
  }
}

function relativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderActivityFeed(items) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  if (items.length === 0) {
    feed.innerHTML = `<div class="activity-empty">🙏 Be the first to give daan or record a sankalp during this darshan</div>`;
    return;
  }

  feed.innerHTML = items.map(it => `
    <div class="activity-item activity-item--${it.type}">
      <strong>${it.name}</strong> ${it.text}
      <span class="activity-time">${relativeTime(it.time)}</span>
    </div>
  `).join('');
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

// New real activity (from an actual daan/sankalp this visitor just completed)
// gets prepended immediately, ahead of the next poll cycle.
function addActivity(html, type = 'chat') {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  const empty = feed.querySelector('.activity-empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = `activity-item activity-item--${type}`;
  item.innerHTML = html;
  feed.insertBefore(item, feed.firstChild);
  while (feed.children.length > 8) feed.removeChild(feed.lastChild);
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
  const phone   = document.getElementById('daanPhone')?.value.trim();
  const email   = document.getElementById('daanEmail')?.value.trim();
  const pan     = document.getElementById('daanPan')?.value.trim();
  const amount  = isCustom ? customAmountValue : selectedAmount;
  const errorEl = document.getElementById('modalError');

  if (!name)  { if (errorEl) errorEl.textContent = 'Please enter your name.'; return; }
  if (!phone) { if (errorEl) errorEl.textContent = 'Please enter your mobile number.'; return; }
  if (!/^\d{10}$/.test(phone)) { if (errorEl) errorEl.textContent = 'Please enter a valid 10-digit mobile number.'; return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { if (errorEl) errorEl.textContent = 'Please enter a valid email address.'; return; }
  if (!amount || amount < 10) { if (errorEl) errorEl.textContent = 'Please select or enter a valid amount (min ₹10).'; return; }

  if (prasadEnabled) {
    const addr1  = document.getElementById('prasadAddress1')?.value.trim();
    const city   = document.getElementById('prasadCity')?.value.trim();
    const pin    = document.getElementById('prasadPincode')?.value.trim();
    const dPhone = document.getElementById('prasadPhone')?.value.trim();
    if (!addr1 || !city || !pin || !dPhone) { if (errorEl) errorEl.textContent = 'Please fill all delivery address fields for Prasad.'; return; }
    if (!/^\d{6}$/.test(pin))  { if (errorEl) errorEl.textContent = 'Please enter a valid 6-digit PIN code.'; return; }
    if (!/^\d{10}$/.test(dPhone)) { if (errorEl) errorEl.textContent = 'Please enter a valid 10-digit mobile number for delivery.'; return; }
  }

  if (errorEl) errorEl.textContent = '';
  const btn  = document.getElementById('modalSubmitBtn');
  const text = document.getElementById('modalSubmitText');
  if (btn) btn.disabled = true;
  if (text) text.textContent = 'Processing...';

  const prasadData = prasadEnabled ? {
    requested: true,
    address1:  document.getElementById('prasadAddress1')?.value.trim() || null,
    address2:  document.getElementById('prasadAddress2')?.value.trim() || null,
    city:      document.getElementById('prasadCity')?.value.trim()     || null,
    pincode:   document.getElementById('prasadPincode')?.value.trim()  || null,
    phone:     document.getElementById('prasadPhone')?.value.trim()    || null,
  } : { requested: false };

  const savedLoc = JSON.parse(localStorage.getItem('mw_location') || 'null');

  // Step 1: Create Razorpay order on server
  fetch('/api/payment/create-order', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      name, phone, email: email || null,
      cause_id:   'stream-daan',
      cause_name: `Live Daan — ${window.__STREAM_CITY__ || 'Temple'}`,
      streamId:   window.__STREAM_ID__   || null,
      streamCity: window.__STREAM_CITY__ || null,
    })
  })
  .then(r => r.json())
  .then(orderData => {
    if (!orderData.ok) throw new Error(orderData.error);

    // Re-enable button — Razorpay takes over from here
    if (btn) btn.disabled = false;
    if (text) text.textContent = '🪔 Confirm Daan';

    // Step 2: Open Razorpay checkout
    const rzp = new Razorpay({
      key:         orderData.keyId,
      order_id:    orderData.orderId,
      amount:      orderData.amount,
      currency:    orderData.currency,
      name:        'Mandir.World',
      description: `Live Daan — ${window.__STREAM_CITY__ || 'Temple'}`,
      image:       '/favicon.svg',
      prefill:     orderData.prefill,
      theme:       { color: '#FF6B00' },
      retry:       { enabled: true, max_count: 3 },
      modal: {
        ondismiss: () => {
          document.getElementById('daanModal')?.classList.add('modal-overlay--visible');
          document.body.style.overflow = 'hidden';
          if (btn) btn.disabled = false;
          if (text) text.textContent = '🪔 Confirm Daan';
        }
      },
      handler: function(response) {
        // Step 3: Verify payment + save to DB + send receipts
        fetch('/api/payment/verify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
            name, phone, email: email || null, pan: pan || null,
            amount:    orderData.amount,
            cause_id:  'stream-daan',
            cause_name: `Live Daan — ${window.__STREAM_CITY__ || 'Temple'}`,
            streamId:   window.__STREAM_ID__   || null,
            streamCity: window.__STREAM_CITY__ || null,
            prasad:     prasadData,
            userLocation: savedLoc || null
          })
        })
        .then(r => r.json())
        .then(data => {
          window.closeDaanModal();
          if (data.ok) {
            showDaanSuccess(name, data.amount, data.receiptNo);
            addActivity(`<strong>${name.split(' ')[0]}</strong> gave ₹${Number(data.amount).toLocaleString('en-IN')} — Live Daan 🪔`, 'daan');
            ['🪔','🌸','❤️','🙏','✨'].forEach((e, i) => setTimeout(() => spawnBubble(e, true), i * 110));
          } else {
            if (errorEl) errorEl.textContent = data.error || 'Verification failed. Contact support.';
          }
        })
        .catch(() => {
          window.closeDaanModal();
          showDaanSuccess(name, amount, response.razorpay_payment_id);
        });
      }
    });

    rzp.on('payment.failed', function(response) {
      console.error('Razorpay payment failed:', response.error);
      document.getElementById('daanModal')?.classList.add('modal-overlay--visible');
      document.body.style.overflow = 'hidden';
      if (errorEl) errorEl.textContent =
        'Payment failed: ' + (response.error.description || response.error.reason || 'Please try again.');
      if (btn) btn.disabled = false;
      if (text) text.textContent = '🪔 Confirm Daan';
    });

    rzp.open();
    window.closeDaanModal();
  })
  .catch(err => {
    if (errorEl) errorEl.textContent = err.message || 'Could not initiate payment. Please try again.';
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
  const streamCityForShare = window.__STREAM_CITY__ || 'this darshan';
  window.__lastDaanShareText = `I gave daan during live darshan from ${streamCityForShare} on Mandir.World 🪔 — join me at mandir.world`;
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

// ══════════════════════════════════════════
// SHARE CARD — turns any certificate/card element into a shareable image
// Used after sankalp registration, daan payment, puja booking, and live
// stream daan. Uses the native Web Share API on mobile (one-tap to
// WhatsApp/Instagram/etc) and falls back to a plain download on desktop.
// ══════════════════════════════════════════

async function shareCard(elementId, filename, shareText) {
  const el = document.getElementById(elementId);
  if (!el || typeof html2canvas === 'undefined') {
    console.warn('Share card: element or html2canvas not available');
    return;
  }

  // Briefly mark as "capturing" so any hover/focus styles don't show in the image
  el.classList.add('capturing-share-card');

  let canvas;
  try {
    canvas = await html2canvas(el, {
      backgroundColor: '#1A0F00',
      scale: 2, // sharper image for sharing
      useCORS: true
    });
  } catch (err) {
    console.error('Share card render failed:', err);
    el.classList.remove('capturing-share-card');
    return;
  }
  el.classList.remove('capturing-share-card');

  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], `${filename}.png`, { type: 'image/png' });

    // Mobile with native share sheet — one tap to WhatsApp, Instagram, etc.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Mandir.World',
          text: shareText || 'Shared from mandir.world 🙏'
        });
        return;
      } catch (err) {
        // User cancelled the share sheet — fall through to download as backup
        if (err.name === 'AbortError') return;
      }
    }

    // Desktop / unsupported — just download the image
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
}

window.shareCard = shareCard;
