import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Thin wrapper around @aparajita/capacitor-secure-storage — Keychain-backed
 * on iOS (encrypted, app-sandboxed), Android Keystore-backed on Android.
 *
 * This is intentionally narrow: it exists ONLY to hold the Face ID / Touch ID
 * "unlock session" credential (see AuthService.storeBiometricSession /
 * getBiometricSession / clearBiometricSession). It is NOT used for the
 * regular, always-available session token the interceptor reads on every
 * HTTP call — that stays in the AuthService signal / localStorage, exactly
 * as before, because a native Keychain round-trip on every API request would
 * add latency for no benefit. Keychain storage only matters for the value
 * that needs to sit encrypted-at-rest *while the app is locked*, released
 * only after Face ID succeeds.
 *
 * On web this is a no-op (methods resolve to null / do nothing) — Face ID
 * doesn't exist on web, so nothing should ever call these there.
 */
@Injectable({ providedIn: 'root' })
export class SecureStorageService {
  private get isNative() { return Capacitor.isNativePlatform(); }

  async get(key: string): Promise<string | null> {
    if (!this.isNative) return null;
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      return await SecureStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!this.isNative) return;
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.setItem(key, value);
    } catch {
      // Best-effort — if the Keychain write fails, the app still functions
      // via the normal localStorage-backed session; Face ID unlock just
      // won't have a stored credential to retrieve next time.
    }
  }

  async remove(key: string): Promise<void> {
    if (!this.isNative) return;
    try {
      const { SecureStorage } = await import('@aparajita/capacitor-secure-storage');
      await SecureStorage.removeItem(key);
    } catch {
      // Nothing to clean up, or the store is already empty — either way
      // this is not a failure worth surfacing to the user.
    }
  }
}
