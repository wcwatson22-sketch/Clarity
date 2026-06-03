import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { LockService } from '../../services/lock.service';
import { AuthResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lock-screen.component.html',
  styleUrl:    './lock-screen.component.scss',
})
export class LockScreenComponent implements OnInit {
  private auth   = inject(AuthService);
  readonly lock  = inject(LockService);
  private http   = inject(HttpClient);
  private router = inject(Router);
  private base   = environment.apiUrl;

  readonly username = computed(() => this.auth.currentUser()?.username ?? '');

  password       = signal('');
  error          = signal('');
  loading        = signal(false);
  biometricAvail = signal(false);
  showPassword   = signal(false);

  async ngOnInit() {
    if (!Capacitor.isNativePlatform()) {
      // Should not happen — lock screen only renders on native
      this.lock.unlock();
      return;
    }
    const avail = await this.checkBiometric();
    this.biometricAvail.set(avail);

    if (this.lock.faceIdEnabled() && avail) {
      // Attempt biometric automatically on lock screen open
      await this.tryBiometric(/*auto*/ true);
    } else {
      this.showPassword.set(true);
    }
  }

  private async checkBiometric(): Promise<boolean> {
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const result = await BiometricAuth.checkBiometry();
      return result.isAvailable;
    } catch {
      return false;
    }
  }

  async tryBiometric(auto = false) {
    this.error.set('');
    this.loading.set(true);
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate({
        reason: 'Unlock Clarity to access your finances.',
        cancelTitle: 'Use Password',
        iosFallbackTitle: 'Use Password',
      });
      // Biometric passed — refresh JWT to ensure API calls don't 401 if the
      // token expired while the app was locked/backgrounded.
      // NOTE: the auth interceptor is configured to NOT auto-logout on a 401
      // from /auth/refresh, so this catch block will actually run when expired.
      try {
        const res = await firstValueFrom(
          this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {})
        );
        this.auth.storeAuth(res);
        this.lock.unlock();
        this.navigateAfterUnlock();
      } catch {
        // JWT has expired — the token is still in localStorage (interceptor won't
        // auto-logout on /auth/refresh 401s), so the lock screen stays visible.
        // Show the password form so the user can re-authenticate once.
        this.loading.set(false);
        this.showPassword.set(true);
        this.error.set('Your session has expired. Enter your password once to restore access.');
      }
    } catch {
      this.loading.set(false);
      this.showPassword.set(true);
      if (!auto) this.error.set('Biometric authentication failed. Enter your password.');
    }
  }

  unlockWithPassword() {
    const pw = this.password().trim();
    if (!pw || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    this.http.post<AuthResponse>(`${this.base}/auth/login`, {
      username: this.username(),
      password: pw,
    }).subscribe({
      next: res => {
        this.auth.storeAuth(res);
        this.lock.unlock();
        this.navigateAfterUnlock();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Incorrect password. Please try again.');
      },
    });
  }

  onPasswordKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.unlockWithPassword();
  }

  /**
   * After a successful unlock (biometric or password), ensure the user lands on
   * the dashboard. This is a safety net for the edge case where the router ended
   * up on /login (e.g. from a previous navigation before the lock screen appeared).
   * Under normal operation the router is already on /dashboard, so this is a no-op.
   */
  private navigateAfterUnlock() {
    const url = this.router.url;
    if (url === '/login' || url === '/' || url === '') {
      this.router.navigate(['/dashboard']);
    }
  }
}
