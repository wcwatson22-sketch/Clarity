import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-public-features',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="head">
      <h1>Everything you need to understand your finances</h1>
      <p>Clarity brings cash flow, net worth, and loan readiness together — through a banker's lens, kept simple.</p>
    </section>

    <section class="wrap">
      <div class="tier">
        <div class="tier-head"><h2>Free</h2><span class="tier-price">$0 forever</span></div>
        <div class="feat-grid">
          <div class="feat"><h3>Dashboard</h3><p>Net worth, assets, liabilities, and DTI at a glance.</p></div>
          <div class="feat"><h3>Cash Flow</h3><p>Household income, fixed &amp; variable expenses, debt, and savings.</p></div>
          <div class="feat"><h3>Variable expense budgets</h3><p>Set a per-item budget and see remaining vs. over at a glance.</p></div>
          <div class="feat"><h3>Fixed expense tracking</h3><p>Record recurring obligations like rent, insurance, and subscriptions.</p></div>
          <div class="feat"><h3>Retirement contributions</h3><p>Traditional/Roth 401(k) and IRA, in monthly dollars.</p></div>
          <div class="feat"><h3>Employer match</h3><p>Counts toward savings without reducing your take-home pay.</p></div>
          <div class="feat"><h3>Assets &amp; liabilities</h3><p>Track everything you own and owe in one place.</p></div>
          <div class="feat"><h3>Net worth &amp; DTI</h3><p>Core lender-style metrics, calculated automatically.</p></div>
          <div class="feat"><h3>Snapshots</h3><p>Capture your position over time and measure progress from a baseline.</p></div>
          <div class="feat"><h3>Learn</h3><p>Free financial guides — on the <a routerLink="/learn">Clarity website</a> and inside the app.</p></div>
        </div>
      </div>

      <div class="tier prem">
        <div class="tier-head"><h2>Premium</h2><span class="tier-price">$2.99/month</span></div>
        <p class="tier-sub">Everything in Free, plus deeper analysis:</p>
        <div class="feat-grid">
          <div class="feat"><h3>Compare</h3><p>Weigh financial scenarios side by side and see how you stack up.</p></div>
          <div class="feat"><h3>Loan Prep</h3><p>Banker-style readiness checklists for every major loan type.</p></div>
          <div class="feat"><h3>Loan Impact Calculator</h3><p>Estimate how a proposed loan would change your DTI.</p></div>
          <div class="feat"><h3>Personal Financial Statement</h3><p>Generate a clean, lender-ready PFS one-pager.</p></div>
          <div class="feat"><h3>Real Estate</h3><p>Analyze investment property — cash flow, cap rate, DSCR, and projections.</p></div>
        </div>
      </div>

      <div class="cta">
        @if (auth.isLoggedIn()) { <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a> }
        @else { <a routerLink="/signup" class="btn-primary">Get Started Free</a> }
        <a routerLink="/pricing" class="btn-ghost">View Pricing</a>
      </div>
    </section>
  `,
  styles: [`
    :host { --g:#1D9E75; --ink:#111827; --muted:#6B7280; --line:#E5E7EB; display:block; }
    .head { text-align: center; padding: 64px 24px 32px; max-width: 760px; margin: 0 auto; }
    .head h1 { font-size: 36px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 14px; color: var(--ink); }
    .head p { font-size: 18px; color: var(--muted); line-height: 1.6; margin: 0; }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px 40px; }
    .tier { margin-bottom: 40px; }
    .tier-head { display: flex; align-items: baseline; gap: 14px; border-bottom: 2px solid var(--line); padding-bottom: 10px; margin-bottom: 20px; }
    .tier-head h2 { font-size: 24px; font-weight: 700; margin: 0; color: var(--ink); }
    .tier.prem .tier-head { border-color: var(--g); }
    .tier-price { font-size: 15px; font-weight: 600; color: var(--g); }
    .tier-sub { font-size: 14px; color: var(--muted); margin: -8px 0 20px; }
    .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .feat { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
    .feat h3 { font-size: 15px; font-weight: 700; margin: 0 0 6px; color: var(--ink); }
    .feat p { font-size: 13.5px; color: var(--muted); line-height: 1.55; margin: 0; }
    .cta { display: flex; gap: 12px; justify-content: center; margin-top: 32px; flex-wrap: wrap; }
    .btn-primary { background: var(--g); color: #fff; text-decoration: none; padding: 13px 26px; border-radius: 11px; font-weight: 600; &:hover { background:#085041; } }
    .btn-ghost { border: 1.5px solid var(--line); color: var(--ink); text-decoration: none; padding: 13px 24px; border-radius: 11px; font-weight: 600; &:hover { border-color: var(--g); color: var(--g); } }
    @media (max-width: 760px) { .head h1 { font-size: 28px; } .feat-grid { grid-template-columns: 1fr; } }
  `],
})
export class PublicFeaturesComponent {
  readonly auth = inject(AuthService);
}
