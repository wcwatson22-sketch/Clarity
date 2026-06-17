import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd, Router } from '@angular/router';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { SwUpdate } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './services/auth.service';
import { PlanAccessService } from './services/plan-access.service';
import { LockService } from './services/lock.service';
import { PushNotificationService } from './services/push-notification.service';
import { ToastComponent } from './components/toast/toast.component';
import { OnboardingComponent } from './components/onboarding/onboarding.component';
import { ErrorBoundaryComponent } from './components/error-boundary/error-boundary.component';
import { TermsModalComponent } from './components/terms-modal/terms-modal.component';
import { InstallBannerComponent } from './components/install-banner/install-banner.component';
import { SplashComponent } from './components/splash/splash.component';
import { LockScreenComponent } from './components/lock-screen/lock-screen.component';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass, NgFor, NgIf, FormsModule, ToastComponent, OnboardingComponent, ErrorBoundaryComponent, TermsModalComponent, InstallBannerComponent, SplashComponent, LockScreenComponent],
  template: `
    @if (showSplash()) {
      <app-splash (done)="showSplash.set(false)" />
    }

    <!-- Lock screen — shown on every native app launch / foreground; never on web -->
    @if (lockSvc.locked() && auth.isLoggedIn() && !isAuthPage()) {
      <app-lock-screen />
    }

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
            <button class="help-btn" (click)="openHelp()" title="Help & Feedback">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </button>
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

      <!-- Help & Feedback modal -->
      @if (showHelpModal()) {
        <div class="help-overlay" (click)="closeHelp()">
          <div class="help-modal" (click)="$event.stopPropagation()">
            <div class="help-modal-header">
              <h3>Help & Feedback</h3>
              <button class="help-close" (click)="closeHelp()">✕</button>
            </div>

            @if (helpSent()) {
              <!-- Success state -->
              <div class="help-success">
                <span class="help-success-icon">✓</span>
                <p>Thanks — your message was sent.</p>
              </div>
            } @else {
              <p class="help-subtitle">Have a question or found a bug? Send us a message and we'll get back to you.</p>
              <textarea
                class="help-textarea"
                placeholder="Describe your question or issue..."
                [(ngModel)]="helpMessage"
                rows="5">
              </textarea>
              @if (helpError()) {
                <p class="help-error">{{ helpError() }}</p>
              }
              <div class="help-actions">
                <button class="help-cancel" (click)="closeHelp()">Cancel</button>
                <button class="help-send" (click)="submitHelp()"
                  [disabled]="!helpMessage().trim() || helpSubmitting()">
                  @if (helpSubmitting()) { Sending… } @else { Send }
                </button>
              </div>
            }

          </div>
        </div>
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
        <!-- Bottom nav (mobile) — 4 primary free tabs + Premium Tools -->
        <nav class="bottom-nav">
          <a *ngFor="let item of primaryNavItems" [routerLink]="item.path" routerLinkActive="bottom-active" class="bottom-item">
            <span class="nav-icon" [innerHTML]="item.icon"></span>
            <span class="bottom-label">{{ item.label }}</span>
          </a>
          <button class="bottom-item more-tab" [class.bottom-active]="moreActive()" (click)="showMoreSheet.set(true)">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3l2.09 4.26L18.8 8l-3.4 3.32.8 4.68L12 13.77 7.8 16l.8-4.68L5.2 8l4.71-.74L12 3z"/>
              </svg>
            </span>
            <span class="bottom-label">Premium</span>
          </button>
        </nav>

        <!-- Premium Tools bottom sheet (mobile) -->
        @if (showMoreSheet()) {
          <div class="more-backdrop" (click)="showMoreSheet.set(false)">
            <div class="more-sheet" (click)="$event.stopPropagation()">
              <div class="more-handle"></div>
              <h3 class="more-title">Premium Tools @if (!plan.isPremium()) { <span class="more-lock">🔒 $2.99/mo</span> }</h3>
              <div class="more-grid">
                @for (item of moreNavItems; track item.path) {
                  <a class="more-cell" [routerLink]="item.path" routerLinkActive="more-cell-active" (click)="showMoreSheet.set(false)">
                    <span class="more-cell-icon" [innerHTML]="item.icon"></span>
                    <span class="more-cell-label">{{ item.label }}</span>
                  </a>
                }
                @if (isAdmin()) {
                  <a class="more-cell" routerLink="/admin" routerLinkActive="more-cell-active" (click)="showMoreSheet.set(false)">
                    <span class="more-cell-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
                    <span class="more-cell-label">Admin</span>
                  </a>
                }
                <button class="more-cell" (click)="showMoreSheet.set(false); openHelp()">
                  <span class="more-cell-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
                  <span class="more-cell-label">Support</span>
                </button>
              </div>
            </div>
          </div>
        }
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

      <!-- Face ID / Touch ID opt-in prompt (native only, shown once after first login) -->
      @if (showFaceIdPrompt()) {
        <div class="faceid-backdrop" (click)="dismissFaceIdPrompt()">
          <div class="faceid-sheet" (click)="$event.stopPropagation()">
            <div class="faceid-icon">🔐</div>
            <h3 class="faceid-title">Want Faster Access?</h3>
            <p class="faceid-body">
              You can enable Face ID or Touch ID in <strong>Settings</strong> to unlock Clarity instantly — no password needed.
            </p>
            <div class="faceid-actions">
              <a routerLink="/settings" class="faceid-btn-settings" (click)="dismissFaceIdPrompt()">Open Settings</a>
              <button class="faceid-btn-dismiss" (click)="dismissFaceIdPrompt()">Maybe Later</button>
            </div>
          </div>
        </div>
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
    .nav-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; min-height: 0; }
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
    .help-btn {
      border: 1px solid #E5E7EB; background: none;
      border-radius: 8px; padding: 6px;
      color: #9CA3AF; cursor: pointer;
      display: flex; align-items: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .help-btn:hover { background: #EFF6FF; border-color: #BFDBFE; color: #2563EB; }

    /* Help modal */
    .help-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
      padding: 20px;
    }
    .help-modal {
      background: #fff;
      border-radius: 16px;
      padding: 24px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    .help-modal-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .help-modal-header h3 { margin: 0; font-size: 17px; font-weight: 700; color: #111827; }
    .help-close {
      background: none; border: none; font-size: 16px;
      color: #9CA3AF; cursor: pointer; padding: 2px 6px;
      border-radius: 6px;
      &:hover { background: #F3F4F6; color: #374151; }
    }
    .help-subtitle { margin: 0 0 16px; font-size: 13px; color: #6B7280; line-height: 1.5; }
    .help-success {
      display: flex; align-items: center; gap: 12px;
      background: #F0FDF4; border: 1px solid #BBF7D0;
      border-radius: 10px; padding: 18px 16px;
      margin: 4px 0 8px;
    }
    .help-success-icon {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1D9E75; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; flex-shrink: 0;
    }
    .help-success p { margin: 0; font-size: 14px; font-weight: 500; color: #065F46; }
    .help-error {
      margin: 6px 0 0; font-size: 12.5px; color: #B91C1C;
      background: #FEF2F2; border: 1px solid #FECACA;
      border-radius: 8px; padding: 8px 12px;
    }
    .help-textarea {
      width: 100%; box-sizing: border-box;
      border: 1px solid #E5E7EB; border-radius: 10px;
      padding: 12px; font-size: 14px; font-family: inherit;
      resize: vertical; outline: none; color: #111827;
      &:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.1); }
    }
    .help-actions {
      display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px;
    }
    .help-cancel {
      background: #F3F4F6; border: none; border-radius: 10px;
      padding: 10px 18px; font-size: 14px; font-weight: 500;
      color: #374151; cursor: pointer;
      &:hover { background: #E5E7EB; }
    }
    .help-send {
      background: #1D9E75; border: none; border-radius: 10px;
      padding: 10px 20px; font-size: 14px; font-weight: 600;
      color: #fff; cursor: pointer;
      transition: background 0.15s;
      &:hover:not(:disabled) { background: #158060; }
      &:disabled { opacity: 0.45; cursor: not-allowed; }
    }

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
      padding: 6px 0;
      z-index: 300;       /* always above page content */
    }
    .bottom-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 2px;
      color: #9CA3AF; text-decoration: none;
      padding: 4px 0;
      transition: color 0.15s;
      min-width: 0;
    }
    .bottom-active { color: #1D9E75 !important; }
    .bottom-label { font-size: 10px; font-weight: 500; }
    .more-tab {
      background: none; border: none; cursor: pointer;
      font-family: inherit; color: #9CA3AF;
    }

    /* More bottom sheet */
    .more-backdrop {
      position: fixed; inset: 0; z-index: 700;
      background: rgba(0,0,0,0.4);
      display: flex; align-items: flex-end; justify-content: center;
      animation: backdrop-in 0.2s ease;
    }
    @keyframes backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    .more-sheet {
      background: #fff; width: 100%; max-width: 520px;
      border-radius: 20px 20px 0 0; padding: 10px 18px 28px;
      animation: sheet-up 0.26s cubic-bezier(0.32,0.72,0,1);
      padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
    }
    @keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .more-handle { width: 36px; height: 4px; background: #E5E7EB; border-radius: 2px; margin: 0 auto 14px; }
    .more-title { font-size: 13px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 14px; }
    .more-lock { font-size: 11px; font-weight: 600; color: #1D9E75; text-transform: none; letter-spacing: 0; margin-left: 6px; }
    .more-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .more-cell {
      display: flex; flex-direction: column; align-items: center; gap: 7px;
      padding: 16px 8px; border-radius: 14px;
      background: #F9FAFB; border: 1px solid #E5E7EB;
      color: #374151; text-decoration: none; cursor: pointer;
      font-family: inherit; transition: background 0.15s, border-color 0.15s;
    }
    .more-cell:hover { background: #F0FBF7; border-color: #A7F3D0; }
    .more-cell-active { background: #E1F5EE; border-color: #1D9E75; color: #1D9E75; }
    .more-cell-icon { display: flex; align-items: center; justify-content: center; }
    .more-cell-label { font-size: 11.5px; font-weight: 600; text-align: center; line-height: 1.2; }

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

    /* Face ID opt-in prompt (bottom sheet style) */
    .faceid-backdrop {
      position: fixed; inset: 0; z-index: 2500;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: flex-end; justify-content: center;
    }
    .faceid-sheet {
      background: #fff; border-radius: 24px 24px 0 0;
      padding: 32px 28px 40px; width: 100%; max-width: 480px;
      text-align: center;
      animation: sheetUp 0.3s cubic-bezier(0.32,0.72,0,1);
    }
    @keyframes sheetUp {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .faceid-icon  { font-size: 48px; display: block; margin-bottom: 12px; }
    .faceid-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 10px; }
    .faceid-body  { font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0 0 24px; }
    .faceid-body strong { color: #111827; }
    .faceid-actions { display: flex; flex-direction: column; gap: 10px; }
    .faceid-btn-settings {
      background: #1D9E75; color: #fff;
      border: none; border-radius: 12px;
      padding: 14px; font-size: 15px; font-weight: 600;
      text-decoration: none; display: block;
      transition: background 0.15s;
      &:hover { background: #085041; }
    }
    .faceid-btn-dismiss {
      background: none; border: none;
      color: #9CA3AF; font-size: 14px; cursor: pointer;
      &:hover { color: #6B7280; }
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      /* 12px top/sides, 80px bottom clears the fixed bottom nav */
      .main-content { margin-left: 0; padding: 12px 12px 80px; overflow-x: hidden; max-width: 100vw; }
      .main-content.full-width { padding: 0; }
      .bottom-nav { display: flex; }
    }

    /* Safe-area insets for notched / Dynamic Island phones */
    @supports (padding-top: env(safe-area-inset-top)) {
      @media (max-width: 768px) {
        .main-content {
          padding-top: calc(12px + env(safe-area-inset-top));
          padding-bottom: calc(80px + env(safe-area-inset-bottom));
        }
        .bottom-nav {
          padding-bottom: env(safe-area-inset-bottom);
          /* ensure knob stays within screen height */
          height: calc(56px + env(safe-area-inset-bottom));
          align-items: flex-start;
        }
      }
    }
  `]
})
export class AppComponent {
  private sanitizer = inject(DomSanitizer);
  readonly auth     = inject(AuthService);
  readonly plan     = inject(PlanAccessService);
  readonly lockSvc  = inject(LockService);
  private push      = inject(PushNotificationService);
  private router    = inject(Router);
  private http      = inject(HttpClient);
  private swUpdate  = inject(SwUpdate, { optional: true });
  private base      = environment.apiUrl;

