const crypto = require('crypto');
const { getPool } = require('../config/db');
const { mapUser } = require('./UserModel');

const FriendModel = {
  async sendRequest(userId, friendId) {
    if (userId === friendId) throw new Error('O‘zingizga do‘stlik so‘rovi yubora olmaysiz');
    const [existing] = await getPool().query(
      `SELECT * FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?) LIMIT 1`,
      [userId, friendId, friendId, userId]
    );
    if (existing.length > 0) {
      if (existing[0].status === 'accepted') throw new Error('Siz allaqachon do‘stsiz');
      if (existing[0].friend_id === userId && existing[0].status === 'pending') {
        await getPool().query(`UPDATE friendships SET status = 'accepted' WHERE id = ?`, [existing[0].id]);
        return { id: existing[0].id, status: 'accepted' };
      }
      return { id: existing[0].id, status: existing[0].status };
    }
    const id = crypto.randomUUID();
    await getPool().query(
      `INSERT INTO friendships (id, user_id, friend_id, status) VALUES (?, ?, ?, 'pending')`,
      [id, userId, friendId]
    );
    return { id, status: 'pending' };
  },

  async acceptRequest(friendshipId, currentUserId) {
    const [res] = await getPool().query(
      `UPDATE friendships SET status = 'accepted' WHERE id = ? AND friend_id = ? AND status = 'pending'`,
      [friendshipId, currentUserId]
    );
    return res.affectedRows > 0;
  },

  async removeFriend(userId, peerId) {
    const [res] = await getPool().query(
      `DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
      [userId, peerId, peerId, userId]
    );
    return res.affectedRows > 0;
  },

  async listForUser(userId) {
    const [rows] = await getPool().query(
      `SELECT f.id AS rel_id, f.user_id, f.friend_id, f.status, u.*
       FROM friendships f
       INNER JOIN users u ON u.id = IF(f.user_id = ?, f.friend_id, f.user_id)
       WHERE f.user_id = ? OR f.friend_id = ?
       ORDER BY f.created_at DESC`,
      [userId, userId, userId]
    );

    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    for (const r of rows) {
      const peer = mapUser(r);
      if (r.status === 'accepted') {
        friends.push({ relationId: r.rel_id, peer });
      } else if (r.status === 'pending') {
        if (r.friend_id === userId) {
          incomingRequests.push({ relationId: r.rel_id, peer });
        } else {
          outgoingRequests.push({ relationId: r.rel_id, peer });
        }
      }
    }
    return { friends, incomingRequests, outgoingRequests };
  },
};

module.exports = { FriendModel };
