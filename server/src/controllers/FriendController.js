const { UserModel } = require('../models/UserModel');
const { FriendModel } = require('../models/FriendModel');
const { isOnline, sendToUser } = require('./SocketController');

const FriendController = {
  async list(req, res) {
    const data = await FriendModel.listForUser(req.user.id);
    const mapPeerOnline = (arr) => arr.map((x) => ({ ...x, peer: { ...x.peer, online: isOnline(x.peer.id) } }));
    res.json({
      friends: mapPeerOnline(data.friends),
      incomingRequests: mapPeerOnline(data.incomingRequests),
      outgoingRequests: mapPeerOnline(data.outgoingRequests),
    });
  },

  async sendRequest(req, res) {
    try {
      const { targetUserId, username, inviteCode } = req.body || {};
      let target = null;
      if (targetUserId) target = await UserModel.findById(targetUserId);
      else if (username) target = await UserModel.findByUsername(username);
      else if (inviteCode) target = await UserModel.findByInviteCode(inviteCode);

      if (!target) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
      const result = await FriendModel.sendRequest(req.user.id, target.id);
      sendToUser(target.id, 'friend:update', { fromUserId: req.user.id });
      res.status(201).json({ ...result, target });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async accept(req, res) {
    const ok = await FriendModel.acceptRequest(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'So‘rov topilmadi' });
    res.json({ ok: true });
  },

  async remove(req, res) {
    await FriendModel.removeFriend(req.user.id, req.params.peerId);
    res.json({ ok: true });
  },

  async publicProfileByUsername(req, res) {
    const user = await UserModel.findByUsername(req.params.username);
    if (!user || user.isBanned) return res.status(404).json({ error: 'Profil topilmadi' });
    res.json({
      profile: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        bio: user.bio,
        avatarColor: user.avatarColor,
        online: isOnline(user.id),
      },
    });
  },

  async lookupInvite(req, res) {
    const user = await UserModel.findByInviteCode(req.params.code);
    if (!user || user.isBanned) return res.status(404).json({ error: 'Taklif havolasi yaroqsiz' });
    res.json({
      inviter: {
        id: user.id,
        displayName: user.displayName,
        username: user.username,
        bio: user.bio,
        avatarColor: user.avatarColor,
        online: isOnline(user.id),
      },
    });
  },
};

module.exports = { FriendController };
