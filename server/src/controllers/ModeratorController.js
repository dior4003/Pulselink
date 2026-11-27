const { verifyPassword, signToken } = require('../auth');
const { UserModel } = require('../models/UserModel');
const { ModeratorModel } = require('../models/ModeratorModel');
const {
  sendToUser,
  broadcastSystemAnnouncement,
  listActiveCalls,
  forceTerminateCall,
} = require('./SocketController');

const ModeratorController = {
  async login(req, res) {
    try {
      const { identifier, password, modPasskey } = req.body || {};
      const expectedKey = process.env.MOD_PASSKEY || 'pulselink-mod-2026';
      if (!modPasskey || modPasskey !== expectedKey) {
        return res.status(403).json({ error: 'Moderator maxfiy kaliti noto‘g‘ri' });
      }
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Login va parolni kiriting' });
      }
      const userRecord = await UserModel.findByIdentifier(identifier);
      if (!userRecord || !userRecord.password_hash || !verifyPassword(password, userRecord.password_hash)) {
        return res.status(401).json({ error: 'Login yoki parol noto‘g‘ri' });
      }
      if (userRecord.role !== 'moderator' && userRecord.role !== 'admin') {
        return res.status(403).json({ error: 'Bu hisobga moderatorlik huquqi berilmagan' });
      }
      if (userRecord.is_banned) {
        return res.status(403).json({ error: 'Hisob bloklangan' });
      }

      const modToken = signToken({
        userId: userRecord.id,
        role: userRecord.role,
        scope: 'moderator',
      });
      const moderator = await UserModel.findById(userRecord.id);
      await ModeratorModel.logAction({ moderatorId: userRecord.id, action: 'mod_login' });
      res.json({ modToken, moderator });
    } catch (err) {
      res.status(500).json({ error: 'Moderator kirishida xatolik: ' + err.message });
    }
  },

  async stats(_req, res) {
    const stats = await ModeratorModel.getStats();
    res.json({ stats, activeCallsCount: listActiveCalls().length });
  },

  async listUsers(_req, res) {
    const users = await ModeratorModel.listAllUsers();
    res.json({ users });
  },

  async toggleBan(req, res) {
    const { isBanned } = req.body || {};
    if (req.params.id === req.moderator.id) {
      return res.status(400).json({ error: 'O‘zingizni bloklay olmaysiz' });
    }
    await ModeratorModel.setBan(req.params.id, Boolean(isBanned));
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: isBanned ? 'ban_user' : 'unban_user',
      targetId: req.params.id,
    });
    res.json({ ok: true });
  },

  async muteUser(req, res) {
    const minutes = Number(req.body?.minutes || 0);
    if (req.params.id === req.moderator.id) {
      return res.status(400).json({ error: 'O‘zingizga mute qo‘ya olmaysiz' });
    }
    const until = await ModeratorModel.muteUser(req.params.id, minutes);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: minutes > 0 ? 'mute_user' : 'unmute_user',
      targetId: req.params.id,
      details: minutes > 0 ? `${minutes} daqiqa` : 'Mute olib tashlandi',
    });
    sendToUser(req.params.id, 'mod:notice', {
      message: minutes > 0 ? `Siz ${minutes} daqiqaga cheklandingiz (Mute)` : 'Cheklovingiz olib tashlandi',
    });
    res.json({ ok: true, mutedUntil: until });
  },

  async warnUser(req, res) {
    const reason = String(req.body?.reason || 'Qoidalarga rioya qiling').trim();
    await ModeratorModel.warnUser(req.params.id);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'warn_user',
      targetId: req.params.id,
      details: reason,
    });
    sendToUser(req.params.id, 'mod:notice', { message: `⚠️ Moderator ogohlantirishi: ${reason}` });
    res.json({ ok: true });
  },

  async setRole(req, res) {
    if (req.moderator.role !== 'admin') {
      return res.status(403).json({ error: 'Rolni faqat Admin o‘zgartira oladi' });
    }
    const role = req.body?.role;
    if (!['user', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'Noto‘g‘ri rol' });
    }
    await ModeratorModel.setRole(req.params.id, role);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'set_role',
      targetId: req.params.id,
      details: role,
    });
    res.json({ ok: true });
  },

  async listMessages(req, res) {
    const q = String(req.query.q || '');
    const messages = await ModeratorModel.searchMessages(q);
    res.json({ messages });
  },

  async deleteMessage(req, res) {
    await ModeratorModel.deleteMessage(req.params.id);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'delete_message',
      targetId: req.params.id,
    });
    res.json({ ok: true });
  },

  async listActiveCalls(_req, res) {
    res.json({ calls: listActiveCalls() });
  },

  async terminateCall(req, res) {
    const ok = await forceTerminateCall(req.params.id);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'terminate_call',
      targetId: req.params.id,
    });
    res.json({ ok });
  },

  async broadcast(req, res) {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'E’lon matnini kiriting' });
    broadcastSystemAnnouncement(text, req.moderator.displayName);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'broadcast',
      details: text,
    });
    res.json({ ok: true });
  },

  async listReports(_req, res) {
    const reports = await ModeratorModel.listReports();
    res.json({ reports });
  },

  async resolveReport(req, res) {
    await ModeratorModel.resolveReport(req.params.id);
    await ModeratorModel.logAction({
      moderatorId: req.moderator.id,
      action: 'resolve_report',
      targetId: req.params.id,
    });
    res.json({ ok: true });
  },

  async listLogs(_req, res) {
    const logs = await ModeratorModel.listLogs();
    res.json({ logs });
  },

  async submitReport(req, res) {
    const { targetUserId, reason } = req.body || {};
    if (!targetUserId || !reason) {
      return res.status(400).json({ error: 'Shikoyat sababini kiriting' });
    }
    const id = await ModeratorModel.createReport({
      reporterId: req.user.id,
      targetUserId,
      reason,
    });
    res.status(201).json({ id, ok: true });
  },
};

module.exports = { ModeratorController };
