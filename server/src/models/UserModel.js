const crypto = require('crypto');
const { getPool } = require('../config/db');

const AVATAR_PALETTE = ['#6366F1', '#06B6D4', '#8B5CF6', '#EC4899', '#F59E0B', '#3B82F6', '#F43F5E'];

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[\s()-]/g, '').trim();
  return cleaned || null;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email || '',
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
  async create({ email = null, googleId = null, username = null, phone = null, displayName, avatarUrl = null, passwordHash = null, role = 'user' }) {
    const id = crypto.randomUUID();
    const inviteCode = crypto.randomBytes(5).toString('hex');
    const color = AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)];
    await getPool().query(
      `INSERT INTO users (id, email, google_id, username, invite_code, phone, display_name, avatar_color, avatar_url, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        email ? email.trim().toLowerCase() : null,
        googleId,
        username ? username.trim().toLowerCase() : null,
        inviteCode,
        normalizePhone(phone),
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
    const raw = (identifier || '').trim();
    const norm = raw.toLowerCase();
    const phoneNorm = normalizePhone(raw) || norm;
    const [rows] = await getPool().query(
      `SELECT * FROM users WHERE email = ? OR username = ? OR phone = ? LIMIT 1`,
      [norm, norm, phoneNorm]
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
      values.push(normalizePhone(updates.phone));
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

  async updatePassword(userId, passwordHash) {
    await getPool().query(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
  },

  async createResetCode(userId, code) {
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60000);
    await getPool().query(`DELETE FROM password_resets WHERE user_id = ?`, [userId]);
    await getPool().query(
      `INSERT INTO password_resets (id, user_id, code, expires_at) VALUES (?, ?, ?, ?)`,
      [id, userId, code, expiresAt]
    );
  },

  async verifyAndConsumeResetCode(userId, code) {
    const [rows] = await getPool().query(
      `SELECT * FROM password_resets WHERE user_id = ? AND code = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
      [userId, String(code).trim()]
    );
    if (!rows.length) return false;
    await getPool().query(`UPDATE password_resets SET used = 1 WHERE id = ?`, [rows[0].id]);
    return true;
  },

  async updateLastSeen(id) {
    await getPool().query(`UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
  },

  async listOthers(excludeId, query = '') {
    const q = `%${query.trim().toLowerCase()}%`;
    const [rows] = await getPool().query(
      `SELECT * FROM users
       WHERE id <> ? AND is_banned = 0
         AND (LOWER(display_name) LIKE ? OR LOWER(COALESCE(username, '')) LIKE ? OR LOWER(COALESCE(email, '')) LIKE ? OR COALESCE(phone, '') LIKE ?)
       ORDER BY display_name ASC`,
      [excludeId, q, q, q, q]
    );
    return rows.map(mapUser);
  },
};

module.exports = { UserModel, mapUser, normalizePhone };
