const { verifyToken } = require('../auth');
const { UserModel } = require('../models/UserModel');

async function authMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const token = bearerToken || queryToken;

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: 'Sizning hisobingiz moderator tomonidan bloklangan' });
    }
    req.user = user;
    next();
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
}

module.exports = { authMiddleware };
