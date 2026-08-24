import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, MeResponse, SignupRequest } from '../models/auth.models';
import { migrateGlobalKeys, LEGACY_DEVICE_FINANCIAL_KEYS } from './scoped-storage';

const TOKEN_KEY = 'clarity_token';
const USER_KEY  = 'clarity_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  private base   = `${environment.apiUrl}/auth`;

  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private _user  = signal<MeResponse | null>(
    JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
  );

  readonly isLoggedIn  = computed(() => !!this._token());
  readonly currentUser = computed(() => this._user());
  readonly token       = computed(() => this._token());
  readonly isPremium   = computed(() => this._user()?.tier === 'Premium');

  /** Called once on app init — issues a fresh JWT + refreshes user data.
   *  Ensures the token always carries the correct claims (isAdmin, tier, etc.)
   *  so that admin endpoints and feature gates work without requiring a re-login. */
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
