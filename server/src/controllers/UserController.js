const { UserModel } = require('../models/UserModel');
const { isOnline } = require('./SocketController');

const UserController = {
  getMe(req, res) {
    res.json({ user: { ...req.user, online: true } });
  },

  async updateMe(req, res) {
    try {
      const { displayName, username, bio, phone, avatarColor } = req.body || {};
      if (typeof username === 'string' && username.trim()) {
        const clean = username.trim();
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(clean)) {
          return res.status(400).json({
            error: 'Username 3-24 ta harf, raqam yoki _ belgisidan iborat bo‘lishi kerak',
          });
        }
        if (await UserModel.isUsernameTaken(clean, req.user.id)) {
          return res.status(409).json({ error: 'Bu username allaqachon band' });
        }
      }
      const updated = await UserModel.updateProfile(req.user.id, {
        displayName,
        username,
        bio,
        phone,
        avatarColor,
      });
      res.json({ user: { ...updated, online: isOnline(updated.id) } });
    } catch (err) {
      res.status(500).json({ error: 'Profilni yangilashda xatolik: ' + err.message });
    }
  },

  async listUsers(req, res) {
    const q = String(req.query.q || '');
    const users = (await UserModel.listOthers(req.user.id, q)).map((u) => ({
      ...u,
      online: isOnline(u.id),
    }));
    res.json({ users });
  },
};

module.exports = { UserController };