  readonly currentUser = this.auth.currentUser;

  // Expose auth.isLoggedIn for template
  readonly isLoggedIn = this.auth.isLoggedIn;

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

  onOnboardingDone() {
    this._onboardingDismissed.set(true);
    // After onboarding completes, show Face ID prompt on native if not already prompted
    if (Capacitor.isNativePlatform() && !this.lockSvc.faceIdEnabled() &&
        !localStorage.getItem('clarity_faceid_prompted')) {
      setTimeout(() => this.showFaceIdPrompt.set(true), 600);
    }
  }

  /** Show Face ID prompt to returning native users who haven't seen it yet.
   *  Called after data loads so we don't interrupt the auth flow. */
  maybeShowFaceIdPrompt() {
    if (Capacitor.isNativePlatform() &&
        !this.lockSvc.faceIdEnabled() &&
        !localStorage.getItem('clarity_faceid_prompted') &&
        this.auth.isLoggedIn() &&
        !this.isAuthPage() &&
        this.currentUser()?.hasSeenOnboarding === true) {
      setTimeout(() => this.showFaceIdPrompt.set(true), 1200);
    }
  }

  // ── Face ID prompt ────────────────────────────────────────────────────────
  showFaceIdPrompt = signal(false);
  dismissFaceIdPrompt() {
    this.showFaceIdPrompt.set(false);
    localStorage.setItem('clarity_faceid_prompted', '1');
  }

