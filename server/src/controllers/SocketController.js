const crypto = require('crypto');
const { verifyToken } = require('../auth');
const { UserModel } = require('../models/UserModel');
const { MessageModel } = require('../models/MessageModel');
const { CallModel } = require('../models/CallModel');

const CALL_RING_TIMEOUT_MS = 40000;
const DISCONNECT_GRACE_MS = 12000;
const onlineSockets = new Map();
const activeCalls = new Map();
const disconnectTimers = new Map();

function isOnline(userId) {
  const set = onlineSockets.get(userId);
  return Boolean(set && set.size > 0);
}

function isUserInCall(userId) {
  for (const session of activeCalls.values()) {
    if (session.callerId === userId || session.receiverId === userId) return true;
  }
  return false;
}

function listActiveCalls() {
  const list = [];
  for (const [callId, s] of activeCalls.entries()) {
    list.push({
      callId,
      callerId: s.callerId,
      receiverId: s.receiverId,
      callType: s.callType,
      active: Boolean(s.answeredAt),
    });
  }
  return list;
}

async function forceTerminateCall(callId) {
  const session = activeCalls.get(callId);
  if (!session) return false;
  clearTimeout(session.timeoutHandle);
  const durationSec = session.answeredAt ? Math.max(1, Math.round((Date.now() - session.answeredAt) / 1000)) : 0;
  await CallModel.update(callId, { status: 'ended', durationSec, endedAt: new Date().toISOString() });
  activeCalls.delete(callId);
  sendToUser(session.callerId, 'call:hangup', { callId, reason: 'Moderator qo‘ng‘iroqni to‘xtatdi' });
  sendToUser(session.receiverId, 'call:hangup', { callId, reason: 'Moderator qo‘ng‘iroqni to‘xtatdi' });
  return true;
}

function sendToUser(userId, event, data) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;
  const payload = JSON.stringify({ event, data });
  let sent = false;
  for (const ws of sockets) {
    if (ws.readyState === 1) {
      ws.send(payload);
      sent = true;
    }
  }
  return sent;
}

