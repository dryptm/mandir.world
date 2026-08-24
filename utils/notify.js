const nodemailer = require('nodemailer');

// ── EMAIL ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.hostinger.com',
  port:   parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',  // true for port 465 SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false  // prevents cert errors on some hosts
  },
  connectionTimeout: 10000,  // fail fast instead of hanging if the host is unreachable
  greetingTimeout:   10000,
  socketTimeout:     15000
});

// Verify SMTP is actually reachable and credentials work — call this once at
// server startup so a misconfiguration shows up immediately in the logs,
// instead of silently failing on the first real email weeks later.
async function verifyEmailConfig() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌  EMAIL NOT CONFIGURED — SMTP_USER / SMTP_PASS are missing.');
    console.error('    If this is running on Railway: your local .env file is gitignored');
    console.error('    and never reaches Railway. Add SMTP_HOST, SMTP_PORT, SMTP_SECURE,');
    console.error('    SMTP_USER, SMTP_PASS, EMAIL_FROM directly in Railway → Variables.');
    return false;
  }
  try {
    await transporter.verify();
    console.log(`✅  Email configured — SMTP connected as ${process.env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error('❌  EMAIL SMTP CONNECTION FAILED:', err.message);
    console.error('    Code:', err.code, '| Response:', err.response || '(none)');
    console.error('    Check SMTP_HOST/PORT/SECURE match Hostinger exactly, and that');
    console.error('    SMTP_PASS is correct (re-copy it if it was ever changed).');
    return false;
  }
}

async function sendDaanReceipt({ name, email, phone, amount, cause_name, receiptNo, createdAt }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured — skipping email receipt');
    return;
  }
  if (!email) return;

  const date = new Date(createdAt).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1A0F00;border-radius:12px;overflow:hidden;max-width:100%">
      <tr><td style="padding:32px 32px 16px;text-align:center">
        <div style="font-size:36px">🪔</div>
        <h1 style="color:#C8922A;font-size:22px;margin:8px 0 4px;font-family:Georgia,serif">Mandir.World</h1>
        <p style="color:rgba(253,246,227,.45);font-size:12px;letter-spacing:2px;margin:0">DIGITAL DARSHAN PLATFORM</p>
      </td></tr>
      <tr><td style="padding:24px 32px">
        <h2 style="color:#FDF6E3;font-size:18px;margin:0 0 16px">🙏 Daan Received with Gratitude</h2>
        <p style="color:rgba(253,246,227,.7);font-size:14px;line-height:1.6;margin:0 0 24px">
          Dear <strong style="color:#FDF6E3">${name}</strong>, your donation has been recorded. May your daan multiply in blessings. 🪔
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.05);border-radius:8px;overflow:hidden">
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Receipt No</td>
            <td style="padding:12px 16px;color:#C8922A;font-size:13px;font-weight:bold">${receiptNo}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Amount</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:16px;font-weight:bold">₹${Number(amount).toLocaleString('en-IN')}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Cause</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${cause_name}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Date</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${date}</td>
          </tr>
        </table>
        <p style="color:rgba(253,246,227,.4);font-size:12px;margin:24px 0 0;text-align:center">
          धर्मो रक्षति रक्षितः — Dharma protects those who protect Dharma
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid rgba(200,146,42,.15)">
        <p style="color:rgba(253,246,227,.3);font-size:11px;margin:0">mandir.world · Digital Darshan Platform</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'Mandir.World <noreply@mandir.world>',
      to:      email,
      subject: `🪔 Daan Receipt — ₹${Number(amount).toLocaleString('en-IN')} | ${receiptNo}`,
      html
    });
    console.log(`Receipt email sent to ${email}`);
  } catch (err) {
    console.error('Email send failed:', err.message, '| code:', err.code, '| response:', err.response || '(none)');
  }
}

// ── SMS (Fast2SMS — India) ────────────────────────────────
async function sendDaanSMS({ name, phone, amount, receiptNo }) {
  if (!process.env.FAST2SMS_API_KEY) {
    console.warn('FAST2SMS_API_KEY not set — skipping SMS');
    return;
  }
  if (!phone) return;

  const message = `Dear ${name}, your daan of Rs.${amount} on Mandir.World is confirmed. Receipt: ${receiptNo}. Jai Shri Ram 🙏 - mandir.world`;

  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route:   'q',
        message,
        numbers: phone
      })
    });
    const data = await res.json();
    if (data.return) console.log(`SMS sent to ${phone}`);
    else console.warn('SMS failed:', data.message);
  } catch (err) {
    console.error('SMS send failed:', err.message);
  }
}

// sendDaanReceipt and sendDaanSMS exported below with all functions

// ── SANKALP CONFIRMATION ──────────────────────────────────
async function sendSankalpConfirmation({ name, phone, email, event, wish, number, city }) {
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1A0F00;border-radius:12px;overflow:hidden;max-width:100%">
      <tr><td style="padding:32px 32px 16px;text-align:center">
        <div style="font-size:36px">🙏</div>
        <h1 style="color:#C8922A;font-size:22px;margin:8px 0 4px;font-family:Georgia,serif">Mandir.World</h1>
        <p style="color:rgba(253,246,227,.45);font-size:12px;letter-spacing:2px;margin:0">DIGITAL DARSHAN PLATFORM</p>
      </td></tr>
      <tr><td style="padding:24px 32px">
        <h2 style="color:#FDF6E3;font-size:18px;margin:0 0 16px">✅ Sankalp Registered</h2>
        <p style="color:rgba(253,246,227,.7);font-size:14px;line-height:1.6;margin:0 0 24px">
          Dear <strong style="color:#FDF6E3">${name}</strong>, your sankalp has been received and recorded before the divine. May it be fulfilled. 🕉️
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.05);border-radius:8px;overflow:hidden">
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Sankalp No</td>
            <td style="padding:12px 16px;color:#C8922A;font-size:13px;font-weight:bold">#${number}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Occasion</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${event}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">City</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${city}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Your Wish</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:14px;font-style:italic">${wish}</td>
          </tr>
        </table>
        <p style="color:rgba(253,246,227,.4);font-size:12px;margin:24px 0 0;text-align:center">
          ॐ विष्णुर्विष्णुर्विष्णुः — Mandir.World
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid rgba(200,146,42,.15)">
        <p style="color:rgba(253,246,227,.3);font-size:11px;margin:0">mandir.world · Digital Darshan Platform</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  if (email && process.env.SMTP_USER) {
    try {
      await transporter.sendMail({
        from:    process.env.EMAIL_FROM || 'Mandir.World <mandir.world@walkupwagon.com>',
        to:      email,
        subject: `🙏 Sankalp Registered — #${number} | ${event}`,
        html
      });
      console.log(`Sankalp confirmation email sent to ${email}`);
    } catch (err) {
      console.error('Sankalp email failed:', err.message, '| code:', err.code, '| response:', err.response || '(none)');
    }
  }

  if (phone && process.env.FAST2SMS_API_KEY) {
    const message = `Dear ${name}, your sankalp #${number} for ${event} is registered on Mandir.World. May your wish be fulfilled. 🙏 - mandir.world`;
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method:  'POST',
        headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ route: 'q', message, numbers: phone })
      });
      const data = await res.json();
      if (data.return) console.log(`Sankalp SMS sent to ${phone}`);
    } catch (err) {
      console.error('Sankalp SMS failed:', err.message);
    }
  }
}