  logout() { this.auth.logout(); }

  // Splash screen — only on native Capacitor (iOS/Android), not web
  showSplash = signal(Capacitor.isNativePlatform());

  // Help & Feedback modal
  showHelpModal  = signal(false);
  helpMessage    = signal('');
  helpSubmitting = signal(false);
  helpSent       = signal(false);
  helpError      = signal('');

  openHelp() {
    this.helpSent.set(false);
    this.helpError.set('');
    this.showHelpModal.set(true);
  }

  closeHelp() {
    this.showHelpModal.set(false);
    // Reset after modal closes so next open starts fresh
    setTimeout(() => {
      this.helpMessage.set('');
      this.helpSent.set(false);
      this.helpError.set('');
      this.helpSubmitting.set(false);
    }, 250);
  }

  submitHelp() {
    const msg = this.helpMessage().trim();
    if (!msg || this.helpSubmitting()) return;

    this.helpSubmitting.set(true);
    this.helpError.set('');

    this.http.post(`${this.base}/support/message`, { message: msg }).subscribe({
      next: () => {
        this.helpSubmitting.set(false);
        this.helpSent.set(true);
        this.helpMessage.set('');
        // Auto-close after 2.5 s
        setTimeout(() => this.closeHelp(), 2500);
      },
      error: (err) => {
        this.helpSubmitting.set(false);
        const serverMsg = err?.error?.error;
        this.helpError.set(serverMsg ?? 'Something went wrong. Please try again.');
      }
    });
  }

