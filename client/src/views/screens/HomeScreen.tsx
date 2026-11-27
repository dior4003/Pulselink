import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { setDevMode, toggleDarkTheme } from '../../store/slices/settingsSlice';
import { ApiController } from '../../controllers/ApiController';
import { SocketController } from '../../controllers/SocketController';
import { AVATAR_SWATCHES, DARK_THEME, LIGHT_THEME } from '../theme/colors';
import { UserAvatar } from '../components/UserAvatar';
import { ModeratorModal } from '../components/ModeratorModal';

export const HomeScreen: React.FC = () => {
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const { chats, users, calls, friends, incomingRequests, searchResults } = useSelector((s: RootState) => s.chat);
  const { darkTheme, devMode, wsConnected, pingMs, dbEngine, serverUrl, devLogs } = useSelector(
    (s: RootState) => s.settings
  );
  const theme = darkTheme ? DARK_THEME : LIGHT_THEME;

  const [tab, setTab] = useState<'chats' | 'friends' | 'calls' | 'profile'>('chats');
  const [query, setQuery] = useState('');
  const [friendInput, setFriendInput] = useState('');
  const [modVisible, setModVisible] = useState(false);
  const tapCountRef = useRef({ count: 0, lastTap: 0 });

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatarColor || '#6366F1');

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username || '');
      setBio(user.bio || '');
      setPhone(user.phone || '');
      setAvatarColor(user.avatarColor);
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'chats' && query.trim().length >= 2) {
      ApiController.searchMessages(query).catch(() => {});
    } else if (!query.trim()) {
      ApiController.searchMessages('').catch(() => {});
    }
  }, [query, tab]);

  if (!user) return null;

  // Hidden 5-tap gesture on PulseLink logo/title for Moderator access
  const handleSecretTap = () => {
    const now = Date.now();
    if (now - tapCountRef.current.lastTap > 2500) {
      tapCountRef.current.count = 1;
    } else {
      tapCountRef.current.count += 1;
    }
    tapCountRef.current.lastTap = now;
    if (tapCountRef.current.count >= 5) {
      tapCountRef.current.count = 0;
      setModVisible(true);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await ApiController.updateProfile({ displayName, username, bio, phone, avatarColor });
      Alert.alert('Saqlandi', 'Profil ma’lumotlari yangilandi');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    }
  };

  const handleAddFriend = async () => {
    const val = friendInput.trim();
    if (!val) return;
    try {
      if (val.includes('/invite/')) {
        const code = val.split('/invite/')[1].split(/[/?#]/)[0];
        await ApiController.sendFriendRequest({ inviteCode: code });
      } else if (val.includes('/u/')) {
        const uname = val.split('/u/')[1].split(/[/?#]/)[0];
        await ApiController.sendFriendRequest({ username: uname });
      } else if (val.startsWith('@') || /^[a-zA-Z0-9_]{3,24}$/.test(val)) {
        await ApiController.sendFriendRequest({ username: val.replace(/^@/, '') });
      } else {
        await ApiController.sendFriendRequest({ inviteCode: val });
      }
      setFriendInput('');
      Alert.alert('Yuborildi', 'Do‘stlik so‘rovi yuborildi');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    }
  };

  const profileLink = user.username ? `${serverUrl}/api/u/${user.username}` : 'Avval username o‘rnating';
  const inviteLink = user.inviteCode ? `${serverUrl}/api/invite/${user.inviteCode}` : '';
  const isStaff = user.role === 'moderator' || user.role === 'admin';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity activeOpacity={0.9} onPress={handleSecretTap}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>PulseLink</Text>
          </TouchableOpacity>
          <View
            style={[
              styles.badge,
              { backgroundColor: wsConnected ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)' },
            ]}
          >
            <Text style={{ color: wsConnected ? '#34D399' : '#FBBF24', fontSize: 11, fontWeight: '700' }}>
              {wsConnected ? 'Onlayn' : 'Ulanmoqda'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isStaff && (
            <TouchableOpacity onPress={() => setModVisible(true)}>
              <Text style={{ fontSize: 16 }}>🛡️</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { dispatch(toggleDarkTheme()); }}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>{darkTheme ? '☀️ Yorug‘' : '🌙 Tungi'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(tab === 'chats' || tab === 'friends') && (
        <View style={[styles.searchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <TextInput
            placeholder={tab === 'chats' ? 'Chatlar va xabarlarni qidirish...' : 'Kontakt yoki do‘st qidirish...'}
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            style={{ color: theme.text, fontSize: 14 }}
          />
        </View>
      )}

      <View style={styles.body}>
        {tab === 'chats' && (
          <ScrollView>
            {searchResults.length > 0 && (
              <View style={{ paddingHorizontal: 14, paddingTop: 8 }}>
                <Text style={{ color: theme.secondary, fontWeight: '700', fontSize: 12, marginBottom: 6 }}>
                  Xabarlar ichidan topildi ({searchResults.length})
                </Text>
                {searchResults.map((sr) => (
                  <TouchableOpacity
                    key={sr.message.id}
                    onPress={() => ApiController.openChat(sr.peer)}
                    style={[styles.row, { borderColor: theme.border }]}
                  >
                    <UserAvatar name={sr.peer.displayName} color={sr.peer.avatarColor} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>{sr.peer.displayName}</Text>
                      <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 12.5 }}>{sr.message.text}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {chats
              .filter(
                (c) =>
                  c.peer.displayName.toLowerCase().includes(query.toLowerCase()) ||
                  (c.peer.username || '').toLowerCase().includes(query.toLowerCase())
              )
              .map((item) => (
                <TouchableOpacity
                  key={item.peer.id}
                  onPress={() => ApiController.openChat(item.peer)}
                  style={[styles.row, { borderColor: theme.border }]}
                >
                  <UserAvatar name={item.peer.displayName} color={item.peer.avatarColor} online={item.peer.online} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{item.peer.displayName}</Text>
                    <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 13 }}>
                      {item.lastMessage?.text || ''}
                    </Text>
                  </View>
                  {item.unreadCount > 0 && (
                    <View style={[styles.unread, { backgroundColor: theme.primary }]}>
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{item.unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
          </ScrollView>
        )}

        {tab === 'friends' && (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 10 }}>
              <TextInput
                placeholder="@username yoki taklif kodi..."
                placeholderTextColor={theme.textMuted}
                value={friendInput}
                onChangeText={setFriendInput}
                autoCapitalize="none"
                style={[styles.input, { flex: 1, color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              />
              <TouchableOpacity onPress={handleAddFriend} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Qo‘shish</Text>
              </TouchableOpacity>
            </View>

            {incomingRequests.length > 0 && (
              <View style={{ paddingHorizontal: 14, marginBottom: 10 }}>
                <Text style={{ color: theme.secondary, fontWeight: '700', fontSize: 12, marginBottom: 4 }}>
                  Do‘stlik so‘rovlari ({incomingRequests.length})
                </Text>
                {incomingRequests.map((req) => (
                  <View key={req.relationId} style={[styles.row, { borderColor: theme.border }]}>
                    <UserAvatar name={req.peer.displayName} color={req.peer.avatarColor} size={38} />
                    <Text style={{ flex: 1, color: theme.text, fontWeight: '700' }}>{req.peer.displayName}</Text>
                    <TouchableOpacity
                      onPress={() => ApiController.acceptFriend(req.relationId)}
                      style={[styles.smallBtn, { backgroundColor: theme.success }]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Qabul</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <Text style={{ color: theme.textMuted, fontWeight: '700', fontSize: 12, paddingHorizontal: 14, marginTop: 4 }}>
              Do‘stlar ({friends.length})
            </Text>
            {friends.map((f) => (
              <View key={f.relationId} style={[styles.row, { borderColor: theme.border }]}>
                <TouchableOpacity onPress={() => ApiController.openChat(f.peer)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <UserAvatar name={f.peer.displayName} color={f.peer.avatarColor} online={f.peer.online} />
                  <View>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{f.peer.displayName}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>{f.peer.username ? `@${f.peer.username}` : f.peer.email}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => ApiController.removeFriend(f.peer.id)}
                  style={[styles.smallBtn, { backgroundColor: 'rgba(244,63,94,0.18)' }]}
                >
                  <Text style={{ color: theme.danger, fontSize: 11.5, fontWeight: '700' }}>Chiqarish</Text>
                </TouchableOpacity>
              </View>
            ))}

            <Text style={{ color: theme.textMuted, fontWeight: '700', fontSize: 12, paddingHorizontal: 14, marginTop: 14 }}>
              Barcha foydalanuvchilar
            </Text>
            {users
              .filter(
                (u) =>
                  u.displayName.toLowerCase().includes(query.toLowerCase()) ||
                  (u.username || '').toLowerCase().includes(query.toLowerCase())
              )
              .map((u) => (
                <View key={u.id} style={[styles.row, { borderColor: theme.border }]}>
                  <TouchableOpacity onPress={() => ApiController.openChat(u)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <UserAvatar name={u.displayName} color={u.avatarColor} online={u.online} />
                    <View>
                      <Text style={[styles.rowTitle, { color: theme.text }]}>{u.displayName}</Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12 }}>{u.username ? `@${u.username}` : u.email}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => ApiController.sendFriendRequest({ targetUserId: u.id })}
                    style={[styles.smallBtn, { backgroundColor: theme.elevated }]}
                  >
                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>+ Do‘st</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </ScrollView>
        )}

        {tab === 'calls' && (
          <FlatList
            data={calls}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) =>
              item.peer ? (
                <TouchableOpacity
                  onPress={() => ApiController.openChat(item.peer!)}
                  style={[styles.row, { borderColor: theme.border }]}
                >
                  <UserAvatar name={item.peer.displayName} color={item.peer.avatarColor} online={item.peer.online} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: theme.text }]}>{item.peer.displayName}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12.5 }}>
                      {item.direction === 'outgoing' ? '↗ Chiquvchi' : '↙ Kiruvchi'} • {item.callType} ({item.status}
                      {item.durationSec > 0 ? `, ${item.durationSec}s` : ''})
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        {tab === 'profile' && (
          <ScrollView contentContainerStyle={styles.profilePad}>
            <View style={styles.profileTop}>
              <UserAvatar name={displayName} color={avatarColor} online size={64} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: theme.text, fontSize: 18 }]}>{user.displayName}</Text>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>{user.email}</Text>
              </View>
            </View>

            <View style={[styles.devCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={{ color: theme.secondary, fontWeight: '700', fontSize: 12 }}>Profil va Taklif havolalari</Text>
              <Text selectable style={{ color: theme.text, fontSize: 12, marginTop: 4 }}>Profil: {profileLink}</Text>
              <Text selectable style={{ color: theme.text, fontSize: 12, marginTop: 2 }}>Taklif: {inviteLink}</Text>
            </View>

            <View style={styles.swatchRow}>
              {AVATAR_SWATCHES.map((hex) => (
                <TouchableOpacity
                  key={hex}
                  onPress={() => setAvatarColor(hex)}
                  style={[
                    styles.swatch,
                    { backgroundColor: hex },
                    hex === avatarColor && { borderWidth: 3, borderColor: '#FFF' },
                  ]}
                />
              ))}
            </View>

            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ko‘rinadigan ism"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username (@)"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Bio / Holat"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefon raqami"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />

            <TouchableOpacity onPress={handleSaveProfile} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Profilni saqlash</Text>
            </TouchableOpacity>

            {/* Developer Mode Card */}
            <View style={[styles.devCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.devTop}>
                <Text style={{ color: theme.text, fontWeight: '700' }}>Dasturchi rejimi</Text>
                <Switch value={devMode} onValueChange={(v) => { dispatch(setDevMode(v)); }} />
              </View>
              {devMode && (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                    UserID: {user.id}{'\n'}
                    DB: {dbEngine} | Server: {serverUrl}{'\n'}
                    WS: {wsConnected ? 'Connected' : 'Disconnected'} | Ping: {pingMs ?? '--'} ms
                  </Text>
                  <TouchableOpacity
                    onPress={() => SocketController.send('ping', { ts: Date.now() })}
                    style={[styles.pingBtn, { backgroundColor: theme.elevated }]}
                  >
                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Ping Server</Text>
                  </TouchableOpacity>
                  <Text style={{ color: theme.secondary, fontSize: 11 }}>
                    {devLogs.slice(0, 8).join('\n')}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                SocketController.disconnect();
                ApiController.logout();
              }}
              style={[styles.logoutBtn, { borderColor: theme.danger }]}
            >
              <Text style={{ color: theme.danger, fontWeight: '700' }}>Hisobdan chiqish</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {(['chats', 'friends', 'calls', 'profile'] as const).map((key) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} style={styles.tabBtn}>
            <Text style={{ color: tab === key ? theme.primary : theme.textMuted, fontWeight: '700', fontSize: 13 }}>
              {key === 'chats' ? 'Chatlar' : key === 'friends' ? 'Do‘stlar' : key === 'calls' ? 'Qo‘ng‘iroqlar' : 'Profil'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ModeratorModal visible={modVisible} onClose={() => setModVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 46,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  searchBox: { margin: 12, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  body: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  unread: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  addBtn: { borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  smallBtn: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  profilePad: { padding: 18, gap: 12 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  swatchRow: { flexDirection: 'row', gap: 10, marginVertical: 4 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  saveBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  devCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  devTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pingBtn: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  logoutBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  tabBar: { flexDirection: 'row', borderTopWidth: 1, paddingVertical: 12 },
  tabBtn: { flex: 1, alignItems: 'center' },
});
