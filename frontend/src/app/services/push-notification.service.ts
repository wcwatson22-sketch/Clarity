import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private base = environment.apiUrl;
  private vapidKey = environment.vapidPublicKey;

  readonly supported  = signal('serviceWorker' in navigator && 'PushManager' in window);
  readonly permission = signal<NotificationPermission>(
    'Notification' in window ? Notification.permission : 'denied'
  );
  readonly subscribed = signal(false);
  readonly loading    = signal(false);

  constructor(private http: HttpClient) {}

  /** Call once on settings page load to sync status from server */
  async syncStatus() {
    if (!this.supported()) return;
    try {
      const res = await this.http.get<{ subscribed: boolean }>(`${this.base}/push/status`).toPromise();
      this.subscribed.set(res?.subscribed ?? false);
    } catch { /* silently ignore */ }
  }

  /** Request permission + subscribe. Returns true on success. */
  async enable(): Promise<boolean> {
    if (!this.supported() || !this.vapidKey) return false;
    this.loading.set(true);
    try {
      // Ask permission
      const perm = await Notification.requestPermission();
      this.permission.set(perm);
      if (perm !== 'granted') { this.loading.set(false); return false; }

      // Get service worker registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidKey)
      });

      const json = sub.toJSON();
      const keys = json.keys as { p256dh: string; auth: string };

      // Send to backend
      await this.http.post(`${this.base}/push/subscribe`, {
        endpoint: sub.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      }).toPromise();

      this.subscribed.set(true);
      this.loading.set(false);
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      this.loading.set(false);
      return false;
    }
  }

  /** Unsubscribe this device */
  async disable(): Promise<void> {
    if (!this.supported()) return;
    this.loading.set(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const json = sub.toJSON();
        const keys = json.keys as { p256dh: string; auth: string };
        await this.http.delete(`${this.base}/push/subscribe`, {
          body: { endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth }
        }).toPromise();
        await sub.unsubscribe();
      }
      this.subscribed.set(false);
    } catch (err) {
      console.error('Push unsubscribe error:', err);
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
