import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const FACE_ID_KEY = 'clarity_face_id';

@Injectable({ providedIn: 'root' })
export class LockService {
  /** True when the app is locked and the user must authenticate.
   *  Only ever true on native (iOS/Android) — web never locks. */
  private _locked = signal(Capacitor.isNativePlatform());
  readonly locked = this._locked.asReadonly();

  /** Whether the user has opted into biometric (Face ID / Touch ID) unlock. */
  readonly faceIdEnabled = signal(localStorage.getItem(FACE_ID_KEY) === '1');

  /** Call after successful authentication to dismiss the lock screen. */
  unlock() { this._locked.set(false); }

  /** Call when the app goes to background to re-lock on next foreground. */
  lock() {
    if (Capacitor.isNativePlatform()) this._locked.set(true);
  }

  /** Persist the Face ID preference. */
  setFaceId(enabled: boolean) {
    this.faceIdEnabled.set(enabled);
    localStorage.setItem(FACE_ID_KEY, enabled ? '1' : '0');
  }
}
