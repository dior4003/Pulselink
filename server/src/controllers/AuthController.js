const crypto = require('crypto');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const { UserModel } = require('../models/UserModel');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const AuthController = {
  async register(req, res) {
    try {
      const { email, username, phone, displayName, password } = req.body || {};
      const cleanEmail = (email || '').trim();
      const cleanPhone = (phone || '').trim();

      if (!cleanEmail && !cleanPhone) {
        return res.status(400).json({ error: 'Email yoki telefon raqamini kiriting' });
      }
      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'To‘g‘ri email manzilini kiriting' });
      }
      if (cleanPhone && !/^\+?[0-9\s()-]{7,20}$/.test(cleanPhone)) {
        return res.status(400).json({ error: 'To‘g‘ri telefon raqamini kiriting (masalan: +998901234567)' });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo‘lishi kerak' });
      }
      if (username && !/^[a-zA-Z0-9_]{3,24}$/.test(username.trim())) {
        return res.status(400).json({ error: 'Username 3-24 ta harf, raqam yoki _ dan iborat bo‘lishi kerak' });
      }

      if (cleanEmail && (await UserModel.findByIdentifier(cleanEmail))) {
        return res.status(409).json({ error: 'Bu email allaqachon ro‘yxatdan o‘tgan' });
      }
      if (cleanPhone && (await UserModel.findByIdentifier(cleanPhone))) {
        return res.status(409).json({ error: 'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan' });
      }
      if (username && (await UserModel.isUsernameTaken(username, ''))) {
        return res.status(409).json({ error: 'Bu username allaqachon band' });
      }

      const fallbackName = cleanEmail ? cleanEmail.split('@')[0] : cleanPhone;
      const user = await UserModel.create({
        email: cleanEmail || null,
        username: username || null,
        phone: cleanPhone || null,
        displayName: displayName || fallbackName,
        passwordHash: hashPassword(password),
      });
      const token = signToken({ userId: user.id });
      res.status(201).json({ token, user });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Bu email, telefon yoki username allaqachon band' });
      }
      res.status(500).json({ error: 'Ro‘yxatdan o‘tishda xatolik: ' + err.message });
    }
  },

  async login(req, res) {
    try {
      const { identifier, password } = req.body || {};
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email, telefon yoki username hamda parolni kiriting' });
      }
      const userRecord = await UserModel.findByIdentifier(identifier);
      if (!userRecord || !userRecord.password_hash || !verifyPassword(password, userRecord.password_hash)) {
        return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
      }
      if (userRecord.is_banned) {
        return res.status(403).json({ error: 'Sizning hisobingiz moderator tomonidan bloklangan' });
      }
      const token = signToken({ userId: userRecord.id });
      const user = await UserModel.findById(userRecord.id);
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: 'Kirishda xatolik: ' + err.message });
    }
  },

  async forgotPassword(req, res) {
    try {
      const { identifier } = req.body || {};
      if (!identifier) {
        return res.status(400).json({ error: 'Email, telefon yoki username kiriting' });
      }
      const userRecord = await UserModel.findByIdentifier(identifier);
      if (!userRecord) {
        return res.status(404).json({ error: 'Bunday foydalanuvchi topilmadi' });
      }
      const code = String(crypto.randomInt(100000, 999999));
      await UserModel.createResetCode(userRecord.id, code);

      const response = { ok: true, message: '6 xonali tiklash kodi yaratildi (10 daqiqa amal qiladi)' };
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = code;
      }
      res.json(response);
    } catch (err) {
      res.status(500).json({ error: 'Kod yuborishda xatolik: ' + err.message });
    }
  },

  async resetPassword(req, res) {
    try {
      const { identifier, code, newPassword } = req.body || {};
      if (!identifier || !code || !newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Login, 6 xonali kod va kamida 4 belgili yangi parolni kiriting' });
      }
      const userRecord = await UserModel.findByIdentifier(identifier);
      if (!userRecord) {
        return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
      }
      const valid = await UserModel.verifyAndConsumeResetCode(userRecord.id, code);
      if (!valid) {
        return res.status(400).json({ error: 'Kod noto‘g‘ri yoki muddati tugagan' });
      }
      await UserModel.updatePassword(userRecord.id, hashPassword(newPassword));
      res.json({ ok: true, message: 'Parol muvaffaqiyatli yangilandi' });
    } catch (err) {
      res.status(500).json({ error: 'Parolni tiklashda xatolik: ' + err.message });
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
      if (user.isBanned) {
        return res.status(403).json({ error: 'Sizning hisobingiz moderator tomonidan bloklangan' });
      }
      const token = signToken({ userId: user.id });
      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: 'Google orqali kirishda xatolik: ' + err.message });
    }
  },
};

module.exports = { AuthController };
