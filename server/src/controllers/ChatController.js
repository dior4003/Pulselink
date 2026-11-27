const { UserModel } = require('../models/UserModel');
const { MessageModel } = require('../models/MessageModel');
const { CallModel } = require('../models/CallModel');
const { isOnline, sendToUser } = require('./SocketController');

const ChatController = {
  async listChats(req, res) {
    const chats = (await MessageModel.getChatsForUser(req.user.id)).map((c) => ({
      ...c,
      peer: { ...c.peer, online: isOnline(c.peer.id) },
    }));
    res.json({ chats });
  },

  async getMessages(req, res) {
    const peer = await UserModel.findById(req.params.peerId);
    if (!peer) return res.status(404).json({ error: 'Suhbatdosh topilmadi' });
    const messages = await MessageModel.getConversation(req.user.id, peer.id);
    sendToUser(peer.id, 'chat:read', { byUserId: req.user.id });
    res.json({
      peer: { ...peer, online: isOnline(peer.id) },
      messages,
    });
  },

  async searchMessages(req, res) {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const results = await MessageModel.searchMessages(req.user.id, q);
    res.json({ results });
  },

  async listCalls(req, res) {
    const calls = (await CallModel.listForUser(req.user.id)).map((c) => ({
      ...c,
      peer: c.peer ? { ...c.peer, online: isOnline(c.peer.id) } : null,
    }));
    res.json({ calls });
  },
};

module.exports = { ChatController };
