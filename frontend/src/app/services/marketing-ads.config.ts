import { environment } from '../../environments/environment';

/**
 * Central marketing-site advertising configuration (read-only accessor over the
 * environment). Ads are PUBLIC-MARKETING-ONLY. This config must never be wired
 * to subscription/entitlement logic.
 */
export const MARKETING_ADS = environment.marketingAds;

/** The only routes on which advertising may load/render. */
export function isApprovedAdRoute(path: string): boolean {
  const p = (path || '/').split('?')[0].split('#')[0];
  return p === '/' || p === '' || p === '/learn' || p.startsWith('/learn/');
}

/** AdSense loader script URL for the configured publisher id. */
export function adsenseScriptUrl(clientId: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}
