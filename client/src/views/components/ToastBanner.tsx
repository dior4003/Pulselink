import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store/store';
import { clearToast } from '../../store/slices/settingsSlice';
import { ApiController } from '../../controllers/ApiController';

export const ToastBanner: React.FC = () => {
  const dispatch = useDispatch();
  const toast = useSelector((s: RootState) => s.settings.toast);
  const users = useSelector((s: RootState) => s.chat.users);

  if (!toast) return null;

  const handlePress = () => {
    if (toast.peerId) {
      const peer = users.find((u) => u.id === toast.peerId);
      if (peer) ApiController.openChat(peer);
    }
    dispatch(clearToast());
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.title}>{toast.title}</Text>
        <Text numberOfLines={2} style={styles.body}>{toast.body}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 44,
    left: 14,
    right: 14,
    zIndex: 100,
  },
  card: {
    backgroundColor: '#1E293B',
    borderColor: '#6366F1',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  title: { color: '#06B6D4', fontWeight: '800', fontSize: 13, marginBottom: 2 },
  body: { color: '#F1F5F9', fontSize: 13.5 },
});
