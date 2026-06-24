const nodemailer = require('nodemailer');

// ── EMAIL ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

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
    console.error('Email send failed:', err.message);
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

module.exports = { sendDaanReceipt, sendDaanSMS };
