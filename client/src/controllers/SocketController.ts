import { Alert } from 'react-native';
import { store } from '../store/store';
import {
  appendMessage,
  markOutgoingRead,
  setPeerTyping,
  updatePresence,
} from '../store/slices/chatSlice';
import {
  resetCallState,
  setActiveCallId,
  setIncomingCall,
  setOnHold,
  setPeerOnHold,
  startActiveCall,
} from '../store/slices/callSlice';
import { addDevLog, setPingMs, setWsConnected } from '../store/slices/settingsSlice';
import { ApiController } from './ApiController';
import { WebRtcController } from './WebRtcController';
import { NotificationController } from './NotificationController';
import { UserProfile } from '../models/types';

class SocketManager {
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;

  connect() {
    this.disconnect();
    const { auth, settings } = store.getState();
    if (!auth.token) return;

    NotificationController.requestPermissions().catch(() => {});

    const wsBase = settings.serverUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');

    const ws = new WebSocket(`${wsBase}?token=${encodeURIComponent(auth.token)}`);
    this.ws = ws;

    ws.onopen = () => {
      store.dispatch(setWsConnected(true));
      store.dispatch(addDevLog('WS connected'));
      this.send('ping', { ts: Date.now() });
    };

    ws.onclose = () => {
      store.dispatch(setWsConnected(false));
      store.dispatch(addDevLog('WS disconnected'));
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => {
        if (store.getState().auth.token) this.connect();
      }, 3000);
    };

    ws.onmessage = async (ev) => {
      let parsed: { event: string; data: any };
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      const { event, data } = parsed;
      if (event !== 'pong') store.dispatch(addDevLog(`WS <- ${event}`));

      switch (event) {
        case 'pong':
          store.dispatch(setPingMs(Date.now() - (data.ts || Date.now())));
          break;
        case 'presence:update':
          store.dispatch(updatePresence(data));
          break;
        case 'friend:update':
          ApiController.refreshLists().catch(() => {});
          NotificationController.notify('Yangi do‘stlik so‘rovi', 'Sizga yangi do‘stlik so‘rovi keldi');
          break;
        case 'mod:notice':
          NotificationController.notify('Moderator xabari', data.message || '');
          break;
        case 'system:announcement':
          NotificationController.notify(`📢 E’lon (${data.fromName || 'Admin'})`, data.text || '');
          break;
        case 'chat:message': {
          store.dispatch(appendMessage(data));
          const { auth: authState, chat } = store.getState();
          const isFromMe = data.senderId === authState.user?.id;
          const isOpenChat = chat.activePeer?.id === data.senderId;

          if (!isFromMe && isOpenChat) {
            this.send('chat:read', { peerId: data.senderId });
          } else if (!isFromMe) {
            const sender = chat.users.find((u) => u.id === data.senderId);
            NotificationController.notify(
              sender?.displayName || 'Yangi xabar',
              data.text || 'Media fayl',
              data.senderId
            );
          }
          ApiController.refreshLists().catch(() => {});
          break;
        }
        case 'chat:typing':
          store.dispatch(setPeerTyping(data));
          break;
        case 'chat:read':
          store.dispatch(markOutgoingRead(data.byUserId));
          break;
        case 'call:created':
          store.dispatch(setActiveCallId(data.callId));
          break;
        case 'call:incoming':
          store.dispatch(setIncomingCall(data));
          NotificationController.notify(
            data.callType === 'video' ? '📹 Video qo‘ng‘iroq' : '📞 Audio qo‘ng‘iroq',
            `${data.caller?.displayName || 'Foydalanuvchi'} qo‘ng‘iroq qilmoqda`
          );
          break;
        case 'call:hold':
          store.dispatch(setPeerOnHold(Boolean(data.onHold)));
          break;
        case 'call:accepted': {
          store.dispatch(setActiveCallId(data.callId));
          const active = store.getState().call.activeCall;
          if (!active) return;
          WebRtcController.createPeerConnection((candidate) => {
            this.send('call:ice', { targetId: active.peer.id, callId: data.callId, candidate });
          });
          const offer = await WebRtcController.createOffer();
          this.send('call:offer', { targetId: active.peer.id, callId: data.callId, sdp: offer });
          break;
        }
        case 'call:offer': {
          if (!store.getState().call.activeCall) return;
          if (!WebRtcController.getRemoteStream()) {
            WebRtcController.createPeerConnection((candidate) => {
              this.send('call:ice', { targetId: data.fromId, callId: data.callId, candidate });
            });
          }
          const answer = await WebRtcController.handleOffer(data.sdp);
          this.send('call:answer', { targetId: data.fromId, callId: data.callId, sdp: answer });
          break;
        }
        case 'call:answer':
          await WebRtcController.handleAnswer(data.sdp);
          break;
        case 'call:ice':
          await WebRtcController.addIceCandidate(data.candidate);
          break;
        case 'call:rejected':
        case 'call:timeout':
        case 'call:unavailable':
          Alert.alert('Qo‘ng‘iroq', data.reason || 'Qo‘ng‘iroq yakunlandi');
          WebRtcController.close();
          store.dispatch(resetCallState());
          ApiController.refreshLists().catch(() => {});
          break;
        case 'call:hangup':
          if (data.reason) Alert.alert('Qo‘ng‘iroq', data.reason);
          WebRtcController.close();
          store.dispatch(resetCallState());
          ApiController.refreshLists().catch(() => {});
          break;
      }
    };
  }

  send(event: string, data: any) {
    if (this.ws && this.ws.readyState === 1) {
      if (event !== 'ping') store.dispatch(addDevLog(`WS -> ${event}`));
      this.ws.send(JSON.stringify({ event, data }));
    }
  }

  async initiateCall(peer: UserProfile, callType: 'audio' | 'video') {
    await WebRtcController.startLocalMedia(callType === 'video');
    store.dispatch(startActiveCall({ callId: null, callType, peer }));
    this.send('call:invite', { receiverId: peer.id, callType });
  }

  async acceptIncomingCall() {
    const incoming = store.getState().call.incomingCall;
    if (!incoming) return;
    await WebRtcController.startLocalMedia(incoming.callType === 'video');
    store.dispatch(
      startActiveCall({
        callId: incoming.callId,
        callType: incoming.callType,
        peer: incoming.caller,
      })
    );
    this.send('call:accept', { callId: incoming.callId });
  }

  toggleHold() {
    const { activeCall, onHold } = store.getState().call;
    if (!activeCall || !activeCall.callId) return;
    const next = !onHold;
    store.dispatch(setOnHold(next));
    WebRtcController.setHold(next);
    this.send('call:hold', { callId: activeCall.callId, targetId: activeCall.peer.id, onHold: next });
  }

  async restartIce() {
    const { activeCall } = store.getState().call;
    if (!activeCall || !activeCall.callId) return;
    const offer = await WebRtcController.createIceRestartOffer();
    if (offer) {
      this.send('call:offer', { targetId: activeCall.peer.id, callId: activeCall.callId, sdp: offer });
    }
  }

  rejectIncomingCall() {
    const incoming = store.getState().call.incomingCall;
    if (!incoming) return;
    this.send('call:reject', { callId: incoming.callId });
    store.dispatch(resetCallState());
  }

  hangupActiveCall() {
    const active = store.getState().call.activeCall;
    if (active) {
      this.send('call:hangup', { callId: active.callId, targetId: active.peer.id });
    }
    WebRtcController.close();
    store.dispatch(resetCallState());
    ApiController.refreshLists().catch(() => {});
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const SocketController = new SocketManager();
