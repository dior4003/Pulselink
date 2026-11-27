const { verifyToken } = require('../auth');
const { UserModel } = require('../models/UserModel');

async function moderatorMiddleware(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload || !payload.userId || payload.scope !== 'moderator') {
      return res.status(403).json({ error: 'Moderator autentifikatsiyasi talab qilinadi' });
    }
    const user = await UserModel.findById(payload.userId);
    if (!user || user.isBanned || (user.role !== 'moderator' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Moderator huquqi yo‘q' });
    }
    req.moderator = user;
    next();
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
}

module.exports = { moderatorMiddleware };
