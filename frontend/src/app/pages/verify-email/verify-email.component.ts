import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { MeResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <span class="brand-dot"></span>
          <span class="brand-name">Clarity</span>
        </div>
        @if (loading()) {
          <p class="auth-sub">Verifying your email…</p>
        } @else if (success()) {
          <div class="success-state">
            <span class="success-icon">✅</span>
            <h2 class="auth-title">Email verified!</h2>
            <p class="auth-sub">Your email address has been confirmed.</p>
            <a routerLink="/dashboard" class="auth-btn">Go to Dashboard</a>
          </div>
        } @else {
          <div class="error-state">
            <span class="err-icon">⚠️</span>
            <h2 class="auth-title">Verification failed</h2>
            <p class="auth-sub">{{ error() }}</p>
            <a routerLink="/login" class="auth-switch-link">Back to Sign In</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F9FAFB; padding: 24px; }
    .auth-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 20px; padding: 40px 36px; width: 100%; max-width: 420px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; }
    .auth-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; justify-content: center; }
    .brand-dot { width: 14px; height: 14px; border-radius: 50%; background: #1D9E75; }
    .brand-name { font-size: 18px; font-weight: 700; color: #111827; }
    .auth-title { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    .auth-sub { font-size: 14px; color: #6B7280; margin: 0 0 20px; }
    .success-state, .error-state { }
    .success-icon, .err-icon { font-size: 40px; display: block; margin-bottom: 16px; }
    .auth-btn { display: inline-block; background: #1D9E75; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .auth-switch-link { color: #1D9E75; font-size: 14px; font-weight: 600; }
  `]
})
export class VerifyEmailComponent implements OnInit {
  private http  = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private auth  = inject(AuthService);
  private base  = environment.apiUrl;

  loading = signal(true);
  success = signal(false);
  error   = signal('');

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) { this.loading.set(false); this.error.set('Missing verification token.'); return; }
    this.http.get(`${this.base}/auth/verify-email?token=${token}`).subscribe({
      next: () => {
        this.loading.set(false);
        this.success.set(true);
        // Refresh cached user so emailVerified flips to true — banner disappears immediately on dashboard
        if (this.auth.isLoggedIn()) {
          this.http.get<MeResponse>(`${this.base}/auth/me`).subscribe({
            next: me => this.auth.updateCachedUser(me),
            error: () => {} // non-fatal — banner will still hide after next login
          });
        }
      },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.error ?? 'Invalid or expired token.'); }
    });
  }
}