  private _rawNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>` },
    { path: '/cash-flow', label: 'Cash Flow', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>` },
    { path: '/learn',     label: 'Learn',     icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>` },
    { path: '/compare',   label: 'Compare',   icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` },
    { path: '/loan-prep',   label: 'Loan Prep',  icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>` },
    { path: '/real-estate', label: 'Real Estate', icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
    { path: '/settings',  label: 'Settings',  icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` },
  ];

  navItems: { path: string; label: string; icon: SafeHtml }[] = [];

  // Mobile navigation: 4 primary bottom tabs + a "More" sheet for the rest.
  primaryNavItems: { path: string; label: string; icon: SafeHtml }[] = [];
  moreNavItems:    { path: string; label: string; icon: SafeHtml }[] = [];
  showMoreSheet = signal(false);

  /** Highlight the "Premium" tab when the current route is a Premium tool. */
  readonly moreActive = computed(() => {
    const url = this.currentUrl() ?? '';
    return ['/compare', '/loan-prep', '/real-estate', '/pfs', '/admin'].some(p => url.startsWith(p));
  });

  constructor() {
    this.navItems = this._rawNavItems.map(item => ({
      ...item,
      icon: this.sanitizer.bypassSecurityTrustHtml(item.icon)
    }));

    // Bottom bar: the four free tabs. The Premium button is appended in the template.
    const find = (p: string) => this.navItems.find(i => i.path === p)!;
    this.primaryNavItems = ['/dashboard', '/cash-flow', '/learn', '/settings'].map(find);

    // PFS isn't in the sidebar list — give it its own icon for the Premium sheet.
    const pfsIcon = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`
    );
    // Premium Tools sheet — the gated features. Each page shows its own upgrade
    // prompt for free users, so navigation is allowed; the tool itself gates.
    this.moreNavItems = [
      find('/compare'),
      find('/loan-prep'),
      find('/real-estate'),
      { path: '/pfs', label: 'PFS', icon: pfsIcon },
    ];

    // Refresh user data from server on every app load so emailVerified,
    // tier, trialEndsAt etc. are never served from a stale localStorage cache
    this.auth.refreshIfLoggedIn();

    // Show Face ID opt-in prompt to returning native users who have never seen it
    this.maybeShowFaceIdPrompt();

    // Slide the next push notification 7 days forward on every app open.
    // Active users (weekly openers) will never see the push because it keeps
    // getting rescheduled. Only users who miss 7+ days will receive it.
    this.push.rescheduleOnAppOpen();

    // On native: re-lock when the app goes to background so the lock screen
    // appears again every time the user returns to the foreground.
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) this.lockSvc.lock();
      });
    }

    // Auto-reload when a new service worker version is ready so users always
    // get the latest app without needing to manually clear cache or close tabs.
    if (this.swUpdate?.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter(e => e.type === 'VERSION_READY')
      ).subscribe(() => {
        this.swUpdate!.activateUpdate().then(() => document.location.reload());
      });
    }
  }
}
