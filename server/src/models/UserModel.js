const crypto = require('crypto');
const { getPool } = require('../config/db');

const AVATAR_PALETTE = ['#6366F1', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B', '#3B82F6', '#F43F5E'];

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username || '',
    inviteCode: row.invite_code || '',
    phone: row.phone || '',
    displayName: row.display_name,
    bio: row.bio || '',
    avatarColor: row.avatar_color || '#6366F1',
    avatarUrl: row.avatar_url || null,
    role: row.role || 'user',
    isBanned: Boolean(row.is_banned),
    mutedUntil: row.muted_until || null,
    warningsCount: Number(row.warnings_count || 0),
    createdAt: row.created_at,
    lastSeen: row.last_seen,
  };
}

const UserModel = {
  async create({ email, googleId = null, username = null, phone = null, displayName, avatarUrl = null, passwordHash = null, role = 'user' }) {
    const id = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(5).toString('hex');
    const color = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
    await getPool().query(
      `INSERT INTO users (id, email, google_id, username, invite_code, phone, display_name, avatar_color, avatar_url, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        email.trim().toLowerCase(),
        googleId,
        username ? username.trim().toLowerCase() : null,
        inviteCode,
        phone || null,
        displayName.trim(),
        color,
        avatarUrl,
        passwordHash,
        role,
      ]
    );
    return this.findById(id);
  },

  async findByIdentifier(identifier) {
    const norm = (identifier || '').trim().toLowerCase();
    const [rows] = await getPool().query(
      `SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1`,
      [norm, norm]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const norm = (username || '').trim().toLowerCase().replace(/^@/, '');
    const [rows] = await getPool().query(`SELECT * FROM users WHERE username = ? LIMIT 1`, [norm]);
    return mapUser(rows[0]);
  },

  async findByInviteCode(code) {
    const [rows] = await getPool().query(`SELECT * FROM users WHERE invite_code = ? LIMIT 1`, [code.trim()]);
    return mapUser(rows[0]);
  },

  async findByEmailOrGoogleId(email, googleId) {
    const normEmail = (email || '').trim().toLowerCase();
    const [rows] = await getPool().query(
      `SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1`,
      [googleId, normEmail]
    );
    return rows[0] || null;
  },

  async linkGoogleId(userId, googleId, avatarUrl) {
    await getPool().query(
      `UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?`,
      [googleId, avatarUrl || null, userId]
    );
    return this.findById(userId);
  },

  async findById(id) {
    const [rows] = await getPool().query(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
    return mapUser(rows[0]);
  },

  async isUsernameTaken(username, excludeUserId) {
    const [rows] = await getPool().query(
      `SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1`,
      [username.trim().toLowerCase(), excludeUserId]
    );
    return rows.length > 0;
  },

  async updateProfile(id, updates) {
    const fields = [];
    const values = [];
    if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
      fields.push('display_name = ?');
      values.push(updates.displayName.trim());
    }
    if (typeof updates.username === 'string') {
      fields.push('username = ?');
      values.push(updates.username.trim().toLowerCase() || null);
    }
    if (typeof updates.bio === 'string') {
      fields.push('bio = ?');
      values.push(updates.bio.trim());
    }
    if (typeof updates.phone === 'string') {
      fields.push('phone = ?');
      values.push(updates.phone.trim() || null);
    }
    if (typeof updates.avatarColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(updates.avatarColor.trim())) {
      fields.push('avatar_color = ?');
      values.push(updates.avatarColor.trim());
    }
    if (fields.length > 0) {
      values.push(id);
      await getPool().query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return this.findById(id);
  },

  async updateLastSeen(id) {
    await getPool().query(`UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  },

  async listOthers(excludeId, query = '') {
    const q = `%${query.trim().toLowerCase()}%`;
    const [rows] = await getPool().query(
      `SELECT * FROM users
       WHERE id <> ? AND is_banned = 0
         AND (LOWER(display_name) LIKE ? OR LOWER(COALESCE(username, '')) LIKE ? OR LOWER(email) LIKE ?)
       ORDER BY display_name ASC`,
      [excludeId, q, q, q]
    );
    return rows.map(mapUser);
  },
};

module.exports = { UserModel, mapUser };
