import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';

const NATIVE_KEY    = 'clarity_notif_native';   // 'true' when enabled
const BANNER_KEY    = 'clarity_banner_date';     // ISO date string when in-app banner last shown

/**
 * Push-notification strategy
 * ─────────────────────────────────────────────────────────────────────────
 * ACTIVE users (open the app ≥ once / 7 days):
 *   • Show an in-app progress banner on the Dashboard — vague directional
 *     language only, no numbers (see DashboardComponent).
 *   • Every time the app opens, we push the next scheduled notification
 *     7 days further out, so it never fires for active users.
 *
 * INACTIVE users (haven't opened the app in 7+ days):
 *   • The scheduled local notification fires once.
 *   • Message is completely generic — safe on a lock screen.
 *   • When they open the app after that, the cycle resets.
 *
 * Frequency: maximum 1 notification per 7-day window.
 * Privacy: push messages contain ZERO financial data.
 */

// ── Message pools ──────────────────────────────────────────────────────────

/** Lock-screen safe — never financial detail */
const PUSH_MESSAGES = [
  'Your weekly financial check-in is ready.',
  'Take a minute to check your progress.',
  'Small updates can create better clarity.',
  'A quick check-in can help keep you on track.',
  'Your financial picture is waiting for you.',
  'Staying consistent pays off — open Clarity.',
];

/** In-app only — analyzes snapshot direction, still no numbers */
export const PROGRESS_MESSAGES = {
  positive: [
    'Things are moving in the right direction.',
    'You made meaningful progress since your last update.',
    'A few areas improved since you last checked in.',
    'Your financial picture is getting clearer.',
    'Progress is happening — keep it up.',
    'Positive movement across a few areas since your last update.',
  ],
  negative: [
    'One or more areas may benefit from a closer look.',
    'A few things shifted since your last update — worth reviewing.',
    'Some areas have changed. It may be a good time to review.',
    'Now might be a good time to revisit a few categories.',
  ],
  neutral: [
    'Your financial picture is taking shape.',
    'Things have been relatively stable since your last check-in.',
    'Some areas moved since your last update.',
    'Your data is up to date — keep an eye on the trends.',
    'Steady progress is still progress.',
  ],
};

const pick = (pool: string[]) => pool[Math.floor(Math.random() * pool.length)];

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private base     = environment.apiUrl;
  private vapidKey = environment.vapidPublicKey;

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
      this.subscribed.set(localStorage.getItem(NATIVE_KEY) === 'true');
    }
  }

  async syncStatus() {
    if (this.isNative) {
      this.subscribed.set(localStorage.getItem(NATIVE_KEY) === 'true');
      return;
    }
    if (!this.supported()) return;
    try {
      const res = await this.http.get<{ subscribed: boolean }>(`${this.base}/push/status`).toPromise();
      this.subscribed.set(res?.subscribed ?? false);
    } catch { /* silently ignore */ }
  }

  /** Enable notifications. On native, schedules first notification 7 days out. */
  async enable(): Promise<boolean> {
    return this.isNative ? this.enableNative() : this.enableWeb();
  }

  /** Disable notifications. */
  async disable(): Promise<void> {
    if (this.isNative) { await this.disableNative(); } else { await this.disableWeb(); }
  }

  /**
   * Call this every time the app opens (from AppComponent constructor).
   * Cancels any pending notification and reschedules it 7 days from now.
   * Result: active users (weekly openers) never see the push.
   * Only truly inactive users (7+ day gap) will see it fire.
   */
  async rescheduleOnAppOpen() {
    if (!this.isNative || !this.subscribed()) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await this.scheduleNext(LocalNotifications);
    } catch { /* silently ignore — don't crash app startup */ }
  }

  // ── Shared in-app banner helper ──────────────────────────────────────────

  /**
   * Returns a vague progress message for the in-app banner based on
   * the direction of change between the two most recent snapshots.
   * Returns null if the banner was already shown today or not enough data.
   */
  pickInAppMessage(snapshots: { netWorth: number; totalAssets: number; totalLiabilities: number }[]): string | null {
    if (snapshots.length < 2) return null;

    const today = new Date().toDateString();
    if (localStorage.getItem(BANNER_KEY) === today) return null; // shown today

    const [latest, prev] = snapshots;
    const nwUp    = latest.netWorth > prev.netWorth;
    const assetUp = latest.totalAssets > prev.totalAssets;
    const liabDwn = latest.totalLiabilities < prev.totalLiabilities;

    const positiveCount = [nwUp, assetUp, liabDwn].filter(Boolean).length;
    const negativeCount = [!nwUp, !assetUp, !liabDwn].filter(Boolean).length;

    let pool: string[];
    if (positiveCount >= 2) {
      pool = PROGRESS_MESSAGES.positive;
    } else if (negativeCount >= 2) {
      pool = PROGRESS_MESSAGES.negative;
    } else {
      pool = PROGRESS_MESSAGES.neutral;
    }

    localStorage.setItem(BANNER_KEY, today);
    return pick(pool);
  }

  // ── Native local notifications ────────────────────────────────────────────

  private async enableNative(): Promise<boolean> {
    this.loading.set(true);
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const { display } = await LocalNotifications.requestPermissions();
      if (display !== 'granted') { this.loading.set(false); return false; }

      await this.scheduleNext(LocalNotifications);

      localStorage.setItem(NATIVE_KEY, 'true');
      this.subscribed.set(true);
      this.loading.set(false);
      return true;
    } catch (err) {
      console.error('[Clarity] Local notification error:', err);
      this.loading.set(false);
      return false;
    }
  }

  /** Cancel pending and schedule one notification exactly 7 days from now at 10 am */
  private async scheduleNext(LocalNotifications: any) {
    try {
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length) await LocalNotifications.cancel({ notifications: pending });
    } catch { /* none pending */ }

    const fireAt = new Date();
    fireAt.setDate(fireAt.getDate() + 7);
    fireAt.setHours(10, 0, 0, 0);

    await LocalNotifications.schedule({
      notifications: [{
        id: 2001,
        title: 'Clarity',
        body: pick(PUSH_MESSAGES),
        schedule: { at: fireAt, allowWhileIdle: true },
      }],
    });
  }

  private async disableNative(): Promise<void> {
    this.loading.set(true);
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length) await LocalNotifications.cancel({ notifications: pending });
      localStorage.removeItem(NATIVE_KEY);
      this.subscribed.set(false);
    } catch (err) {
      console.error('[Clarity] Cancel notification error:', err);
    }
    this.loading.set(false);
  }

  // ── Web push ──────────────────────────────────────────────────────────────

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
        endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth,
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
