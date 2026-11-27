const crypto = require('crypto');
const { getPool } = require('../config/db');
const { mapUser } = require('./UserModel');

const ModeratorModel = {
  async getStats() {
    const [[{ totalUsers }]] = await getPool().query(`SELECT COUNT(*) AS totalUsers FROM users`);
    const [[{ bannedUsers }]] = await getPool().query(`SELECT COUNT(*) AS bannedUsers FROM users WHERE is_banned = 1`);
    const [[{ mutedUsers }]] = await getPool().query(`SELECT COUNT(*) AS mutedUsers FROM users WHERE muted_until > NOW()`);
    const [[{ totalMessages }]] = await getPool().query(`SELECT COUNT(*) AS totalMessages FROM messages`);
    const [[{ totalCalls }]] = await getPool().query(`SELECT COUNT(*) AS totalCalls FROM calls`);
    const [[{ openReports }]] = await getPool().query(`SELECT COUNT(*) AS openReports FROM reports WHERE status = 'open'`);
    return { totalUsers, bannedUsers, mutedUsers, totalMessages, totalCalls, openReports };
  },

  async listAllUsers() {
    const [rows] = await getPool().query(`SELECT * FROM users ORDER BY created_at DESC LIMIT 200`);
    return rows.map(mapUser);
  },

  async setBan(userId, isBanned) {
    await getPool().query(`UPDATE users SET is_banned = ? WHERE id = ?`, [isBanned ? 1 : 0, userId]);
  },

  async muteUser(userId, minutes) {
    if (!minutes || minutes <= 0) {
      await getPool().query(`UPDATE users SET muted_until = NULL WHERE id = ?`, [userId]);
      return null;
    }
    const until = new Date(Date.now() + minutes * 60000);
    await getPool().query(`UPDATE users SET muted_until = ? WHERE id = ?`, [until, userId]);
    return until.toISOString();
  },

  async warnUser(userId) {
    await getPool().query(`UPDATE users SET warnings_count = warnings_count + 1 WHERE id = ?`, [userId]);
  },

  async setRole(userId, role) {
    await getPool().query(`UPDATE users SET role = ? WHERE id = ?`, [role, userId]);
  },

  async searchMessages(query = '') {
    const q = `%${query.trim().toLowerCase()}%`;
    const [rows] = await getPool().query(
      `SELECT m.id, m.text, m.type, m.created_at,
              s.display_name AS sender_name, r.display_name AS receiver_name
       FROM messages m
       INNER JOIN users s ON s.id = m.sender_id
       INNER JOIN users r ON r.id = m.receiver_id
       WHERE LOWER(m.text) LIKE ?
       ORDER BY m.created_at DESC
       LIMIT 60`,
      [q]
    );
    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      type: r.type,
      createdAt: r.created_at,
      senderName: r.sender_name,
      receiverName: r.receiver_name,
    }));
  },

  async createReport({ reporterId, targetUserId, reason }) {
    const id = crypto.randomUUID();
    await getPool().query(
      `INSERT INTO reports (id, reporter_id, target_user_id, reason) VALUES (?, ?, ?, ?)`,
      [id, reporterId, targetUserId, String(reason || '').slice(0, 255)]
    );
    return id;
  },

  async listReports() {
    const [rows] = await getPool().query(
      `SELECT r.*,
              rep.display_name AS reporter_name,
              tgt.display_name AS target_name
       FROM reports r
       INNER JOIN users rep ON rep.id = r.reporter_id
       INNER JOIN users tgt ON tgt.id = r.target_user_id
       ORDER BY r.created_at DESC
       LIMIT 100`
    );
    return rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
      reporterName: r.reporter_name,
      targetUserId: r.target_user_id,
      targetName: r.target_name,
    }));
  },

  async resolveReport(reportId) {
    await getPool().query(`UPDATE reports SET status = 'resolved' WHERE id = ?`, [reportId]);
  },

  async deleteMessage(messageId) {
    await getPool().query(`DELETE FROM messages WHERE id = ?`, [messageId]);
  },

  async logAction({ moderatorId, action, targetId = null, details = null }) {
    const id = crypto.randomUUID();
    await getPool().query(
      `INSERT INTO mod_logs (id, moderator_id, action, target_id, details) VALUES (?, ?, ?, ?, ?)`,
      [id, moderatorId, action, targetId, details ? String(details).slice(0, 255) : null]
    );
  },

  async listLogs() {
    const [rows] = await getPool().query(
      `SELECT l.*, u.display_name AS moderator_name
       FROM mod_logs l
       INNER JOIN users u ON u.id = l.moderator_id
       ORDER BY l.created_at DESC
       LIMIT 80`
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetId: r.target_id,
      details: r.details,
      moderatorName: r.moderator_name,
      createdAt: r.created_at,
    }));
  },
};

module.exports = { ModeratorModel };