function broadcastSystemAnnouncement(text, fromName) {
  const payload = JSON.stringify({
    event: 'system:announcement',
    data: { text, fromName, createdAt: new Date().toISOString() },
  });
  for (const [, sockets] of onlineSockets.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

function broadcastPresence(userId, online) {
  const payload = JSON.stringify({
    event: 'presence:update',
    data: { userId, online, lastSeen: new Date().toISOString() },
  });
  for (const [, sockets] of onlineSockets.entries()) {
    for (const ws of sockets) {
      if (ws.readyState === 1) ws.send(payload);
    }
  }
}

function isAuthorizedCallPeer(callId, userId, targetId) {
  const session = activeCalls.get(callId);
  if (!session) return false;
  return (
    (session.callerId === userId && session.receiverId === targetId) ||
    (session.receiverId === userId && session.callerId === targetId)
  );
}

function attachWebSocket(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const payload = verifyToken(url.searchParams.get('token'));
    if (!payload || !payload.userId) return ws.close(4001, 'Unauthorized');

    const user = await UserModel.findById(payload.userId);
    if (!user || user.isBanned) return ws.close(4001, 'User unauthorized or banned');

    ws.userId = user.id;
    ws.rateWindow = { count: 0, resetAt: Date.now() + 10000 };

    if (disconnectTimers.has(user.id)) {
      clearTimeout(disconnectTimers.get(user.id));
      disconnectTimers.delete(user.id);
    }

    if (!onlineSockets.has(user.id)) onlineSockets.set(user.id, new Set());
    onlineSockets.get(user.id).add(ws);
    broadcastPresence(user.id, true);

    ws.on('message', async (raw) => {
      const now = Date.now();
      if (now > ws.rateWindow.resetAt) {
        ws.rateWindow = { count: 0, resetAt: now + 10000 };
      }
      ws.rateWindow.count += 1;
      if (ws.rateWindow.count > 120) {
        return ws.send(JSON.stringify({ event: 'error', data: { message: 'Juda ko‘p so‘rov' } }));
      }

      let parsed;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const { event, data = {} } = parsed;

      switch (event) {
        case 'ping':
          ws.send(JSON.stringify({ event: 'pong', data: { ts: data.ts || Date.now() } }));
          break;
        case 'chat:send': {
          const freshUser = await UserModel.findById(user.id);
          if (freshUser?.mutedUntil && new Date(freshUser.mutedUntil) > new Date()) {
            return sendToUser(user.id, 'mod:notice', { message: 'Sizda vaqtinchalik Mute cheklovi bor' });
          }
          const { receiverId, text, type, mediaUrl } = data;
          if (!receiverId || receiverId === user.id || (!text && !mediaUrl)) return;
          const msg = await MessageModel.create({
            senderId: user.id,
            receiverId,
            text: String(text || '').trim(),
            type: type || 'text',
            mediaUrl: mediaUrl || null,
          });
          sendToUser(user.id, 'chat:message', msg);
          sendToUser(receiverId, 'chat:message', msg);
          break;
        }
        case 'chat:typing':
          if (data.receiverId) {
            sendToUser(data.receiverId, 'chat:typing', {
              userId: user.id,
              isTyping: Boolean(data.isTyping),
            });
          }
          break;
        case 'chat:read':
          if (data.peerId) {
            await MessageModel.markRead(user.id, data.peerId);
            sendToUser(data.peerId, 'chat:read', { byUserId: user.id });
          }
          break;
        case 'call:invite': {
          const freshUser = await UserModel.findById(user.id);
          if (freshUser?.mutedUntil && new Date(freshUser.mutedUntil) > new Date()) {
            return sendToUser(user.id, 'call:unavailable', { reason: 'Sizda vaqtinchalik Mute cheklovi bor' });
          }
          const { receiverId, callType } = data;
          if (!receiverId || receiverId === user.id) return;
          const callId = crypto.randomUUID();
          const type = callType === 'video' ? 'video' : 'audio';

          if (!isOnline(receiverId)) {
            await CallModel.create({ id: callId, callerId: user.id, receiverId, callType: type, status: 'missed' });
            sendToUser(user.id, 'call:unavailable', { callId, receiverId, reason: 'Foydalanuvchi hozir oflayn' });
            return;
          }
          if (isUserInCall(receiverId) || isUserInCall(user.id)) {
            await CallModel.create({ id: callId, callerId: user.id, receiverId, callType: type, status: 'missed' });
            sendToUser(user.id, 'call:unavailable', { callId, receiverId, reason: 'Foydalanuvchi boshqa qo‘ng‘iroqda band' });
            return;
          }

          await CallModel.create({ id: callId, callerId: user.id, receiverId, callType: type, status: 'ringing' });
          const timeoutHandle = setTimeout(async () => {
            const s = activeCalls.get(callId);
            if (s && !s.answeredAt) {
              activeCalls.delete(callId);
              await CallModel.update(callId, { status: 'missed', endedAt: new Date().toISOString() });
              sendToUser(s.callerId, 'call:timeout', { callId, reason: 'Javob berilmadi' });
              sendToUser(s.receiverId, 'call:timeout', { callId, reason: 'O‘tkazib yuborilgan qo‘ng‘iroq' });
            }
          }, CALL_RING_TIMEOUT_MS);

          activeCalls.set(callId, { callerId: user.id, receiverId, callType: type, answeredAt: null, timeoutHandle });
          sendToUser(user.id, 'call:created', { callId, receiverId, callType: type });
          const callerProfile = await UserModel.findById(user.id);
          sendToUser(receiverId, 'call:incoming', { callId, callType: type, caller: callerProfile });
          break;
        }
        case 'call:accept': {
          const session = activeCalls.get(data.callId);
          if (!session || session.receiverId !== user.id) return;
          clearTimeout(session.timeoutHandle);
          session.answeredAt = Date.now();
          await CallModel.update(data.callId, { status: 'active' });
          sendToUser(session.callerId, 'call:accepted', { callId: data.callId, receiverId: user.id });
          break;
        }
        case 'call:reject': {
          const session = activeCalls.get(data.callId);
          if (!session || (session.callerId !== user.id && session.receiverId !== user.id)) return;
          clearTimeout(session.timeoutHandle);
          activeCalls.delete(data.callId);
          await CallModel.update(data.callId, { status: 'rejected', endedAt: new Date().toISOString() });
          const target = session.callerId === user.id ? session.receiverId : session.callerId;
          sendToUser(target, 'call:rejected', { callId: data.callId });
          break;
        }
        case 'call:offer':
        case 'call:answer':
        case 'call:ice':
        case 'call:hold':
          if (data.callId && data.targetId && isAuthorizedCallPeer(data.callId, user.id, data.targetId)) {
            sendToUser(data.targetId, event, { ...data, fromId: user.id });
          }
          break;
        case 'call:hangup': {
          const session = activeCalls.get(data.callId);
          if (session && (session.callerId === user.id || session.receiverId === user.id)) {
            clearTimeout(session.timeoutHandle);
            const durationSec = session.answeredAt ? Math.max(1, Math.round((Date.now() - session.answeredAt) / 1000)) : 0;
            await CallModel.update(data.callId, {
              status: session.answeredAt ? 'ended' : 'missed',
              durationSec,
              endedAt: new Date().toISOString(),
            });
            activeCalls.delete(data.callId);
            const peer = session.callerId === user.id ? session.receiverId : session.callerId;
            sendToUser(peer, 'call:hangup', { callId: data.callId, fromId: user.id });
          }
          break;
        }
      }
    });

    ws.on('close', async () => {
      const set = onlineSockets.get(user.id);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          onlineSockets.delete(user.id);
          await UserModel.updateLastSeen(user.id);
          broadcastPresence(user.id, false);

          const timer = setTimeout(async () => {
            disconnectTimers.delete(user.id);
            if (isOnline(user.id)) return;
            for (const [callId, session] of activeCalls.entries()) {
              if (session.callerId === user.id || session.receiverId === user.id) {
                clearTimeout(session.timeoutHandle);
                const durationSec = session.answeredAt ? Math.max(1, Math.round((Date.now() - session.answeredAt) / 1000)) : 0;
                await CallModel.update(callId, {
                  status: session.answeredAt ? 'ended' : 'missed',
                  durationSec,
                  endedAt: new Date().toISOString(),
                });
                activeCalls.delete(callId);
                const peer = session.callerId === user.id ? session.receiverId : session.callerId;
                sendToUser(peer, 'call:hangup', { callId, fromId: user.id });
              }
            }
          }, DISCONNECT_GRACE_MS);
          disconnectTimers.set(user.id, timer);
        }
      }
    });
  });
}

module.exports = {
  isOnline,
  sendToUser,
  attachWebSocket,
  broadcastSystemAnnouncement,
  listActiveCalls,
  forceTerminateCall,
};