// ── PUJA BOOKING CONFIRMATION ─────────────────────────────
async function sendPujaConfirmation({ name, phone, email, puja_name, occasion, preferred_date, bookingNo, amount }) {
  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#1A0F00;border-radius:12px;overflow:hidden;max-width:100%">
      <tr><td style="padding:32px 32px 16px;text-align:center">
        <div style="font-size:36px">🪔</div>
        <h1 style="color:#C8922A;font-size:22px;margin:8px 0 4px;font-family:Georgia,serif">Mandir.World</h1>
        <p style="color:rgba(253,246,227,.45);font-size:12px;letter-spacing:2px;margin:0">DIGITAL DARSHAN PLATFORM</p>
      </td></tr>
      <tr><td style="padding:24px 32px">
        <h2 style="color:#FDF6E3;font-size:18px;margin:0 0 16px">✅ Puja Booking Confirmed</h2>
        <p style="color:rgba(253,246,227,.7);font-size:14px;line-height:1.6;margin:0 0 24px">
          Dear <strong style="color:#FDF6E3">${name}</strong>, your <strong style="color:#C8922A">${puja_name}</strong> has been booked and payment confirmed. Our pandit team will contact you within 24 hours.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,.05);border-radius:8px;overflow:hidden">
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Booking No</td>
            <td style="padding:12px 16px;color:#C8922A;font-size:13px;font-weight:bold">${bookingNo}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Puja</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px;font-weight:bold">${puja_name}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Occasion</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${occasion}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Preferred Date</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:13px">${preferred_date}</td>
          </tr>
          <tr style="border-bottom:1px solid rgba(255,255,255,.08)">
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Amount Paid</td>
            <td style="padding:12px 16px;color:#FDF6E3;font-size:16px;font-weight:bold">₹${Number(amount).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <td style="padding:12px 16px;color:rgba(253,246,227,.45);font-size:13px">Status</td>
            <td style="padding:12px 16px;color:#16a34a;font-size:13px;font-weight:bold">✓ Confirmed & Paid</td>
          </tr>
        </table>
        <p style="color:rgba(253,246,227,.4);font-size:12px;margin:24px 0 0;text-align:center">
          धर्मो रक्षति रक्षितः — Mandir.World
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px 28px;text-align:center;border-top:1px solid rgba(200,146,42,.15)">
        <p style="color:rgba(253,246,227,.3);font-size:11px;margin:0">mandir.world · Digital Darshan Platform</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  if (email && process.env.SMTP_USER) {
    try {
      await transporter.sendMail({
        from:    process.env.EMAIL_FROM || 'Mandir.World <mandir.world@walkupwagon.com>',
        to:      email,
        subject: `🪔 Puja Confirmed — ${puja_name} | ${bookingNo}`,
        html
      });
      console.log(`Puja confirmation email sent to ${email}`);
    } catch (err) {
      console.error('Puja email failed:', err.message, '| code:', err.code, '| response:', err.response || '(none)');
    }
  }

  if (phone && process.env.FAST2SMS_API_KEY) {
    const message = `Dear ${name}, your ${puja_name} (${bookingNo}) is confirmed on Mandir.World. Our pandit will contact you within 24 hours. Jai Shri Ram 🙏 - mandir.world`;
    try {
      const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method:  'POST',
        headers: { authorization: process.env.FAST2SMS_API_KEY, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ route: 'q', message, numbers: phone })
      });
      const data = await res.json();
      if (data.return) console.log(`Puja SMS sent to ${phone}`);
    } catch (err) {
      console.error('Puja SMS failed:', err.message);
    }
  }
}

