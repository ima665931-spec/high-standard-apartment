const { redis, redisConfigured } = require('./_lib/redis');

module.exports = async (req, res) => {
  const { id, t, action } = req.query;
  const bookingId = String(id || '').trim().toUpperCase();

  if (!bookingId || !t || (action !== 'confirm' && action !== 'reject')) {
    return htmlPage(res, 'Error', 'Invalid link.');
  }

  if (!redisConfigured || !redis) {
    return htmlPage(res, 'Error', 'Database not configured — KV_REST_API_URL/TOKEN env vars are missing.');
  }

  try {
    const record = await redis.get(`booking:${bookingId}`);

    if (!record || record.token !== t) {
      return htmlPage(res, 'Error', 'Invalid or expired link.');
    }

    if (record.status && record.status !== 'Pending') {
      return htmlPage(res, 'Already processed', `This booking was already marked as: ${record.status}`);
    }

    const newStatus = action === 'confirm' ? 'Confirmed' : 'Not Confirmed';
    record.status = newStatus;
    record.decidedAt = new Date().toISOString();

    await redis.set(`booking:${bookingId}`, record);

    // No email to customer here — they will see it on the Status page.
    return htmlPage(
      newStatus,
      `Booking <b>${bookingId}</b> marked as <b>${newStatus}</b>. Customer has NOT been emailed — they will see this when they check status on the website.`
    );
  } catch (err) {
    console.error('Decision error:', err);
    return htmlPage(res, 'Error', 'Something went wrong. Please try again.');
  }
};

function htmlPage(res, title, msg) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    `<title>${title}</title></head>` +
    '<body style="font-family:Arial,sans-serif;padding:40px;max-width:480px;margin:auto">' +
    `<h2>${title}</h2><p>${msg}</p>` +
    '<p style="color:#888;font-size:13px">You can close this tab.</p></body></html>'
  );
}
