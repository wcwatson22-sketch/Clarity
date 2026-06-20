import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-public-pricing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="head">
      <h1>Simple, honest pricing</h1>
      <p>Start free and keep your financial picture organized. Upgrade to Premium when you want deeper analysis. No trial, no expiration.</p>
    </section>

    <section class="wrap">
      <div class="plan">
        <span class="tag">Free</span>
        <div class="price">$0<span>/forever</span></div>
        <p class="blurb">Everything you need to organize your finances.</p>
        <ul>
          <li>Dashboard — net worth, assets, liabilities, DTI</li>
          <li>Cash Flow — income, expenses, debt, savings</li>
          <li>Variable expense budgets &amp; snapshots</li>
          <li>Retirement contributions &amp; employer match</li>
          <li>Settings &amp; secure account</li>
        </ul>
        @if (auth.isLoggedIn()) { <a routerLink="/dashboard" class="btn-ghost">Go to Dashboard</a> }
        @else { <a routerLink="/signup" class="btn-ghost">Create Free Account</a> }
      </div>

      <div class="plan featured">
        <div class="badge">Most popular</div>
        <span class="tag prem">Premium</span>
        <div class="price">$2.99<span>/month</span></div>
        <p class="blurb">Everything in Free, plus deeper analysis tools.</p>
        <ul>
          <li><strong>Compare</strong> — scenarios &amp; benchmarks</li>
          <li><strong>Loan Prep</strong> — banker-style readiness</li>
          <li><strong>Loan Impact Calculator</strong> — DTI impact</li>
          <li><strong>Real Estate</strong> — investment analysis</li>
          <li>Personal Financial Statement tools</li>
        </ul>
        @if (auth.isLoggedIn()) { <a routerLink="/settings" class="btn-primary">Upgrade to Premium</a> }
        @else { <a routerLink="/signup" class="btn-primary">Get Started</a> }
      </div>
    </section>

    <p class="note">
      <a routerLink="/learn">Learn articles</a> are always free — on the Clarity website and inside the Clarity app. No account required to read them.
    </p>

    <p class="note">
      Premium renews monthly and can be canceled anytime — in your Apple ID settings (iOS) or from Settings (web).
      Restore Purchases is available in the app.
      See our <a href="https://clarityfinancialtools.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>
      and <a routerLink="/terms">Terms of Use</a>.
    </p>
  `,
  styles: [`
    :host { --g:#1D9E75; --ink:#111827; --muted:#6B7280; --line:#E5E7EB; display:block; }
    .head { text-align: center; padding: 64px 24px 28px; max-width: 720px; margin: 0 auto; }
    .head h1 { font-size: 36px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 14px; color: var(--ink); }
    .head p { font-size: 18px; color: var(--muted); line-height: 1.6; margin: 0; }
    .wrap { max-width: 800px; margin: 0 auto; padding: 0 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
    .plan { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 28px; position: relative; }
    .plan.featured { border: 2px solid var(--g); }
    .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--g); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 14px; border-radius: 20px; letter-spacing: .03em; }
    .tag { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .tag.prem { color: var(--g); }
    .price { font-size: 40px; font-weight: 800; color: var(--ink); margin: 6px 0 4px; span { font-size: 15px; font-weight: 500; color: var(--muted); } }
    .blurb { font-size: 14px; color: var(--muted); margin: 0 0 18px; }
    ul { list-style: none; margin: 0 0 22px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
    li { font-size: 14px; color: #374151; line-height: 1.4; } li::before { content: '✓ '; color: var(--g); font-weight: 700; }
    .btn-primary { display: block; text-align: center; background: var(--g); color: #fff; text-decoration: none; padding: 13px; border-radius: 11px; font-weight: 600; &:hover { background:#085041; } }
    .btn-ghost { display: block; text-align: center; border: 1.5px solid var(--line); color: var(--ink); text-decoration: none; padding: 13px; border-radius: 11px; font-weight: 600; &:hover { border-color: var(--g); color: var(--g); } }
    .note { max-width: 700px; margin: 36px auto 0; padding: 0 24px; text-align: center; font-size: 12.5px; color: #9CA3AF; line-height: 1.6; a { color: var(--g); } }
    @media (max-width: 700px) { .head h1 { font-size: 28px; } .wrap { grid-template-columns: 1fr; } }
  `],
})
export class PublicPricingComponent {
  readonly auth = inject(AuthService);
}
