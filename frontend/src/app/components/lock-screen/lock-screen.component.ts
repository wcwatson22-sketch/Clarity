import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { LockService } from '../../services/lock.service';
import { AuthResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';

/**
 * App-only biometric gate (Face ID / Touch ID).
 *
 * This is NOT a login screen and never collects a password. It only appears on
 * native when the user has previously logged in with username/password AND
 * enabled Face ID. Its sole job is to restore a valid saved session:
 *
 *   - Face ID success + valid session  → unlock, go to dashboard
 *   - Face ID success + expired session → clear auth, go to /login ("session expired")
 *   - Face ID fail / cancel            → clear auth, go to /login
 *   - Face ID not enabled / unavailable → just let the saved session through
 *
 * Username/password is only ever entered on the main /login screen.
 */
@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lock-screen.component.html',
  styleUrl:    './lock-screen.component.scss',
})
export class LockScreenComponent implements OnInit {
  private auth   = inject(AuthService);
  readonly lock  = inject(LockService);
  private router = inject(Router);
  private http   = inject(HttpClient);
  private base   = environment.apiUrl;

  loading = signal(true);

  async ngOnInit() {
    // Lock screen only exists on native; web never reaches here.
    if (!Capacitor.isNativePlatform()) {
      this.lock.unlock();
      return;
    }

    // Face ID not enabled → don't gate. The valid saved session carries the user in.
    if (!this.lock.faceIdEnabled()) {
      this.lock.unlock();
      return;
    }

    const avail = await this.checkBiometric();
    if (!avail) {
      // User enabled Face ID but it's now unavailable (e.g. turned off in iOS).
      // Per policy, fall back to the main login screen — never a password unlock here.
      this.toLogin();
      return;
    }

    await this.tryBiometric();
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

  async tryBiometric() {
    this.loading.set(true);
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate({
        reason: 'Unlock Clarity to access your finances.',
        cancelTitle: 'Use Password',
        iosFallbackTitle: 'Use Password',
      });

      // Biometric passed — validate/refresh the saved session.
      try {
        const res = await firstValueFrom(
          this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {})
        );
        this.auth.storeAuth(res);
        this.lock.unlock();
        this.navigateAfterUnlock();
      } catch {
        // Saved session expired/invalid → clear it and send to the main login screen.
        this.toLogin('expired');
      }
    } catch {
      // Face ID failed or was canceled → main login screen (no password unlock screen).
      this.toLogin();
    }
  }

  /** Clear auth state, drop the lock, and route to the single login screen. */
  private toLogin(reason?: 'expired') {
    this.lock.unlock();          // hide this gate so it can't trap the user
    this.auth.logout(reason);    // clears token/user and navigates to /login
  }

  private navigateAfterUnlock() {
    const url = this.router.url;
    if (url === '/login' || url === '/' || url === '') {
      this.router.navigate(['/dashboard']);
    }
  }
}
