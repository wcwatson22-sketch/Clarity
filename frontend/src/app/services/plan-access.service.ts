import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Single source of truth for plan-based feature access.
 *
 * Two-tier freemium model (no trial, no Base plan):
 *  - Free  (default, indefinite): Dashboard, Cash Flow, Learn, Settings
 *  - Premium ($2.99/mo):          adds Compare, Loan Prep, Real Estate
 *
 * Premium is determined purely by an active subscription (isPaid = Stripe or
 * Apple). Legacy tier strings ("base", "compare", "trial") all resolve to Free.
 * Never gate on displayed price or scattered isBase/isTrial checks — use this.
 */
@Injectable({ providedIn: 'root' })
export class PlanAccessService {
  private auth = inject(AuthService);

  /** Premium = the user has an active paid subscription (Stripe or Apple IAP). */
  readonly isPremium = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    return u.isPaid === true || u.tier === 'Premium';
  });

  /** Everyone who is not Premium is on the indefinite Free plan. */
  readonly isFree = computed(() => !this.isPremium());

  /** Customer-facing plan name. */
  readonly planName = computed(() => this.isPremium() ? 'Premium Plan' : 'Free Plan');

  // ── Free features (always available) ───────────────────────────────────────
  readonly canDashboard = computed(() => true);
  readonly canCashFlow  = computed(() => true);
  readonly canLearn     = computed(() => true);
  readonly canSettings  = computed(() => true);

  // ── Premium-only features ──────────────────────────────────────────────────
  readonly canCompare    = computed(() => this.isPremium());
  readonly canLoanPrep   = computed(() => this.isPremium());
  readonly canRealEstate = computed(() => this.isPremium());
  /** Personal Financial Statement is a banker-readiness (Premium) tool. */
  readonly canPfs        = computed(() => this.isPremium());
}
