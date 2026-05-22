import { Component, inject, computed, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './services/auth.service';
import { ToastComponent } from './components/toast/toast.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { ErrorBoundaryComponent } from './components/error-boundary/error-boundary.component';
import { TermsModalComponent } from './components/terms-modal/terms-modal.component';
import { InstallBannerComponent } from './components/install-banner/install-banner.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass, NgFor, NgIf, ToastComponent, OnboardingComponent, ErrorBoundaryComponent, TermsModalComponent, InstallBannerComponent],
  template: `
    <div class="app-shell" [class.auth-layout]="isAuthPage()">

      @if (!isAuthPage()) {
        <!-- Sidebar nav (desktop) -->
        <nav class="sidebar">
          <div class="sidebar-brand">
            <img src="icons/logo.png" alt="Clarity" class="brand-logo" />
          </div>
          <ul class="nav-list">
            <li *ngFor="let item of navItems" class="nav-item">
              <a [routerLink]="item.path" routerLinkActive="nav-active" class="nav-link">
                <span class="nav-icon" [innerHTML]="item.icon"></span>
                <span>{{ item.label }}</span>
              </a>
            </li>

            <!-- Admin link — only rendered for isAdmin() === true -->
            @if (isAdmin()) {
              <li class="nav-item">
                <a routerLink="/admin" routerLinkActive="nav-active" class="nav-link nav-admin">
                  <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
                  <span>Admin</span>
                </a>
              </li>
            }
          </ul>

          <!-- Trial countdown -->
          @if (trialDaysLeft() !== null) {
            <a routerLink="/settings" class="trial-chip" [class.trial-urgent]="trialDaysLeft()! <= 7">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {{ trialDaysLeft() }} day{{ trialDaysLeft() === 1 ? '' : 's' }} left in trial
            </a>
          }

          <!-- Disclaimer -->
          <div class="sidebar-disclaimer">
            Clarity is an educational tool only. Not financial advice.
          </div>

          <!-- User footer -->
          <div class="sidebar-footer">
            <div class="user-info">
              <div class="user-avatar">{{ userInitial() }}</div>
              <div class="user-meta">
                <span class="user-name">{{ currentUser()?.username }}</span>
                <span class="user-id">ID #{{ currentUser()?.id }}</span>
              </div>
            </div>
            <button class="logout-btn" (click)="logout()" title="Sign out">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </nav>
      }

      <!-- Main content -->
      <main class="main-content" [class.full-width]="isAuthPage()">
        @if (!isAuthPage() && showVerifyBanner()) {
          <div class="verify-banner">
            <span>📧</span>
            <span>Please verify your email address to unlock all features.
              <button class="resend-btn" (click)="resendVerification()" [disabled]="resendSent()">
                {{ resendSent() ? 'Email sent!' : 'Resend email' }}
              </button>
            </span>
            <button class="banner-close" (click)="dismissVerifyBanner()" aria-label="Dismiss">✕</button>
          </div>
        }
        <router-outlet />
      </main>

      @if (!isAuthPage()) {
        <!-- Bottom nav (mobile) -->
        <nav class="bottom-nav">
          <a *ngFor="let item of navItems" [routerLink]="item.path" routerLinkActive="bottom-active" class="bottom-item">
            <span class="nav-icon" [innerHTML]="item.icon"></span>
            <span class="bottom-label">{{ item.label }}</span>
          </a>
        </nav>
      }

      <!-- Install to home screen banner (mobile only) -->
      @if (!isAuthPage()) {
        <app-install-banner />
      }

      <!-- Global toast notifications -->
      <app-toast />

      <!-- Global error boundary -->
      <app-error-boundary />

      <!-- Terms acceptance modal — shown to existing users who haven't accepted yet -->
      @if (showTermsModal()) {
        <app-terms-modal (accepted)="onTermsAccepted()" />
      }

      <!-- First-login onboarding walkthrough -->
      @if (showOnboarding()) {
        <app-onboarding (done)="onOnboardingDone()" />
      }
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      min-height: 100vh;
      background: #F9FAFB;
    }
    .app-shell.auth-layout {
      display: block;
    }

    /* Sidebar */
    .sidebar {
      width: 220px;
      background: #fff;
      border-right: 1px solid #E5E7EB;
      display: flex;
      flex-direction: column;
      padding: 24px 16px 16px;
      position: fixed;
      top: 0; left: 0; bottom: 0;
    }
    .sidebar-brand {
      display: flex;
      align-items: center;
      padding: 0 4px 28px;
    }
    .brand-logo {
      width: 140px;
      height: auto;
      display: block;
    }
    .nav-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .nav-link {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 10px;
      color: #6B7280; text-decoration: none; font-size: 14px; font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .nav-link:hover { background: #F3F4F6; color: #111827; }
    .nav-active { background: #E1F5EE !important; color: #1D9E75 !important; }
    .nav-admin { color: #D97706 !important; &.nav-active { background: #FEF3C7 !important; color: #D97706 !important; } }
    .nav-icon { display: flex; align-items: center; }

    /* User footer */
    .sidebar-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 8px 4px;
      border-top: 1px solid #F3F4F6;
      margin-top: 12px;
    }
    .user-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .user-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #E1F5EE;
      color: #085041;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
      flex-shrink: 0;
    }
    .user-meta { display: flex; flex-direction: column; min-width: 0; }
    .user-name { font-size: 13px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-id { font-size: 11px; color: #9CA3AF; }
    .logout-btn {
      border: 1px solid #E5E7EB; background: none;
      border-radius: 8px; padding: 6px;
      color: #9CA3AF; cursor: pointer;
      display: flex; align-items: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .logout-btn:hover { background: #FEF2F2; border-color: #FECACA; color: #B91C1C; }

    /* Disclaimer */
    .sidebar-disclaimer {
      font-size: 10px;
      color: #D1D5DB;
      text-align: center;
      padding: 6px 8px;
      line-height: 1.4;
    }

    /* Trial countdown chip */
    .trial-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      color: #92400E;
      font-size: 11px;
      font-weight: 600;
      padding: 7px 12px;
      border-radius: 10px;
      margin: 0 0 8px;
      text-decoration: none;
      transition: background 0.15s;
      &:hover { background: #FEF3C7; }
    }
    .trial-urgent {
      background: #FEF2F2;
      border-color: #FECACA;
      color: #991B1B;
      &:hover { background: #FEE2E2; }
    }

    /* Main */
    .main-content {
      flex: 1;
      margin-left: 220px;
      padding: 32px;
      max-width: 100%;
    }
    .main-content.full-width {
      margin-left: 0;
      padding: 0;
    }

    /* Bottom nav (mobile only) */
    .bottom-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: #fff;
      border-top: 1px solid #E5E7EB;
      padding: 8px 0;
    }
    .bottom-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 3px;
      color: #9CA3AF; text-decoration: none; font-size: 11px;
      transition: color 0.15s;
    }
    .bottom-active { color: #1D9E75 !important; }
    .bottom-label { font-size: 10px; }

    /* Email verification banner */
    .verify-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 12px;
      padding: 11px 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: #92400E;
      line-height: 1.4;
    }
    .resend-btn {
      background: none;
      border: none;
      color: #D97706;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      padding: 0;
      margin-left: 6px;
      text-decoration: underline;
      text-underline-offset: 2px;
      &:disabled { opacity: 0.55; cursor: not-allowed; }
    }
    .banner-close {
      margin-left: auto;
      background: none;
      border: none;
      color: #B45309;
      cursor: pointer;
      font-size: 13px;
      padding: 2px 4px;
      opacity: 0.65;
      flex-shrink: 0;
      &:hover { opacity: 1; }
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main-content { margin-left: 0; padding: 16px 14px 88px; }
      .main-content.full-width { padding: 0; }
      .bottom-nav { display: flex; }
    }

    /* Safe-area insets for notched / Dynamic Island phones */
    @supports (padding-top: env(safe-area-inset-top)) {
      @media (max-width: 768px) {
        .main-content {
          padding-top: calc(16px + env(safe-area-inset-top));
          padding-bottom: calc(88px + env(safe-area-inset-bottom));
        }
        .bottom-nav { padding-bottom: env(safe-area-inset-bottom); }
      }
    }
  `]
})
export class AppComponent {
  private sanitizer = inject(DomSanitizer);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private http      = inject(HttpClient);
  private base      = environment.apiUrl;

