import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Privacy-conscious analytics for the PUBLIC Learn pages only.
 *
 * Events are pushed to window.dataLayer if a tag manager / analytics tool is
 * present; otherwise this is a no-op (and a console.debug in dev). It NEVER
 * sends any financial data — only page/slug/category/CTA identifiers.
 *
 * Hard rule: do not call this from authenticated app screens or the native app.
 */

export type LearnEvent =
  | 'learn_hub_viewed'
  | 'learn_article_viewed'
  | 'learn_cta_clicked'
  | 'learn_account_create_started'
  | 'learn_premium_link_clicked'
  | 'learn_related_clicked';

interface LearnEventPayload {
  // Only non-sensitive identifiers — never income, assets, DTI, balances, etc.
  slug?: string;
  category?: string;
  label?: string;
  to?: string;
}

declare global {
  interface Window { dataLayer?: Array<Record<string, unknown>>; }
}

@Injectable({ providedIn: 'root' })
export class LearnAnalyticsService {
  track(event: LearnEvent, payload: LearnEventPayload = {}): void {
    // Never run analytics inside the native app.
    if (Capacitor.isNativePlatform()) return;

    const record = { event, ...payload };
    if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) {
      window.dataLayer.push(record);
    } else if (typeof console !== 'undefined') {
      // No analytics tool wired up yet — keep a dev breadcrumb, ship nothing.
      console.debug('[learn-analytics]', record);
    }
  }
}
