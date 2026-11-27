const authHits = new Map();

function authRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = authHits.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  authHits.set(ip, entry);
  if (entry.count > 25) {
    return res.status(429).json({ error: 'Juda ko‘p urinish. 1 daqiqadan so‘ng urinib ko‘ring.' });
  }
  next();
}

module.exports = { authRateLimit };