  readonly currentUser = this.auth.currentUser;

  readonly userInitial = computed(() => {
    const u = this.currentUser()?.username;
    return u ? u.charAt(0).toUpperCase() : '?';
  });

  // Track current route to hide shell on auth pages
  private currentUrl = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly trialDaysLeft = computed(() => {
    if (this.currentUser()?.isPaid) return null; // paid subscriber — hide trial chip
    const t = this.currentUser()?.trialEndsAt;
    if (!t) return null;
    const days = Math.ceil((new Date(t).getTime() - Date.now()) / 86400000);
    return days > 0 ? days : null;
  });

  readonly isAdmin = computed(() => this.auth.currentUser()?.isAdmin === true);

  readonly isAuthPage = computed(() => {
    const url = this.currentUrl() ?? '';
    return url.startsWith('/login') || url.startsWith('/signup') ||
           url.startsWith('/forgot-password') || url.startsWith('/forgot-username') ||
           url.startsWith('/reset-password') || url.startsWith('/verify-email');
  });

  // Onboarding — show only for new users who haven't seen it yet
  private _onboardingDismissed = signal(false);
  readonly showOnboarding = computed(() =>
    !this._onboardingDismissed() &&
    this.auth.isLoggedIn() &&
    !this.isAuthPage() &&
    this.currentUser()?.hasSeenOnboarding === false
  );