// ── LOGIN OTP ──────────────────────────────────────────────
async function sendLoginOtp({ email, code }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP not configured — cannot send login OTP');
    return false;
  }

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="440" cellpadding="0" cellspacing="0" style="background:#1A0F00;border-radius:12px;overflow:hidden;max-width:100%">
      <tr><td style="padding:32px 32px 16px;text-align:center">
        <div style="font-size:32px">🕉️</div>
        <h1 style="color:#C8922A;font-size:20px;margin:8px 0 4px;font-family:Georgia,serif">Mandir.World</h1>
      </td></tr>
      <tr><td style="padding:8px 32px 32px;text-align:center">
        <p style="color:rgba(253,246,227,.7);font-size:14px;margin:0 0 20px">Your login code is</p>
        <div style="background:rgba(255,255,255,.06);border:1px solid rgba(200,146,42,.25);border-radius:10px;padding:16px;margin-bottom:20px">
          <span style="color:#FDF6E3;font-size:32px;font-weight:700;letter-spacing:8px">${code}</span>
        </div>
        <p style="color:rgba(253,246,227,.4);font-size:12px;margin:0">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || 'Mandir.World <mandir.world@walkupwagon.com>',
      to:      email,
      subject: `🕉️ Your login code: ${code}`,
      html
    });
    return true;
  } catch (err) {
    console.error('OTP email send failed:', err.message, '| code:', err.code, '| response:', err.response || '(none)');
    return false;
  }
}

module.exports = { sendDaanReceipt, sendDaanSMS, sendSankalpConfirmation, sendPujaConfirmation, sendLoginOtp, verifyEmailConfig };
