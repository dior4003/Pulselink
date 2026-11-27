const test = require('node:test');
const assert = require('node:assert');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../src/auth');

test('Password hashing and verification', () => {
  const hash = hashPassword('StrongPass123!');
  assert.strictEqual(verifyPassword('StrongPass123!', hash), true);
  assert.strictEqual(verifyPassword('WrongPass', hash), false);
});

test('JWT signing and verification', () => {
  const token = signToken({ userId: 'user-123' });
  const decoded = verifyToken(token);
  assert.ok(decoded);
  assert.strictEqual(decoded.userId, 'user-123');
  assert.strictEqual(verifyToken(token + 'tampered'), null);
});
