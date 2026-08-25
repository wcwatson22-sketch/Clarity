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

      // Biometric passed. Retrieve the session credential from Keychain-backed
      // secure storage (NOT the plain-localStorage token — that copy still
      // exists for normal in-app API calls, but the Keychain copy is what
      // Face ID is actually meant to gate access to, per the security
      // requirement that this be a proper secure-storage-backed credential).
      const stored = await this.auth.getBiometricSession();
      if (!stored) {
        // Edge case: Face ID is enabled but no session was ever stored here —
        // e.g. Face ID was enabled before this fix shipped, or the entry was
        // cleared (logout/disable/reinstall) without disabling the Face ID
        // preference itself. Nothing to unlock with — fall back to login.
        this.toLogin('expired');
        return;
      }

      // Make the retrieved token the active session so the auth interceptor
      // attaches it to the validation call below, then confirm it's still
      // good (and get fresh claims — tier, isAdmin, etc.) via the existing
      // refresh endpoint.
      this.auth.setRawToken(stored);
      try {
        const res = await firstValueFrom(
          this.http.post<AuthResponse>(`${this.base}/auth/refresh`, {})
        );
        this.auth.storeAuth(res); // also re-persists a fresh copy to Keychain
        this.lock.unlock();
        this.navigateAfterUnlock();
      } catch {
        // Stored session expired/invalid server-side → clear it (both the
        // live token and the Keychain copy) and send to the main login screen.
        this.auth.clearBiometricSession();
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
