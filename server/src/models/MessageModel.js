const crypto = require('crypto');
const { getPool } = require('../config/db');

function getChatId(a, b) {
  return [a, b].sort().join('__');
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    chatId: row.chat_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    text: row.text,
    type: row.type || 'text',
    mediaUrl: row.media_url || null,
    status: row.status,
    createdAt: row.created_at,
  };
}

const MessageModel = {
  async create({ senderId, receiverId, text, type = 'text', mediaUrl = null }) {
    const id = crypto.randomUUID();
    const chatId = getChatId(senderId, receiverId);
    await getPool().query(
      `INSERT INTO messages (id, chat_id, sender_id, receiver_id, text, type, media_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sent')`,
      [id, chatId, senderId, receiverId, String(text || ''), type, mediaUrl]
    );
    const [rows] = await getPool().query(`SELECT * FROM messages WHERE id = ? LIMIT 1`, [id]);
    return mapMessage(rows[0]);
  },

  async getConversation(userId, peerId) {
    const chatId = getChatId(userId, peerId);
    await getPool().query(
      `UPDATE messages SET status = 'read' WHERE chat_id = ? AND receiver_id = ? AND status <> 'read'`,
      [chatId, userId]
    );
    const [rows] = await getPool().query(
      `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`,
      [chatId]
    );
    return rows.map(mapMessage);
  },

  async searchMessages(userId, query) {
    const q = `%${query.trim().toLowerCase()}%`;
    const [rows] = await getPool().query(
      `SELECT m.*, u.id AS peer_id, u.display_name AS peer_display_name, u.username AS peer_username, u.avatar_color AS peer_avatar_color, u.email AS peer_email
       FROM messages m
       INNER JOIN users u ON u.id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
       WHERE (m.sender_id = ? OR m.receiver_id = ?) AND LOWER(m.text) LIKE ?
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [userId, userId, userId, q]
    );
    return rows.map((r) => ({
      message: mapMessage(r),
      peer: {
        id: r.peer_id,
        email: r.peer_email,
        username: r.peer_username || '',
        displayName: r.peer_display_name,
        avatarColor: r.peer_avatar_color || '#6366F1',
      },
    }));
  },

  async markRead(userId, peerId) {
    const chatId = getChatId(userId, peerId);
    const [res] = await getPool().query(
      `UPDATE messages SET status = 'read' WHERE chat_id = ? AND receiver_id = ? AND status <> 'read'`,
      [chatId, userId]
    );
    return res.affectedRows > 0;
  },

  async getChatsForUser(userId) {
    const [rows] = await getPool().query(
      `SELECT m.*,
              u.id AS peer_id, u.email AS peer_email, u.username AS peer_username,
              u.phone AS peer_phone, u.display_name AS peer_display_name,
              u.bio AS peer_bio, u.avatar_color AS peer_avatar_color,
              u.avatar_url AS peer_avatar_url, u.created_at AS peer_created_at,
              u.last_seen AS peer_last_seen,
              (SELECT COUNT(*) FROM messages um
               WHERE um.chat_id = m.chat_id AND um.receiver_id = ? AND um.status <> 'read') AS unread_count
       FROM messages m
       INNER JOIN (
         SELECT chat_id, MAX(created_at) AS max_dt
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         GROUP BY chat_id
       ) latest ON latest.chat_id = m.chat_id AND latest.max_dt = m.created_at
       INNER JOIN users u ON u.id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
       ORDER BY m.created_at DESC`,
      [userId, userId, userId, userId]
    );

    return rows.map((r) => ({
      peer: {
        id: r.peer_id,
        email: r.peer_email,
        username: r.peer_username || '',
        phone: r.peer_phone || '',
        displayName: r.peer_display_name,
        bio: r.peer_bio || '',
        avatarColor: r.peer_avatar_color || '#6366F1',
        avatarUrl: r.peer_avatar_url || null,
        createdAt: r.peer_created_at,
        lastSeen: r.peer_last_seen,
      },
      lastMessage: mapMessage(r),
      unreadCount: Number(r.unread_count || 0),
    }));
  },
};

module.exports = { MessageModel };
