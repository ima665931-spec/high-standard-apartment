const nodemailer = require('nodemailer');
const crypto = require('crypto');

function sign(bookingId, email) {
  return crypto
    .createHmac('sha256', process.env.TOKEN_SECRET || 'change-me')
    .update(bookingId + '|' + email)
    .digest('base64url')
    .slice(0, 24);
}

function row(label, value) {
  return (
    '<tr><td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;width:140px">' +
    label +
    '</td><td style="padding:6px 8px;border-bottom:1px solid #eee">' +
    (value || '—') +
    '</td></tr>'
  );
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Vercel parses JSON bodies automatically when Content-Type is application/json.
    // booking.html sends it as text/plain (for simplicity), so parse manually if needed.
    let data = req.body;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        data = {};
      }
    }
    data = data || {};

    const bookingId = String(
      data.bookingId || 'HSA-' + Date.now().toString(36).toUpperCase()
    ).toUpperCase();
    const name = data.name || '';
    const email = data.email || '';

    const transporter = getTransporter();

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const base = proto + '://' + req.headers.host;

    let ownerHtml =
      '<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.5">' +
      '<h2 style="color:#1C2430">New Visit Booking</h2>' +
      '<p><b>Booking ID:</b> ' + bookingId + '</p>' +
      '<table style="border-collapse:collapse;width:100%">' +
      row('Name', name) +
      row('Mobile', data.mobile) +
      row('Email', email) +
      row('Address', data.address) +
      row('Visitors', data.visitors) +
      row('Visit Date', data.visitDate) +
      row('Visit Slot', data.visitSlot) +
      row('Flat', data.propertyTitle) +
      row('Area', data.area) +
      row('BHK', data.bhk) +
      row('Rent', data.rent) +
      row('Deposit', data.deposit) +
      row('Fee', 'Rs. ' + (data.amount || 199)) +
      row('UTR', '<b style="color:#B85C33">' + (data.utr || '') + '</b>') +
      row('Notes', data.notes) +
      '</table>';

    try {
      const token = sign(bookingId, email);
      const confirmUrl =
        base +
        '/api/decision?action=confirm&id=' +
        encodeURIComponent(bookingId) +
        '&email=' +
        encodeURIComponent(email) +
        '&name=' +
        encodeURIComponent(name) +
        '&t=' +
        encodeURIComponent(token);
      const rejectUrl =
        base +
        '/api/decision?action=reject&id=' +
        encodeURIComponent(bookingId) +
        '&email=' +
        encodeURIComponent(email) +
        '&name=' +
        encodeURIComponent(name) +
        '&t=' +
        encodeURIComponent(token);

      ownerHtml +=
        '<p style="margin-top:24px">Verify UTR, then choose:</p>' +
        '<p>' +
        '<a href="' + confirmUrl + '" style="display:inline-block;background:#3E7A52;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px;margin-right:12px">Visit Confirmed</a>' +
        '<a href="' + rejectUrl + '" style="display:inline-block;background:#A23B3B;color:#fff;padding:12px 20px;text-decoration:none;border-radius:4px">Visit Not Confirmed</a>' +
        '</p>';
    } catch (eTok) {
      ownerHtml += '<p style="color:#A23B3B">Token/buttons error: ' + eTok + '</p>';
    }
    ownerHtml += '</div>';

    // 1) Email the owner FIRST — this is the whole point.
    await transporter.sendMail({
      from: '"High Standard Apartment" <' + process.env.SMTP_USER + '>',
      to: process.env.OWNER_EMAIL,
      subject: 'New Visit Booking — ' + (name || bookingId),
      html: ownerHtml,
    });

    // 2) Ack email to the customer (best-effort, don't fail the request if this fails).
    if (email) {
      try {
        await transporter.sendMail({
          from: '"High Standard Apartment" <' + process.env.SMTP_USER + '>',
          to: email,
          subject: 'We received your visit request — High Standard Apartment',
          html:
            '<div style="font-family:Arial,sans-serif;max-width:520px">' +
            '<h2>Request received</h2>' +
            '<p>Hi ' + (name || '') + ',</p>' +
            '<p>We got your visit booking for <b>' + (data.propertyTitle || 'the flat') + '</b>.</p>' +
            '<p><b>Booking ID: ' + bookingId + '</b><br>UTR: ' + (data.utr || '') + '</p>' +
            '<p>You will get an email as soon as we verify the payment and confirm your visit.</p>' +
            '<p>— High Standard Apartment, Jaipur</p></div>',
        });
      } catch (eUser) {
        console.error('User ack email failed:', eUser);
      }
    }

    res.status(200).json({ ok: true, bookingId: bookingId });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
};
