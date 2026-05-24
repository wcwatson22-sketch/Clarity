import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, MeResponse, SignupRequest } from '../models/auth.models';

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

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('clarity_survey_seen');
    localStorage.removeItem('clarity_survey_done');
    localStorage.removeItem('clarity_celebrated');
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  private store(res: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this._token.set(res.token);
    this._user.set(res.user);
  }
}
