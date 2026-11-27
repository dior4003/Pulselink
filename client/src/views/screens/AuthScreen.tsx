import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
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
import { SocketController } from '../../controllers/SocketController';
import { DARK_THEME, LIGHT_THEME } from '../theme/colors';

export const AuthScreen: React.FC = () => {
  const { loading, error } = useSelector((s: RootState) => s.auth);
  const { darkTheme, googleClientId } = useSelector((s: RootState) => s.settings);
  const theme = darkTheme ? DARK_THEME : LIGHT_THEME;

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Password reset state
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !googleClientId || typeof document === 'undefined') return;
    if (document.getElementById('gsi-script')) return;
    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (res: any) => {
            const ok = await ApiController.loginWithGoogle(res.credential);
            if (ok) {
              SocketController.connect();
              ApiController.refreshLists().catch(() => {});
            }
          },
        });
      }
    };
    document.body.appendChild(script);
  }, [googleClientId]);

  const handleSubmit = async () => {
    const ok =
      mode === 'register'
        ? await ApiController.register({ displayName, email, username, phone, password })
        : await ApiController.login(identifier, password);
    if (ok) {
      SocketController.connect();
      ApiController.refreshLists().catch(() => {});
    }
  };

  const handleSendResetCode = async () => {
    try {
      setResetNotice(null);
      const res = await ApiController.forgotPassword(resetIdentifier);
      setResetStep(2);
      setResetNotice(res.devCode ? `${res.message} (Test kodi: ${res.devCode})` : res.message);
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    }
  };

  const handleConfirmReset = async () => {
    try {
      const res = await ApiController.resetPassword(resetIdentifier, resetCode, newPassword);
      Alert.alert('Muvaffaqiyatli', res.message);
      setMode('login');
      setResetStep(1);
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message);
    }
  };

  const handleGooglePress = () => {
    if (!googleClientId) {
      Alert.alert('Google OAuth', 'Serverdagi .env faylida GOOGLE_CLIENT_ID ni kiriting.');
      return;
    }
    if (Platform.OS === 'web') {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        g.accounts.id.prompt();
      } else {
        Alert.alert('Google OAuth', 'Google SDK yuklanmadi.');
      }
    } else {
      Alert.alert('Google OAuth', 'Mobil ilovada Google Sign-In uchun GOOGLE_CLIENT_ID va SHA-1 sozlang.');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: theme.bg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.brandRow}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>PL</Text>
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>PulseLink</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
              Video, audio va tezkor chat
            </Text>
          </View>
        </View>

        {mode !== 'reset' ? (
          <>
            <View style={[styles.tabs, { backgroundColor: theme.bg }]}>
              <TouchableOpacity
                onPress={() => setMode('login')}
                style={[styles.tab, mode === 'login' && { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.tabText, { color: mode === 'login' ? '#FFF' : theme.textMuted }]}>Kirish</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMode('register')}
                style={[styles.tab, mode === 'register' && { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.tabText, { color: mode === 'register' ? '#FFF' : theme.textMuted }]}>Ro‘yxatdan o‘tish</Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' ? (
              <>
                <TextInput
                  placeholder="Ism va familiya"
                  placeholderTextColor={theme.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
                <TextInput
                  placeholder="Email (yoki pastga telefon kiriting)"
                  placeholderTextColor={theme.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
                <TextInput
                  placeholder="Telefon raqami (+998901234567)"
                  placeholderTextColor={theme.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
                <TextInput
                  placeholder="Username (ixtiyoriy)"
                  placeholderTextColor={theme.textMuted}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
              </>
            ) : (
              <TextInput
                placeholder="Email, telefon raqami yoki username"
                placeholderTextColor={theme.textMuted}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
              />
            )}

            <TextInput
              placeholder="Parol"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
            />

            {mode === 'login' && (
              <TouchableOpacity onPress={() => setMode('reset')} style={{ alignSelf: 'flex-end' }}>
                <Text style={{ color: theme.secondary, fontSize: 12.5, fontWeight: '600' }}>
                  Parolni unutdingizmi?
                </Text>
              </TouchableOpacity>
            )}

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

            <TouchableOpacity
              disabled={loading}
              onPress={handleSubmit}
              style={[styles.btnPrimary, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.btnText}>
                {loading ? 'Kutilmoqda...' : mode === 'register' ? 'Hisob yaratish' : 'Kirish'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={loading}
              onPress={handleGooglePress}
              style={[styles.btnOutline, { borderColor: theme.border }]}
            >
              <Text style={[styles.btnText, { color: theme.text }]}>Google orqali davom etish</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Parolni tiklash</Text>
            <TextInput
              placeholder="Email, telefon raqami yoki username"
              placeholderTextColor={theme.textMuted}
              value={resetIdentifier}
              onChangeText={setResetIdentifier}
              autoCapitalize="none"
              style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
            />
            {resetStep === 2 && (
              <>
                <TextInput
                  placeholder="6 xonali tasdiqlash kodi"
                  placeholderTextColor={theme.textMuted}
                  value={resetCode}
                  onChangeText={setResetCode}
                  keyboardType="number-pad"
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
                <TextInput
                  placeholder="Yangi parol (kamida 4 ta belgi)"
                  placeholderTextColor={theme.textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  style={[styles.input, { color: theme.text, backgroundColor: theme.bg, borderColor: theme.border }]}
                />
              </>
            )}
            {resetNotice ? <Text style={{ color: theme.secondary, fontSize: 12.5 }}>{resetNotice}</Text> : null}
            <TouchableOpacity
              onPress={resetStep === 1 ? handleSendResetCode : handleConfirmReset}
              style={[styles.btnPrimary, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.btnText}>
                {resetStep === 1 ? 'Tiklash kodini olish' : 'Parolni yangilash'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode('login'); setResetStep(1); }}>
              <Text style={{ color: theme.textMuted, textAlign: 'center', fontWeight: '600' }}>← Kirishga qaytish</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, borderRadius: 24, padding: 24, borderWidth: 1, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  logo: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFF', fontWeight: '800', fontSize: 18 },
  title: { fontSize: 22, fontWeight: '800' },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 12, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabText: { fontWeight: '700', fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  error: { fontSize: 13, fontWeight: '600' },
  btnPrimary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnOutline: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
