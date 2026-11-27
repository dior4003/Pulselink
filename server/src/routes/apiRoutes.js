const express = require('express');
const { AuthController } = require('../controllers/AuthController');
const { UserController } = require('../controllers/UserController');
const { ChatController } = require('../controllers/ChatController');
const { MediaController } = require('../controllers/MediaController');
const { FriendController } = require('../controllers/FriendController');
const { ModeratorController } = require('../controllers/ModeratorController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { moderatorMiddleware } = require('../middleware/moderatorMiddleware');
const { authRateLimit } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

function getIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  if (process.env.TURN_URL) {
    const turn = { urls: process.env.TURN_URL };
    if (process.env.TURN_USERNAME) turn.username = process.env.TURN_USERNAME;
    if (process.env.TURN_CREDENTIAL) turn.credential = process.env.TURN_CREDENTIAL;
    servers.push(turn);
  }
  return servers;
}

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'PulseLink MVC Server', database: 'MySQL/MariaDB' });
});

router.get('/config', (_req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    database: 'MySQL/MariaDB',
    iceServers: getIceServers(),
  });
});

// Auth routes (Email, Phone, Google, Password Reset)
router.post('/auth/register', authRateLimit, AuthController.register);
router.post('/auth/login', authRateLimit, AuthController.login);
router.post('/auth/google', authRateLimit, AuthController.googleLogin);
router.post('/auth/forgot-password', authRateLimit, AuthController.forgotPassword);
router.post('/auth/reset-password', authRateLimit, AuthController.resetPassword);

// User & Public Profile / Invite Link routes
router.get('/me', authMiddleware, UserController.getMe);
router.put('/me', authMiddleware, UserController.updateMe);
router.get('/users', authMiddleware, UserController.listUsers);
router.get('/u/:username', FriendController.publicProfileByUsername);
router.get('/invite/:code', FriendController.lookupInvite);

// Friends routes
router.get('/friends', authMiddleware, FriendController.list);
router.post('/friends/request', authMiddleware, FriendController.sendRequest);
router.post('/friends/:id/accept', authMiddleware, FriendController.accept);
router.delete('/friends/:peerId', authMiddleware, FriendController.remove);

// Chat, Search & Call routes
router.get('/chats', authMiddleware, ChatController.listChats);
router.get('/chats/search', authMiddleware, ChatController.searchMessages);
router.get('/chats/:peerId/messages', authMiddleware, ChatController.getMessages);
router.get('/calls', authMiddleware, ChatController.listCalls);

// Reports & Media
router.post('/reports', authMiddleware, ModeratorController.submitReport);
router.post('/media', authMiddleware, MediaController.upload);

// Hidden Separate Moderator Auth & Expanded Moderation routes
router.post('/mod/login', authRateLimit, ModeratorController.login);
router.get('/mod/stats', moderatorMiddleware, ModeratorController.stats);
router.get('/mod/users', moderatorMiddleware, ModeratorController.listUsers);
router.post('/mod/users/:id/ban', moderatorMiddleware, ModeratorController.toggleBan);
router.post('/mod/users/:id/mute', moderatorMiddleware, ModeratorController.muteUser);
router.post('/mod/users/:id/warn', moderatorMiddleware, ModeratorController.warnUser);
router.post('/mod/users/:id/role', moderatorMiddleware, ModeratorController.setRole);
router.get('/mod/messages', moderatorMiddleware, ModeratorController.listMessages);
router.delete('/mod/messages/:id', moderatorMiddleware, ModeratorController.deleteMessage);
router.get('/mod/calls', moderatorMiddleware, ModeratorController.listActiveCalls);
router.post('/mod/calls/:id/terminate', moderatorMiddleware, ModeratorController.terminateCall);
router.post('/mod/broadcast', moderatorMiddleware, ModeratorController.broadcast);
router.get('/mod/reports', moderatorMiddleware, ModeratorController.listReports);
router.post('/mod/reports/:id/resolve', moderatorMiddleware, ModeratorController.resolveReport);
router.get('/mod/logs', moderatorMiddleware, ModeratorController.listLogs);

module.exports = router;
