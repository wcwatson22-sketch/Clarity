import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppInstallService {
  readonly canInstall  = signal(false);
  readonly isIos       = signal(false);
  readonly isInstalled = signal(false);

  private _deferredPrompt: any = null;

  constructor() {
    if (typeof window === 'undefined') return;

    // Already running as installed PWA
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (standalone) { this.isInstalled.set(true); return; }

    // iOS — no beforeinstallprompt, show manual instructions
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    if (ios) { this.isIos.set(true); this.canInstall.set(true); return; }

    // Android / Chrome / Edge — wait for the browser prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this._deferredPrompt = e;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this._deferredPrompt = null;
      this.canInstall.set(false);
      this.isInstalled.set(true);
    });
  }

  async install(): Promise<boolean> {
    if (!this._deferredPrompt) return false;
    this._deferredPrompt.prompt();
    const { outcome } = await this._deferredPrompt.userChoice;
    this._deferredPrompt = null;
    if (outcome === 'accepted') {
      this.canInstall.set(false);
      this.isInstalled.set(true);
      return true;
    }
    return false;
  }
}
