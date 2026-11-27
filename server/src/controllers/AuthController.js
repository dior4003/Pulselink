const { hashPassword, verifyPassword, signToken } = require('../auth');
const { UserModel } = require('../models/UserModel');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const AuthController = {
  async register(req, res) {
    try {
      const { email, username, phone, displayName, password } = req.body || {};
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ error: 'To‘g‘ri email manzilini kiriting' });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo‘lishi kerak' });
      }
      if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) {
        return res.status(400).json({ error: 'Username 3-24 ta harf, raqam yoki _ dan iborat bo‘lishi kerak' });
      }
      if (await UserModel.findByIdentifier(email)) {
        return res.status(409).json({ error: 'Bu email allaqachon ro‘yxatdan o‘tgan' });
      }
      if (username && (await UserModel.isUsernameTaken(username, ''))) {
        return res.status(409).json({ error: 'Bu username allaqachon band' });
      }

      const user = await UserModel.create({
        email,
        username: username || null,
        phone: phone || null,
        displayName: displayName || email.split('@')[0],
        passwordHash: hashPassword(password),
      });
      const token = signToken({ userId: user.id });
      res.status(201).json({ token, user });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Bu email yoki username allaqachon band' });
      }
      res.status(500).json({ error: 'Ro‘yxatdan o‘tishda xatolik: ' + err.message });
    }
  },

  async login(req, res) {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/username va parolni kiriting' });
      }
      const userRecord = await UserModel.findByIdentifier(identifier);
      if (!userRecord || !userRecord.password_hash || !verifyPassword(password, userRecord.password_hash)) {
        return res.status(401).json({ error: 'Email/username yoki parol noto‘g‘ri' });
      }
      const token = signToken({ userId: userRecord.id });
      const user = await UserModel.findById(userRecord.id);
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: 'Kirishda xatolik: ' + err.message });
    }
  },

  async googleLogin(req, res) {
    try {
      const { idToken } = req.body || {};
      if (!idToken) {
        return res.status(400).json({ error: 'Google ID token yuborilmadi' });
      }
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!verifyRes.ok) {
        return res.status(401).json({ error: 'Google tokeni tasdiqlanmadi' });
      }
      const info = await verifyRes.json();
      if (GOOGLE_CLIENT_ID && info.aud !== GOOGLE_CLIENT_ID) {
        return res.status(401).json({ error: 'Google Client ID mos kelmadi' });
      }
      if (!info.email || info.email_verified !== 'true') {
        return res.status(401).json({ error: 'Google email tasdiqlanmagan' });
      }

      const existing = await UserModel.findByEmailOrGoogleId(info.email, info.sub);
      const user = existing
        ? await UserModel.linkGoogleId(existing.id, info.sub, info.picture)
        : await UserModel.create({
            email: info.email,
            googleId: info.sub,
            displayName: info.name || info.email.split('@')[0],
            avatarUrl: info.picture || null,
          });
      const token = signToken({ userId: user.id });
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: 'Google orqali kirishda xatolik: ' + err.message });
    }
  },
};

module.exports = { AuthController };
