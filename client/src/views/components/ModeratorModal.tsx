import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { ApiController } from '../../controllers/ApiController';
import { DARK_THEME, LIGHT_THEME } from '../theme/colors';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const ModeratorModal: React.FC<Props> = ({ visible, onClose }) => {
  const { modToken, user } = useSelector((s: RootState) => s.auth);
  const darkTheme = useSelector((s: RootState) => s.settings.darkTheme);
  const theme = darkTheme ? DARK_THEME : LIGHT_THEME;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passkey, setPasskey] = useState('');
  const [subTab, setSubTab] = useState<'overview' | 'users' | 'messages' | 'calls' | 'logs'>('overview');

  const [stats, setStats] = useState<any>(null);
  const [activeCallsCount, setActiveCallsCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [broadcastText, setBroadcastText] = useState('');

  const loadAll = async () => {
    const data = await ApiController.modLoadDashboard();
    setStats(data.stats);
    setActiveCallsCount(data.activeCallsCount);
    setUsers(data.users);
    setReports(data.reports);
    setMessages(data.messages);
    setCalls(data.calls);
    setLogs(data.logs);
  };

  const handleLogin = async () => {
    try {
      await ApiController.modLogin(identifier, password, passkey);
      await loadAll();
    } catch (err: any) {
      Alert.alert('Kirish rad etildi', err.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.topRow}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>🛡️ Moderator Markazi</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: theme.danger, fontWeight: '800', fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {!modToken ? (
            <View style={{ gap: 10 }}>
              <Text style={{ color: theme.textMuted, fontSize: 12.5 }}>
                Yashirin portal. Kirish uchun moderator hisobi va maxfiy kalit talab qilinadi.
              </Text>
              <TextInput
                placeholder="Moderator email/username"
                placeholderTextColor={theme.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              />
              <TextInput
                placeholder="Parol"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              />
              <TextInput
                placeholder="MOD_PASSKEY"
                placeholderTextColor={theme.textMuted}
                value={passkey}
                onChangeText={setPasskey}
                secureTextEntry
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              />
              <TouchableOpacity onPress={handleLogin} style={[styles.btn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Tasdiqlash va kirish</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40, marginBottom: 8 }}>
                {(['overview', 'users', 'messages', 'calls', 'logs'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setSubTab(t)}
                    style={[styles.pill, { backgroundColor: subTab === t ? theme.primary : theme.bg }]}
                  >
                    <Text style={{ color: subTab === t ? '#FFF' : theme.textMuted, fontSize: 12, fontWeight: '700' }}>
                      {t === 'overview' ? 'Umumiy' : t === 'users' ? 'Foydalanuvchilar' : t === 'messages' ? 'Xabarlar' : t === 'calls' ? 'Qo‘ng‘iroqlar' : 'Audit Log'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                {subTab === 'overview' && (
                  <>
                    {stats && (
                      <View style={[styles.box, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                        <Text style={{ color: theme.secondary, fontWeight: '700', fontSize: 13 }}>
                          Foydalanuvchilar: {stats.totalUsers} | Bloklangan: {stats.bannedUsers} | Mute: {stats.mutedUsers}{'\n'}
                          Xabarlar: {stats.totalMessages} | Faol qo‘ng‘iroqlar: {activeCallsCount} | Ochiq shikoyatlar: {stats.openReports}
                        </Text>
                      </View>
                    )}

                    <TextInput
                      placeholder="Barcha onlayn foydalanuvchilarga e’lon yuborish..."
                      placeholderTextColor={theme.textMuted}
                      value={broadcastText}
                      onChangeText={setBroadcastText}
                      style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        if (!broadcastText.trim()) return;
                        await ApiController.modBroadcast(broadcastText);
                        setBroadcastText('');
                        await loadAll();
                        Alert.alert('Yuborildi', 'E’lon barchaga yetkazildi');
                      }}
                      style={[styles.btn, { backgroundColor: '#8B5CF6' }]}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '700' }}>📢 E’lon tarqatish</Text>
                    </TouchableOpacity>

                    <Text style={{ color: theme.text, fontWeight: '700', marginTop: 6 }}>Ochiq shikoyatlar</Text>
                    {reports.filter((r) => r.status === 'open').map((r) => (
                      <View key={r.id} style={[styles.row, { borderColor: theme.border }]}>
                        <Text style={{ color: theme.text, flex: 1, fontSize: 12.5 }}>{r.targetName}: {r.reason}</Text>
                        <TouchableOpacity
                          onPress={async () => {
                            await ApiController.modResolveReport(r.id);
                            await loadAll();
                          }}
                          style={[styles.miniBtn, { backgroundColor: theme.success }]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Yopish</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}

                {subTab === 'users' &&
                  users.map((u) => (
                    <View key={u.id} style={[styles.box, { backgroundColor: theme.bg, borderColor: theme.border, gap: 6 }]}>
                      <Text style={{ color: theme.text, fontWeight: '700' }}>
                        {u.displayName} ({u.role}) {u.isBanned ? '🚫' : ''}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 11.5 }}>
                        {u.email} • Ogohlantirishlar: {u.warningsCount || 0}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        <TouchableOpacity
                          onPress={async () => {
                            await ApiController.modToggleBan(u.id, !u.isBanned);
                            await loadAll();
                          }}
                          style={[styles.miniBtn, { backgroundColor: u.isBanned ? theme.success : theme.danger }]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{u.isBanned ? 'Ochish' : 'Ban'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            await ApiController.modMuteUser(u.id, 60);
                            await loadAll();
                          }}
                          style={[styles.miniBtn, { backgroundColor: '#F59E0B' }]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Mute 60m</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            await ApiController.modWarnUser(u.id, 'Qoidalarga rioya qiling');
                            await loadAll();
                          }}
                          style={[styles.miniBtn, { backgroundColor: theme.primary }]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>Warn</Text>
                        </TouchableOpacity>
                        {user?.role === 'admin' && u.role !== 'admin' && (
                          <TouchableOpacity
                            onPress={async () => {
                              await ApiController.modSetRole(u.id, u.role === 'moderator' ? 'user' : 'moderator');
                              await loadAll();
                            }}
                            style={[styles.miniBtn, { backgroundColor: '#8B5CF6' }]}
                          >
                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                              {u.role === 'moderator' ? 'User qilish' : 'Mod qilish'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}

                {subTab === 'messages' &&
                  messages.map((m) => (
                    <View key={m.id} style={[styles.row, { borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.secondary, fontSize: 11, fontWeight: '700' }}>
                          {m.senderName} → {m.receiverName}
                        </Text>
                        <Text style={{ color: theme.text, fontSize: 13 }}>{m.text}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={async () => {
                          await ApiController.modDeleteMessage(m.id);
                          await loadAll();
                        }}
                        style={[styles.miniBtn, { backgroundColor: theme.danger }]}
                      >
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>O‘chirish</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                {subTab === 'calls' &&
                  (calls.length === 0 ? (
                    <Text style={{ color: theme.textMuted }}>Hozir faol qo‘ng‘iroqlar yo‘q.</Text>
                  ) : (
                    calls.map((c) => (
                      <View key={c.callId} style={[styles.row, { borderColor: theme.border }]}>
                        <Text style={{ color: theme.text, flex: 1, fontSize: 12 }}>
                          {c.callType.toUpperCase()} • {c.callId.slice(0, 8)}
                        </Text>
                        <TouchableOpacity
                          onPress={async () => {
                            await ApiController.modTerminateCall(c.callId);
                            await loadAll();
                          }}
                          style={[styles.miniBtn, { backgroundColor: theme.danger }]}
                        >
                          <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>To‘xtatish</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  ))}

                {subTab === 'logs' &&
                  logs.map((l) => (
                    <Text key={l.id} style={{ color: theme.textMuted, fontSize: 11.5 }}>
                      [{l.moderatorName}] {l.action} {l.details ? `— ${l.details}` : ''}
                    </Text>
                  ))}
              </ScrollView>

              <TouchableOpacity
                onPress={() => {
                  ApiController.modLogout();
                  onClose();
                }}
                style={[styles.btn, { backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.danger }]}
              >
                <Text style={{ color: theme.danger, fontWeight: '700' }}>Moderator sessiyasini yopish</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.78)', justifyContent: 'center', padding: 16 },
  sheet: { maxHeight: '88%', borderRadius: 22, borderWidth: 1, padding: 18, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5 },
  btn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginRight: 6 },
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
});
