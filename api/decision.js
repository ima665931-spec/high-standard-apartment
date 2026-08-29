const nodemailer = require('nodemailer');
const crypto = require('crypto');

function sign(bookingId, email) {
  return crypto
    .createHmac('sha256', process.env.TOKEN_SECRET || 'change-me')
    .update(bookingId + '|' + email)
    .digest('base64url')
    .slice(0, 24);
}

function htmlPage(title, msg) {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title></head>' +
    '<body style="font-family:Arial,sans-serif;padding:40px;max-width:480px;margin:auto">' +
    '<h2>' + title + '</h2><p>' + msg + '</p>' +
    '<p style="color:#888;font-size:13px">You can close this tab.</p></body></html>'
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
  const q = req.query || {};
  const id = String(q.id || '');
  const email = String(q.email || '');
  const name = String(q.name || '');
  const t = String(q.t || '');
  const action = String(q.action || '');

  const expected = sign(id, email);

  res.setHeader('Content-Type', 'text/html');

  if (!id || !email || t !== expected || (action !== 'confirm' && action !== 'reject')) {
    res.status(400).send(htmlPage('Invalid link', 'This confirmation link is invalid or has expired.'));
    return;
  }

  const newStatus = action === 'confirm' ? 'Confirmed' : 'Not Confirmed';

  try {
    const transporter = getTransporter();

    if (action === 'confirm') {
      await transporter.sendMail({
        from: '"High Standard Apartment" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: 'Your visit is confirmed — High Standard Apartment',
        html:
          '<div style="font-family:Arial,sans-serif;max-width:520px">' +
          '<h2 style="color:#3E7A52">Visit Confirmed</h2>' +
          '<p>Hi ' + (name || '') + ',</p>' +
          '<p><b>Your visit is confirmed.</b> Our Agent will reach you soon.</p>' +
          '<p>Booking ID: ' + id + '</p>' +
          '<p>— High Standard Apartment, Jaipur</p></div>',
      });
    } else {
      await transporter.sendMail({
        from: '"High Standard Apartment" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: 'Visit not confirmed — High Standard Apartment',
        html:
          '<div style="font-family:Arial,sans-serif;max-width:520px">' +
          '<h2 style="color:#A23B3B">Visit Not Confirmed</h2>' +
          '<p>Hi ' + (name || '') + ',</p>' +
          '<p><b>Your visiting fee was due</b> / payment could not be verified.</p>' +
          '<p>Booking ID: ' + id + '</p>' +
          '<p>— High Standard Apartment, Jaipur</p></div>',
      });
    }

    await transporter.sendMail({
      from: '"High Standard Apartment" <' + process.env.SMTP_USER + '>',
      to: process.env.OWNER_EMAIL,
      subject: 'Booking ' + newStatus + ' — ' + id,
      html: '<p>Booking <b>' + id + '</b> marked as <b>' + newStatus + '</b>. Customer has been emailed.</p>',
    });

    res.status(200).send(htmlPage(newStatus, 'Done. Customer has been emailed.'));
  } catch (err) {
    console.error('Decision error:', err);
    res.status(500).send(htmlPage('Error', 'Could not send the email: ' + String(err && err.message ? err.message : err)));
  }
};
