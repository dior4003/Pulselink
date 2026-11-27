import { Platform } from 'react-native';
import { store } from '../store/store';
import { showToast, clearToast } from '../store/slices/settingsSlice';

declare const require: any;

class NotificationManager {
  private toastTimer: any = null;

  async requestPermissions() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => {});
      }
      return;
    }
    try {
      const Notifications = require('expo-notifications');
      await Notifications.requestPermissionsAsync();
    } catch {}
  }

  private playChime() {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  }

  async notify(title: string, body: string, peerId?: string) {
    // 1. In-app toast banner
    clearTimeout(this.toastTimer);
    store.dispatch(showToast({ title, body, peerId }));
    this.toastTimer = setTimeout(() => {
      store.dispatch(clearToast());
    }, 4500);

    this.playChime();

    // 2. OS / Browser notification
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(title, { body });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
      return;
    }

    try {
      const Notifications = require('expo-notifications');
      await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: true },
        trigger: null,
      });
    } catch {}
  }
}

export const NotificationController = new NotificationManager();
