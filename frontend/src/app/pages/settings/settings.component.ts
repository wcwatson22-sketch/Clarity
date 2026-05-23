import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { MeResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private auth   = inject(AuthService);
  private http   = inject(HttpClient);
  private toast  = inject(ToastService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private base   = environment.apiUrl;

  readonly push = inject(PushNotificationService);

  user = computed(() => this.auth.currentUser());

  // Subscription state — isPaid comes from the server (StripeSubscriptionId != null)
  readonly isPaid      = computed(() => this.auth.currentUser()?.isPaid ?? false);
  readonly isBasePaid  = computed(() => this.isPaid() && this.auth.currentUser()?.tier === 'Base');
  readonly isPremium   = computed(() => this.isPaid() && this.auth.currentUser()?.tier === 'Premium');

  // Trial — only active when the user has NOT yet subscribed
  readonly trialEndsAt   = computed(() => { const t = this.auth.currentUser()?.trialEndsAt; return t ? new Date(t) : null; });
  readonly trialActive   = computed(() => { if (this.isPaid()) return false; const t = this.trialEndsAt(); return t ? t > new Date() : false; });
  readonly trialDaysLeft = computed(() => { const t = this.trialEndsAt(); if (!t) return 0; return Math.max(0, Math.ceil((t.getTime() - Date.now()) / 86400000)); });

  // Profile form
  firstName = signal(this.auth.currentUser()?.firstName ?? '');
  email     = signal(this.auth.currentUser()?.email ?? '');
  state     = signal(this.auth.currentUser()?.state ?? '');
  city      = signal(this.auth.currentUser()?.city ?? '');
  age       = signal(String(this.auth.currentUser()?.age ?? ''));

  profileSaving  = signal(false);
  profileSuccess = signal('');
  profileError   = signal('');

  // Password form
  currentPw  = signal('');
  newPw      = signal('');
  confirmPw  = signal('');

  pwSaving  = signal(false);
  pwSuccess = signal('');
  pwError   = signal('');

  // Subscription / upgrade / cancel
  upgrading      = signal(false);
  upgradeError   = signal('');
  upgradeSuccess = signal('');
  cancelling     = signal(false);
  showCancelConfirm = signal(false);

  // Display preferences
  expandDefault = signal(localStorage.getItem('clarity-expand-default') === 'true');

  // Help & Feedback
  helpMessage = '';
  submitHelp() {
    const msg  = this.helpMessage.trim();
    const user = this.auth.currentUser()?.username ?? 'User';
    const subj = encodeURIComponent(`Clarity App Feedback — ${user}`);
    const body = encodeURIComponent(msg);
    window.open(`mailto:clarityfinancialtools@gmail.com?subject=${subj}&body=${body}`, '_blank');
    this.helpMessage = '';
  }

  toggleExpandDefault() {
    const next = !this.expandDefault();
    this.expandDefault.set(next);
    localStorage.setItem('clarity-expand-default', String(next));
    // Clear saved states so the new default applies on next visit
    localStorage.removeItem('clarity-cat-dash');
    localStorage.removeItem('clarity-cat-cf');
  }

  // Account deletion
  showDeleteConfirm  = signal(false);
  deleteConfirmText  = signal('');
  deleting           = signal(false);
  deleteError        = signal('');
  readonly deleteReady = computed(() => this.deleteConfirmText().trim().toUpperCase() === 'DELETE');

  readonly US_STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming','District of Columbia'
  ];

  ngOnInit() {
    // Sync push notification status
    this.push.syncStatus();

    // Handle return from Stripe Checkout
    this.route.queryParams.subscribe(params => {
      if (params['upgraded'] === 'true') {
        // Re-fetch user to pick up new tier + isPaid flag
        this.http.get<MeResponse>(`${this.base}/auth/me`).subscribe({
          next: user => {
            this.auth.updateCachedUser(user);
            if (user.tier === 'Premium') {
              this.upgradeSuccess.set('Welcome to Premium! Unlimited snapshots and more are now unlocked.');
              this.toast.success('🎉 Upgraded to Premium!');
            } else if (user.isPaid) {
              this.upgradeSuccess.set('Welcome to the Base plan! Your subscription is now active.');
              this.toast.success('🎉 Subscribed to Base plan!');
            }
          }
        });
      } else if (params['upgraded'] === 'false') {
        this.upgradeError.set('Checkout was cancelled. You can upgrade any time.');
      }
    });
  }

  startUpgrade(plan: 'base' | 'premium' = 'premium') {
    this.upgradeError.set('');
    this.upgrading.set(true);
    this.http.post<{ url?: string; devMode?: boolean; mockUpgradeUrl?: string; message?: string }>(
      `${this.base}/payments/create-checkout`, { plan }
    ).subscribe({
      next: res => {
        this.upgrading.set(false);
        if (res.url) {
          // Real Stripe checkout
          window.location.href = res.url;
        } else if (res.devMode && res.mockUpgradeUrl) {
          // Dev mode: show message and use dev-upgrade endpoint
          this.toast.info('Stripe not configured — using dev upgrade.');
          this.http.post<{ tier: string }>(`${this.base}/payments/dev-upgrade`, {}).subscribe({
            next: upgraded => {
              this.http.get<MeResponse>(`${this.base}/auth/me`).subscribe(me => {
                this.auth.updateCachedUser(me);
                this.upgradeSuccess.set('Upgraded to Premium (dev mode). No Stripe key required in development.');
                this.toast.success('Upgraded to Premium (dev mode)!');
              });
            },
            error: () => this.upgradeError.set('Dev upgrade failed.')
          });
        }
      },
      error: err => {
        this.upgrading.set(false);
        const msg = err.error?.error ?? 'Could not start checkout. Please try again.';
        this.upgradeError.set(msg);
        this.toast.error(msg);
      }
    });
  }

  cancelSubscription() {
    this.cancelling.set(true);
    this.showCancelConfirm.set(false);
    this.http.delete<{ message: string; tier: string }>(`${this.base}/payments/subscription`).subscribe({
      next: res => {
        this.cancelling.set(false);
        this.http.get<MeResponse>(`${this.base}/auth/me`).subscribe(me => {
          this.auth.updateCachedUser(me);
        });
        this.toast.success('Subscription cancelled. You\'ve been moved to the Base plan.');
        this.upgradeSuccess.set('');
        this.upgradeError.set('Your subscription has been cancelled. A confirmation email has been sent.');
      },
      error: err => {
        this.cancelling.set(false);
        const msg = err.error?.error ?? 'Could not cancel subscription. Please try again.';
        this.toast.error(msg);
        this.upgradeError.set(msg);
      }
    });
  }

  saveProfile() {
    this.profileError.set('');
    this.profileSuccess.set('');
    const ageNum = parseInt(this.age(), 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      this.profileError.set('Age must be between 18 and 120.'); return;
    }
    if (!this.email().includes('@')) {
      this.profileError.set('Please enter a valid email address.'); return;
    }
    this.profileSaving.set(true);
    this.http.put<MeResponse>(`${this.base}/profile`, {
      firstName: this.firstName(), email: this.email(), state: this.state(), city: this.city(), age: ageNum
    }).subscribe({
      next: (updated) => {
        this.auth.updateCachedUser(updated);
        this.profileSaving.set(false);
        this.profileSuccess.set('Profile updated successfully.');
        this.toast.success('Profile updated successfully.');
        setTimeout(() => this.profileSuccess.set(''), 3000);
      },
      error: (err) => {
        this.profileSaving.set(false);
        const msg = err.error?.error ?? 'Failed to update profile.';
        this.profileError.set(msg);
        this.toast.error(msg);
      }
    });
  }

  changePassword() {
    this.pwError.set('');
    this.pwSuccess.set('');
    if (!this.currentPw()) { this.pwError.set('Enter your current password.'); return; }
    if (this.newPw().length < 6) { this.pwError.set('New password must be at least 6 characters.'); return; }
    if (this.newPw() !== this.confirmPw()) { this.pwError.set('Passwords do not match.'); return; }
    this.pwSaving.set(true);
    this.http.post(`${this.base}/profile/change-password`, {
      currentPassword: this.currentPw(), newPassword: this.newPw()
    }).subscribe({
      next: () => {
        this.pwSaving.set(false);
        this.pwSuccess.set('Password changed successfully.');
        this.toast.success('Password changed successfully.');
        this.currentPw.set(''); this.newPw.set(''); this.confirmPw.set('');
        setTimeout(() => this.pwSuccess.set(''), 3000);
      },
      error: (err) => {
        this.pwSaving.set(false);
        const msg = err.error?.error ?? 'Failed to change password.';
        this.pwError.set(msg);
        this.toast.error(msg);
      }
    });
  }

  async enableNotifications() {
    const ok = await this.push.enable();
    if (ok) this.toast.success('Notifications enabled!');
    else if (this.push.permission() === 'denied')
      this.toast.error('Notifications blocked in browser settings. Please enable them manually.');
    else
      this.toast.error('Could not enable notifications. Try again.');
  }

  async disableNotifications() {
    await this.push.disable();
    this.toast.success('Notifications disabled.');
  }

  deleteAccount() {
    if (!this.deleteReady()) return;
    this.deleting.set(true);
    this.deleteError.set('');
    this.http.delete(`${this.base}/profile/me`).subscribe({
      next: () => {
        this.auth.logout(); // clears local storage and navigates to /login
      },
      error: (err) => {
        this.deleting.set(false);
        const msg = err.error?.error ?? 'Could not delete account. Please try again.';
        this.deleteError.set(msg);
        this.toast.error(msg);
      }
    });
  }
}
