import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, MeResponse, SignupRequest } from '../models/auth.models';
import { migrateGlobalKeys, LEGACY_DEVICE_FINANCIAL_KEYS } from './scoped-storage';
import { SecureStorageService } from './secure-storage.service';

const TOKEN_KEY           = 'clarity_token';
const USER_KEY             = 'clarity_user';
const FACE_ID_KEY          = 'clarity_face_id';       // must match LockService's key
const BIOMETRIC_SESSION_KEY = 'clarity_biometric_session'; // Keychain key, not localStorage
const INSTALL_MARKER_KEY   = 'clarity_install_marker';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private secure = inject(SecureStorageService);
  private base   = `${environment.apiUrl}/auth`;

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user  = signal<MeResponse | null>(
    JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
  );

  readonly isLoggedIn  = computed(() => !!this._token());
  readonly currentUser = computed(() => this._user());
  readonly token       = computed(() => this._token());
  readonly isPremium   = computed(() => this._user()?.tier === 'Premium');

  constructor() {
    // iOS Keychain data survives app deletion/reinstall (this is documented,
    // expected OS behavior, not a bug) — localStorage does NOT. So "no install
    // marker in localStorage" reliably means either a genuinely fresh install
    // or a reinstall, and either way any leftover Keychain entry from a
    // previous install is stale and must not be trusted. This runs once per
    // install, is a no-op on an empty Keychain, and is cheap.
    if (Capacitor.isNativePlatform() && !localStorage.getItem(INSTALL_MARKER_KEY)) {
      this.secure.remove(BIOMETRIC_SESSION_KEY);
      localStorage.setItem(INSTALL_MARKER_KEY, '1');
    }
  }

  /** Called once on app init — issues a fresh JWT + refreshes user data.
   *  Ensures the token always carries the correct claims (isAdmin, tier, etc.)
   *  so that admin endpoints and feature gates work without requiring a re-login.
   *  Skip while the lock screen is in charge (see AppComponent) — the lock
   *  screen owns its own refresh as part of the Face ID unlock sequence, and
   *  firing a second, unsynchronized refresh here just races it for no reason. */
  refreshIfLoggedIn() {
    if (!this._token()) return;
    this.http.post<AuthResponse>(`${this.base}/refresh`, {}).subscribe({
      next: res => this.store(res),
      error: () => {} // non-fatal — stale token is fine as fallback
    });
  }

  signup(req: SignupRequest) {
    return this.http.post<AuthResponse>(`${this.base}/signup`, req).pipe(
      tap(res => this.store(res))
    );
  }

  login(req: LoginRequest) {
    return this.http.post<AuthResponse>(`${this.base}/login`, req).pipe(
      tap(res => this.store(res))
    );
  }

  updateCachedUser(user: MeResponse) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this._user.set(user);
  }

  /** Store a fresh AuthResponse (token + user) — used by the lock screen after password verify. */
  storeAuth(res: AuthResponse) { this.store(res); }

  /**
   * Temporarily makes `token` the active session (signal + localStorage) WITHOUT
   * touching the Keychain copy or user object. Used only by the lock screen: it
   * retrieves a token from Keychain after a successful Face ID check, then needs
   * that token attached to the very next HTTP call (the /auth/refresh validation
   * request) via the normal auth interceptor. If that refresh succeeds, storeAuth()
   * is called right after with the full response, which supersedes this.
   */
  setRawToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    this._token.set(token);
  }

  // ── Face ID / Keychain session ──────────────────────────────────────────
  // These three methods are the ONLY thing that ever touches Keychain-backed
  // storage. They exist so a valid session can survive being *locked* without
  // sitting in plaintext localStorage while the app is backgrounded — Face ID
  // gates the app-level decision to ever call getBiometricSession() at all
  // (see LockScreenComponent), the Keychain entry itself is what actually
  // protects the data at rest.

  /** Copies a token into Keychain-backed storage. Call after login/signup and
   *  after every successful refresh WHILE Face ID is enabled, so the stored
   *  credential keeps rolling forward instead of going stale. */
  storeBiometricSession(token: string) {
    if (!Capacitor.isNativePlatform()) return;
    this.secure.set(BIOMETRIC_SESSION_KEY, token);
  }

  /** Retrieves the Keychain-stored session token, or null if none exists
   *  (covers: never enabled, cleared on logout/disable, or a stale entry
   *  already purged by the reinstall check above). */
  getBiometricSession(): Promise<string | null> {
    return this.secure.get(BIOMETRIC_SESSION_KEY);
  }

  /** Clears the Keychain-stored session. Call on explicit logout, on disabling
   *  Face ID, and after a password change — so a stolen/borrowed device can
   *  never use a stale biometric session to get back into an account after
   *  any of those events. */
  clearBiometricSession() {
    if (!Capacitor.isNativePlatform()) return;
    this.secure.remove(BIOMETRIC_SESSION_KEY);
  }

  /**
   * Clear all auth state and return the user to the single login screen.
   * Pass reason='expired' to show "Your session expired. Please log in again."
   */
  logout(reason?: 'expired') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('clarity_survey_seen');
    localStorage.removeItem('clarity_survey_done');
    localStorage.removeItem('clarity_celebrated');
    this._token.set(null);
    this._user.set(null);
    this.clearBiometricSession();
    clearHttpCaches();
    this.router.navigate(['/login'], reason ? { queryParams: { reason } } : undefined);
  }

  private store(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
    // Isolate device-local financial data per account: migrate any legacy global
    // keys into this user's namespace (and delete the global copy) so a second
    // account on the same browser/app can never read the first account's values.
    migrateGlobalKeys(LEGACY_DEVICE_FINANCIAL_KEYS, res.user.id);
    // Defense in depth against any stale service-worker-cached API response from
    // a previous account on this device (see clearHttpCaches for the full story).
    clearHttpCaches();
    // Keep the Keychain-stored Face ID session rolling forward on every fresh
    // token (login/signup/refresh) so it doesn't silently go stale between
    // opens — only if the user actually has Face ID turned on.
    if (Capacitor.isNativePlatform() && localStorage.getItem(FACE_ID_KEY) === '1') {
      this.storeBiometricSession(res.token);
    }
  }
}

/**
 * Clears the browser's Cache Storage (used by the Angular service worker for any
 * cached HTTP responses). This is NOT the same as localStorage/sessionStorage —
 * it's a separate cache that previously kept per-user API responses (e.g.
 * /api/accounts) keyed only by URL, with no awareness of which account made the
 * request. On a shared device, that meant a second account could see the first
 * account's cached financial data if the network was slow enough to trigger the
 * service worker's cache fallback. The dataGroups config that caused this has
 * been removed (see ngsw-config.json), but this clears out any already-cached
 * entries on affected devices immediately rather than waiting on the service
 * worker's own update cycle, and remains as a safety net going forward.
 */
function clearHttpCaches() {
  if (typeof caches === 'undefined') return;
  caches.keys().then(names => names.forEach(name => caches.delete(name))).catch(() => {});
}
