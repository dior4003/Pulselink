import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store/store';
import {
  clearModToken,
  logoutState,
  setAuthError,
  setAuthenticated,
  setAuthLoading,
  setModToken,
  updateCurrentUser,
} from '../store/slices/authSlice';
import {
  setActivePeer,
  setCalls,
  setChats,
  setFriendsData,
  setMessages,
  setSearchResults,
  setUsers,
} from '../store/slices/chatSlice';
import { setServerConfig } from '../store/slices/settingsSlice';
import { ModStats, ReportItem, ServerConfig, UserProfile } from '../models/types';

const TOKEN_KEY = 'pulselink_token';

async function request<T>(path: string, options: RequestInit = {}, useModToken = false): Promise<T> {
  const { auth, settings } = store.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  const tok = useModToken ? auth.modToken : auth.token;
  if (tok) headers.Authorization = `Bearer ${tok}`;

  const res = await fetch(`${settings.serverUrl}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server xatosi (${res.status})`);
  return data as T;
}

export const ApiController = {
  async loadConfig() {
    try {
      const cfg = await request<ServerConfig>('/api/config');
      store.dispatch(setServerConfig(cfg));
      return cfg;
    } catch {
      return null;
    }
  },

  async restoreSession(): Promise<boolean> {
    await this.loadConfig();

    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return false;

    try {
      store.dispatch(setAuthenticated({ token, user: { id: '', email: '', username: '', phone: '', displayName: '', bio: '', avatarColor: '#6366F1' } }));
      const { user } = await request<{ user: UserProfile }>('/api/me');
      store.dispatch(setAuthenticated({ token, user }));
      return true;
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      store.dispatch(logoutState());
      return false;
    }
  },

  async login(identifier: string, password: string) {
    store.dispatch(setAuthLoading(true));
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      store.dispatch(setAuthenticated(res));
      return true;
    } catch (err: any) {
      store.dispatch(setAuthError(err.message));
      return false;
    }
  },

  async register(payload: { displayName: string; email?: string; username?: string; phone?: string; password: string }) {
    store.dispatch(setAuthLoading(true));
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      store.dispatch(setAuthenticated(res));
      return true;
    } catch (err: any) {
      store.dispatch(setAuthError(err.message));
      return false;
    }
  },

  async forgotPassword(identifier: string) {
    return request<{ ok: boolean; message: string; devCode?: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    });
  },

  async resetPassword(identifier: string, code: string, newPassword: string) {
    return request<{ ok: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, newPassword }),
    });
  },

  async loginWithGoogle(idToken: string) {
    store.dispatch(setAuthLoading(true));
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      store.dispatch(setAuthenticated(res));
      return true;
    } catch (err: any) {
      store.dispatch(setAuthError(err.message));
      return false;
    }
  },

  async updateProfile(payload: { displayName: string; username: string; bio: string; phone: string; avatarColor: string }) {
    const { user } = await request<{ user: UserProfile }>('/api/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    store.dispatch(updateCurrentUser(user));
    return user;
  },

  async refreshLists() {
    const [chatsRes, usersRes, callsRes, friendsRes] = await Promise.all([
      request<{ chats: any[] }>('/api/chats'),
      request<{ users: UserProfile[] }>('/api/users'),
      request<{ calls: any[] }>('/api/calls'),
      request<{ friends: any[]; incomingRequests: any[] }>('/api/friends'),
    ]);
    store.dispatch(setChats(chatsRes.chats));
    store.dispatch(setUsers(usersRes.users));
    store.dispatch(setCalls(callsRes.calls));
    store.dispatch(
      setFriendsData({
        friends: friendsRes.friends,
        incomingRequests: friendsRes.incomingRequests,
      })
    );
  },

  async searchMessages(query: string) {
    if (!query.trim()) {
      store.dispatch(setSearchResults([]));
      return;
    }
    const res = await request<{ results: any[] }>(`/api/chats/search?q=${encodeURIComponent(query)}`);
    store.dispatch(setSearchResults(res.results));
  },

  async sendFriendRequest(payload: { targetUserId?: string; username?: string; inviteCode?: string }) {
    await request('/api/friends/request', { method: 'POST', body: JSON.stringify(payload) });
    await this.refreshLists();
  },

  async acceptFriend(relationId: string) {
    await request(`/api/friends/${relationId}/accept`, { method: 'POST' });
    await this.refreshLists();
  },

  async removeFriend(peerId: string) {
    await request(`/api/friends/${peerId}`, { method: 'DELETE' });
    await this.refreshLists();
  },

  async openChat(peer: UserProfile) {
    store.dispatch(setActivePeer(peer));
    const res = await request<{ messages: any[] }>(`/api/chats/${peer.id}/messages`);
    store.dispatch(setMessages(res.messages));
    this.refreshLists().catch(() => {});
  },

  async uploadMedia(fileName: string, mimeType: string, base64: string) {
    return request<{ url: string; type: 'image' | 'file'; fileName: string }>('/api/media', {
      method: 'POST',
      body: JSON.stringify({ fileName, mimeType, base64 }),
    });
  },

  // Expanded Separate Moderator Auth & Moderation API
  async modLogin(identifier: string, password: string, modPasskey: string) {
    const res = await request<{ modToken: string }>('/api/mod/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password, modPasskey }),
    });
    store.dispatch(setModToken(res.modToken));
    return res.modToken;
  },

  async modLoadDashboard() {
    const [statsRes, usersRes, reportsRes, msgsRes, callsRes, logsRes] = await Promise.all([
      request<{ stats: ModStats & { mutedUsers?: number }; activeCallsCount: number }>('/api/mod/stats', {}, true),
      request<{ users: UserProfile[] }>('/api/mod/users', {}, true),
      request<{ reports: ReportItem[] }>('/api/mod/reports', {}, true),
      request<{ messages: any[] }>('/api/mod/messages', {}, true),
      request<{ calls: any[] }>('/api/mod/calls', {}, true),
      request<{ logs: any[] }>('/api/mod/logs', {}, true),
    ]);
    return {
      stats: statsRes.stats,
      activeCallsCount: statsRes.activeCallsCount,
      users: usersRes.users,
      reports: reportsRes.reports,
      messages: msgsRes.messages,
      calls: callsRes.calls,
      logs: logsRes.logs,
    };
  },

  async modToggleBan(userId: string, isBanned: boolean) {
    await request(`/api/mod/users/${userId}/ban`, { method: 'POST', body: JSON.stringify({ isBanned }) }, true);
  },

  async modMuteUser(userId: string, minutes: number) {
    await request(`/api/mod/users/${userId}/mute`, { method: 'POST', body: JSON.stringify({ minutes }) }, true);
  },

  async modWarnUser(userId: string, reason: string) {
    await request(`/api/mod/users/${userId}/warn`, { method: 'POST', body: JSON.stringify({ reason }) }, true);
  },

  async modSetRole(userId: string, role: 'user' | 'moderator') {
    await request(`/api/mod/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) }, true);
  },

  async modDeleteMessage(messageId: string) {
    await request(`/api/mod/messages/${messageId}`, { method: 'DELETE' }, true);
  },

  async modTerminateCall(callId: string) {
    await request(`/api/mod/calls/${callId}/terminate`, { method: 'POST' }, true);
  },

  async modBroadcast(text: string) {
    await request('/api/mod/broadcast', { method: 'POST', body: JSON.stringify({ text }) }, true);
  },

  async modResolveReport(reportId: string) {
    await request(`/api/mod/reports/${reportId}/resolve`, { method: 'POST' }, true);
  },

  modLogout() {
    store.dispatch(clearModToken());
  },

  async logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    store.dispatch(setActivePeer(null));
    store.dispatch(logoutState());
  },
};
