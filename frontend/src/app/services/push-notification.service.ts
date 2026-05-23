import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

const NATIVE_NOTIF_KEY = 'clarity_notif_native';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private base     = environment.apiUrl;
  private vapidKey = environment.vapidPublicKey;

  /** True on iOS/Android — uses local notifications instead of web push */
  readonly isNative = Capacitor.isNativePlatform();

  readonly supported = signal(
    Capacitor.isNativePlatform() ||
    ('serviceWorker' in navigator && 'PushManager' in window)
  );
  readonly permission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  readonly subscribed = signal(false);
  readonly loading    = signal(false);

  constructor(private http: HttpClient) {
    if (this.isNative) {
      // Restore saved state from local storage
      this.subscribed.set(localStorage.getItem(NATIVE_NOTIF_KEY) === 'true');
    }
  }

  /** Sync subscription status (call from settings page) */
  async syncStatus() {
    if (this.isNative) {
      this.subscribed.set(localStorage.getItem(NATIVE_NOTIF_KEY) === 'true');
      return;
    }
    if (!this.supported()) return;
    try {
      const res = await this.http.get<{ subscribed: boolean }>(`${this.base}/push/status`).toPromise();
      this.subscribed.set(res?.subscribed ?? false);
    } catch { /* silently ignore */ }
  }

  /** Enable notifications — dispatches to native or web implementation */
  async enable(): Promise<boolean> {
    return this.isNative ? this.enableNative() : this.enableWeb();
  }

  /** Disable notifications */
  async disable(): Promise<void> {
    if (this.isNative) { await this.disableNative(); } else { await this.disableWeb(); }
  }

  // ── Native (iOS / Android) — local scheduled notifications ────────────

  private async enableNative(): Promise<boolean> {
    this.loading.set(true);
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') {
        this.loading.set(false);
        return false;
      }

      // Cancel any previously scheduled Clarity notifications
      try {
        const { notifications: pending } = await LocalNotifications.getPending();
        if (pending.length) await LocalNotifications.cancel({ notifications: pending });
      } catch { /* ignore if none pending */ }

      const messages = [
        'How are your finances this week? Take a moment to update Clarity 📊',
        "You're on track — log any changes in Clarity 💰",
        'Weekly check-in: review your net worth progress 🎯',
        "You're having a great month — keep it going! 🚀",
        'Quick update time! Log any financial changes in Clarity ✅',
        'Stay on top of your goals — open Clarity and check in 📈',
      ];
      const pick = () => messages[Math.floor(Math.random() * messages.length)];

      // Schedule Tuesdays at 7 pm and Fridays at 7 pm, repeating weekly
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2001,
            title: 'Clarity — Finance Check-in',
            body: pick(),
            schedule: {
              on: { weekday: 3, hour: 19, minute: 0 }, // Tuesday
              repeats: true,
              allowWhileIdle: true,
            },
          },
          {
            id: 2002,
            title: 'Clarity — Weekly Update',
            body: pick(),
            schedule: {
              on: { weekday: 6, hour: 19, minute: 0 }, // Friday
              repeats: true,
              allowWhileIdle: true,
            },
          },
        ],
      });

      localStorage.setItem(NATIVE_NOTIF_KEY, 'true');
      this.subscribed.set(true);
      this.loading.set(false);
      return true;
    } catch (err) {
      console.error('[Clarity] Local notification error:', err);
      this.loading.set(false);
      return false;
    }
  }

  private async disableNative(): Promise<void> {
    this.loading.set(true);
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length) await LocalNotifications.cancel({ notifications: pending });
      localStorage.removeItem(NATIVE_NOTIF_KEY);
      this.subscribed.set(false);
    } catch (err) {
      console.error('[Clarity] Cancel notification error:', err);
    }
    this.loading.set(false);
  }

  // ── Web (browser) — Web Push API ──────────────────────────────────────

  private async enableWeb(): Promise<boolean> {
    if (!this.supported() || !this.vapidKey) return false;
    this.loading.set(true);
    try {
      const perm = await Notification.requestPermission();
      this.permission.set(perm);
      if (perm !== 'granted') { this.loading.set(false); return false; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey),
      });

      const json = sub.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };
      await this.http.post(`${this.base}/push/subscribe`, {
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }).toPromise();

      this.subscribed.set(true);
      this.loading.set(false);
      return true;
    } catch (err) {
      console.error('[Clarity] Web push subscribe error:', err);
      this.loading.set(false);
      return false;
    }
  }

  private async disableWeb(): Promise<void> {
    if (!this.supported()) return;
    this.loading.set(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        const keys = json.keys as { p256dh: string; auth: string };
        await this.http.delete(`${this.base}/push/subscribe`, {
          body: { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth },
        }).toPromise();
        await sub.unsubscribe();
      }
      this.subscribed.set(false);
    } catch (err) {
      console.error('[Clarity] Web push unsubscribe error:', err);
    }
    this.loading.set(false);
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }
}