  // Terms acceptance — show modal for logged-in users who haven't accepted
  private _termsAccepted = signal(false);
  readonly showTermsModal = computed(() =>
    !this._termsAccepted() &&
    this.auth.isLoggedIn() &&
    !this.isAuthPage() &&
    this.currentUser()?.hasAcceptedTerms === false
  );

  onTermsAccepted() {
    this.http.post<import('./models/auth.models').MeResponse>(`${this.base}/auth/accept-terms`, {}).subscribe({
      next: updatedUser => {
        this.auth.updateCachedUser(updatedUser);
        this._termsAccepted.set(true);
      },
      error: () => {
        // Even if the API call fails, dismiss the modal — it will re-appear next session
        this._termsAccepted.set(true);
      }
    });
  }

  // Email verification banner
  private _bannerDismissed = signal(false);
  readonly showVerifyBanner = computed(() =>
    !this._bannerDismissed() &&
    this.auth.isLoggedIn() &&
    this.currentUser()?.emailVerified === false
  );
  readonly resendSent = signal(false);

  dismissVerifyBanner() { this._bannerDismissed.set(true); }

  resendVerification() {
    const user = this.currentUser();
    if (!user || this.resendSent()) return;
    this.http.post(`${environment.apiUrl}/auth/resend-verification`, {}).subscribe({
      next: () => {
        this.resendSent.set(true);
        setTimeout(() => this.resendSent.set(false), 60_000);
      },
      error: () => { /* silently ignore */ }
    });
  }

  onOnboardingDone() { this._onboardingDismissed.set(true); }
  logout() { this.auth.logout(); }

  private _rawNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>` },
    { path: '/cash-flow', label: 'Cash Flow', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
    { path: '/learn',     label: 'Learn',     icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>` },
    { path: '/compare',   label: 'Compare',   icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` },
    { path: '/settings',  label: 'Settings',  icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
  ];

  navItems: { path: string; label: string; icon: SafeHtml }[] = [];

  constructor() {
    this.navItems = this._rawNavItems.map(item => ({
      ...item,
      icon: this.sanitizer.bypassSecurityTrustHtml(item.icon)
    }));

    // Refresh user data from server on every app load so emailVerified,
    // tier, trialEndsAt etc. are never served from a stale localStorage cache
    this.auth.refreshIfLoggedIn();
  }
}
