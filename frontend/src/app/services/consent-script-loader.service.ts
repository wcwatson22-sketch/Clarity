import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { MARKETING_ADS, isApprovedAdRoute, fundingChoicesScriptUrl } from './marketing-ads.config';
import { MarketingAdScriptLoader } from './marketing-ad-script-loader.service';

declare global {
  interface Window {
    googlefc?: { callbackQueue?: Array<Record<string, () => void>> };
  }
}

/**
 * Loads Google's certified CMP ("Privacy & Messaging" in AdSense) on the public
 * marketing site. This is the actual consent mechanism for EEA/UK/Swiss visitors —
 * Google's own script detects region, shows the message configured in the AdSense
 * dashboard, and enforces ad-request consent for those regions on its own. This
 * loader's job is only to get the script on the page and mirror its outcome into
 * this app's own consent flag (defense in depth for MarketingAdScriptLoader).
 *
 * Same constraints as MarketingAdScriptLoader: public marketing routes only,
 * never in the native app, fail-silent.
 */
@Injectable({ providedIn: 'root' })
export class ConsentScriptLoader {
  readonly loaded = signal(false);
  private injecting = false;

  constructor(private adLoader: MarketingAdScriptLoader) {}

  ensureLoaded(currentPath: string): void {
    if (this.loaded() || this.injecting) return;
    if (!MARKETING_ADS.enabled) return;
    if (Capacitor.isNativePlatform()) return;
    if (typeof document === 'undefined') return;
    if (!isApprovedAdRoute(currentPath)) return;
    if (!MARKETING_ADS.clientId || MARKETING_ADS.clientId.includes('XXXX')) return;

    this.injecting = true;
    try {
      if (document.querySelector('script[data-clarity-consent="1"]')) { this.loaded.set(true); return; }

      const s = document.createElement('script');
      s.async = true;
      s.src = fundingChoicesScriptUrl(MARKETING_ADS.clientId);
      s.setAttribute('data-clarity-consent', '1');
      s.onload = () => this.loaded.set(true);
      s.onerror = () => { this.injecting = false; };
      document.head.appendChild(s);

      // Google-documented signal iframe so Funding Choices can detect its own presence.
      const signal = document.createElement('script');
      signal.setAttribute('data-clarity-consent-signal', '1');
      signal.textContent = `(function(){function s(){if(!window.frames['googlefcPresent']){if(document.body){var f=document.createElement('iframe');f.style.cssText='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;display:none';f.name='googlefcPresent';document.body.appendChild(f)}else{setTimeout(s,0)}}}s();})();`;
      document.head.appendChild(signal);

      // Mirror Google's own consent outcome into this app's consent flag once resolved.
      this.registerConsentCallback();
    } catch {
      this.injecting = false;
    }
  }

  private registerConsentCallback(): void {
    try {
      window.googlefc = window.googlefc || {};
      window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      window.googlefc.callbackQueue.push({
        'CONSENT_DATA_READY': () => this.adLoader.setConsent(true),
      });
    } catch { /* ignore — fails closed, ads simply stay ungated by our flag */ }
  }
}
