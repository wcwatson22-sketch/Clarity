import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { MARKETING_ADS, isApprovedAdRoute, adsenseScriptUrl } from './marketing-ads.config';

export type AdEvent = 'ad_slot_requested' | 'ad_slot_rendered' | 'ad_slot_empty' | 'ad_slot_error';

declare global {
  interface Window { adsbygoogle?: unknown[]; dataLayer?: Array<Record<string, unknown>>; }
}

const CONSENT_KEY = 'clarity_ad_consent';   // 'granted' | 'denied'

/**
 * Loads the Google AdSense script for the PUBLIC MARKETING SITE ONLY.
 *
 * Guarantees:
 *  - Never loads inside the native app (Capacitor) or off an approved route.
 *  - Loads the script at most once (idempotent), asynchronously, fail-silent.
 *  - Respects consent when `requireConsent` is configured.
 *  - Carries no user/financial data — only the publisher id in the script URL.
 *
 * It is invoked by MarketingAdUnit (which only exists on marketing pages), so
 * the script is never even requested from authenticated routes.
 */
@Injectable({ providedIn: 'root' })
export class MarketingAdScriptLoader {
  /** true once the adsbygoogle script tag has been injected. */
  readonly loaded = signal(false);
  private injecting = false;

  /** Whether advertising may run at all in the current context. */
  canServeAds(currentPath: string): boolean {
    return MARKETING_ADS.enabled
      && !Capacitor.isNativePlatform()
      && typeof document !== 'undefined'
      && isApprovedAdRoute(currentPath)
      && !!MARKETING_ADS.clientId
      && !MARKETING_ADS.clientId.includes('XXXX')
      && this.hasConsent();
  }

  /** Consent gate. When requireConsent is false (e.g. US), permitted by default. */
  hasConsent(): boolean {
    if (!MARKETING_ADS.requireConsent) return true;
    try { return localStorage.getItem(CONSENT_KEY) === 'granted'; } catch { return false; }
  }

  /** Allow the public site to record / revisit the visitor's ad-consent choice. */
  setConsent(granted: boolean): void {
    try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch { /* ignore */ }
  }

  /** Inject the AdSense script once, only if ads may serve on this route. No-op otherwise. */
  ensureScriptLoaded(currentPath: string): boolean {
    if (this.loaded()) return true;
    if (this.injecting) return false;
    if (!this.canServeAds(currentPath)) return false;

    this.injecting = true;
    try {
      const existing = document.querySelector('script[data-clarity-ads="1"]');
      if (existing) { this.loaded.set(true); return true; }
      const s = document.createElement('script');
      s.async = true;
      s.src = adsenseScriptUrl(MARKETING_ADS.clientId);
      s.crossOrigin = 'anonymous';
      s.setAttribute('data-clarity-ads', '1');
      s.onload = () => this.loaded.set(true);
      s.onerror = () => { /* blocked/unavailable — fail silent */ this.injecting = false; };
      document.head.appendChild(s);
      this.loaded.set(true);
      return true;
    } catch {
      this.injecting = false;
      return false;
    }
  }

  /** Marketing-only analytics breadcrumb. Never includes user/financial data. */
  track(event: AdEvent, placement: string): void {
    if (Capacitor.isNativePlatform()) return;
    const rec = { event, placement };
    if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) window.dataLayer.push(rec);
    else if (typeof console !== 'undefined') console.debug('[marketing-ads]', rec);
  }
}
