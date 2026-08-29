const { redis, redisConfigured } = require('./_lib/redis');

module.exports = async (req, res) => {
  const src = req.method === 'GET' ? req.query : (req.body || {});
  const bookingId = String(src.id || src.bookingId || '').trim().toUpperCase();
  const mobile = String(src.mobile || '').replace(/\D/g, '').slice(-10);

  if (!bookingId || mobile.length !== 10) {
    return res.status(200).json({ ok: false, error: 'Booking ID and 10-digit mobile required' });
  }

  if (!redisConfigured || !redis) {
    return res.status(200).json({
      ok: false,
      error: 'Database not configured — KV_REST_API_URL/TOKEN env vars are missing. Connect Upstash in Vercel → Storage, then redeploy.'
    });
  }

  try {
    const record = await redis.get(`booking:${bookingId}`);

    if (!record || record.mobile !== mobile) {
      return res.status(200).json({ ok: false, error: 'No booking found for this ID and mobile' });
    }

    return res.status(200).json({
      ok: true,
      bookingId: record.bookingId,
      name: record.name,
      propertyTitle: record.propertyTitle,
      area: record.area,
      visitDate: record.visitDate,
      visitSlot: record.visitSlot,
      utr: record.utr,
      status: record.status || 'Pending',
      message: statusMessage(record.status)
    });
  } catch (err) {
    console.error('Status error:', err);
    return res.status(200).json({ ok: false, error: 'Server error, please try again' });
  }
};

function statusMessage(status) {
  const s = String(status || 'Pending').toLowerCase();
  if (s.indexOf('confirm') >= 0 && s.indexOf('not') < 0) {
    return 'Your visit is confirmed. Our Agent will reach you soon.';
  }
  if (s.indexOf('not') >= 0 || s.indexOf('reject') >= 0) {
    return 'Your visiting fee was due / payment could not be verified. Please contact us if you already paid.';
  }
  return 'Payment verification is in progress. Usually confirmed within a few hours.';
}
