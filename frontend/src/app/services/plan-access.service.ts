import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';

/**
 * Single source of truth for plan-based feature access.
 * Inject this instead of duplicating isPremium / trialActive logic in components.
 *
 * Plan rules:
 *  - Free (trial expired)  : Dashboard, Cash Flow, Learn only
 *  - Trial (active)        : Full access — same as Premium
 *  - Base  ($0.99/mo)      : Adds Compare tab
 *  - Premium ($4.99/mo)    : Adds Loan Prep guides, PFS, unlimited snapshots, CSV export
 */
@Injectable({ providedIn: 'root' })
export class PlanAccessService {
  private auth = inject(AuthService);

  /** True for any paid subscriber (Base or Premium) */
  readonly isPaid = computed(() => this.auth.currentUser()?.isPaid ?? false);

  /** True only for Premium subscribers */
  readonly isPremium = computed(() =>
    this.isPaid() && this.auth.currentUser()?.tier === 'Premium'
  );

  /** True only for Base subscribers */
  readonly isBase = computed(() =>
    this.isPaid() && this.auth.currentUser()?.tier === 'Base'
  );

  /** True when a free trial is still active */
  readonly trialActive = computed(() => {
    if (this.isPaid()) return false;
    const t = this.auth.currentUser()?.trialEndsAt;
    return t ? new Date(t) > new Date() : false;
  });

  /**
   * Compare tab — requires Base Plan ($0.99), Premium ($4.99), or an active trial.
   * Free users with an expired trial are gated.
   */
  readonly canCompare = computed(() => this.isPaid() || this.trialActive());

  /**
   * Loan Prep guides — requires the Premium Plan ($4.99) only.
   * Base plan and trial users see the loan type grid but cannot open guides.
   */
  readonly canLoanPrep = computed(() => this.isPremium());
}
