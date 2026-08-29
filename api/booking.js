const { redis, redisConfigured } = require('../_lib/redis');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!redisConfigured || !redis) {
    return res.status(500).json({
      ok: false,
      error: 'Database not configured — KV_REST_API_URL/TOKEN env vars are missing. Connect Upstash in Vercel → Storage, then redeploy.'
    });
  }

  try {
    const data = req.body || {};

    let bookingId = String(data.bookingId || '').trim().toUpperCase();
    if (!bookingId) {
      bookingId = 'HSA-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    const mobile = String(data.mobile || '').replace(/\D/g, '').slice(-10);

    const record = {
      bookingId,
      name: data.name || '',
      mobile,
      email: data.email || '',
      address: data.address || '',
      visitors: data.visitors || '',
      visitDate: data.visitDate || '',
      visitSlot: data.visitSlot || '',
      propertyId: data.propertyId || '',
      propertyTitle: data.propertyTitle || '',
      area: data.area || '',
      bhk: data.bhk || '',
      rent: data.rent || '',
      deposit: data.deposit || '',
      amount: data.amount || 199,
      utr: data.utr || '',
      notes: data.notes || '',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    // Token used to authorize the Confirm / Reject links sent to the owner
    const token = crypto
      .createHmac('sha256', process.env.TOKEN_SECRET || 'change-me')
      .update(bookingId + '|' + record.email)
      .digest('base64url')
      .slice(0, 24);
    record.token = token;

    // Save to Redis (Upstash) — this is the ONLY place data is persisted now
    await redis.set(`booking:${bookingId}`, record);

    // Build owner email (with Confirm / Reject buttons)
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${req.headers.host}`;
    const confirmUrl = `${baseUrl}/api/decision?action=confirm&id=${encodeURIComponent(bookingId)}&t=${encodeURIComponent(token)}`;
    const rejectUrl = `${baseUrl}/api/decision?action=reject&id=${encodeURIComponent(bookingId)}&t=${encodeURIComponent(token)}`;

    const row = (label, value) =>
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;width:140px">${label}</td>` +
      `<td style="padding:6px 8px;border-bottom:1px solid #eee">${value || '—'}</td></tr>`;

    const ownerHtml =
      '<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.5">' +
      '<h2 style="color:#1C2430">New Visit Booking</h2>' +
      `<p><b>Booking ID:</b> ${bookingId}</p>` +
      '<table style="border-collapse:collapse;width:100%">' +
      row('Name', record.name) +
      row('Mobile', record.mobile) +
      row('Email', record.email) +
      row('Address', record.address) +
      row('Visitors', record.visitors) +
      row('Visit Date', record.visitDate) +
      row('Visit Slot', record.visitSlot) +
      row('Flat', record.propertyTitle) +
      row('Area', record.area) +
      row('BHK', record.bhk) +
      row('Rent', record.rent) +
      row('Deposit', record.deposit) +
      row('Fee', 'Rs. ' + record.amount) +
      row('UTR', `<b style="color:#B85C33">${record.utr}</b>`) +
      row('Notes', record.notes) +
      '</table>' +
      '<p style="margin-top:24px">Verify UTR, then choose:</p>' +
      '<p>' +
      `<a href="${confirmUrl}" style="display:inline-block;background:#3E7A52;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;margin-right:12px">Visit Confirmed</a>` +
      `<a href="${rejectUrl}" style="display:inline-block;background:#A23B3B;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px">Visit Not Confirmed</a>` +
      '</p>' +
      '<p style="margin-top:16px;color:#888;font-size:12px">Customer will NOT receive any email — they will see the status on the website\'s Status page.</p>' +
      '</div>';

    let emailSent = false;
    let emailError = null;

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const ownerEmail = process.env.OWNER_EMAIL || gmailUser;

    if (!gmailUser || !gmailPass || !ownerEmail) {
      emailError = 'Missing env vars: GMAIL_USER / GMAIL_APP_PASSWORD / OWNER_EMAIL — set them in Vercel → Settings → Environment Variables';
      console.error(emailError);
    } else {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: gmailUser,
            pass: gmailPass
          }
        });

        await transporter.sendMail({
          from: `"High Standard Apartment" <${gmailUser}>`,
          to: ownerEmail,
          subject: `New Visit Booking — ${record.name || bookingId}`,
          html: ownerHtml
        });
        emailSent = true;
      } catch (mailErr) {
        // Booking is already saved to KV even if the email fails
        emailError = String((mailErr && mailErr.message) || mailErr);
        console.error('Owner email failed:', mailErr);
      }
    }

    return res.status(200).json({
      ok: true,
      bookingId,
      emailSent,
      emailError: emailError || undefined
    });
  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ ok: false, error: String((err && err.message) || err) });
  }
};
