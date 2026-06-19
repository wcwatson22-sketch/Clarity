import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-public-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <article class="about">
      <h1>About Clarity</h1>
      <p class="lede">Clarity is a personal finance command center that helps you understand your full financial picture — without building your own spreadsheet.</p>

      <h2>Why we built it</h2>
      <p>Clarity began as a detailed personal finance spreadsheet used to track cash flow, net worth, debt, assets, liabilities, and financial progress. It was rebuilt as a simpler platform so users could gain the same level of visibility without managing complex formulas or spreadsheets.</p>

      <h2>A banker's lens, kept simple</h2>
      <p>Most budgeting apps focus on where your money went. Clarity was designed from a commercial lender's perspective — bringing together the metrics that actually matter when you're preparing for a loan or major financial decision: cash flow, net worth, DTI, debt, assets, liabilities, and loan readiness. The goal is to give everyday people that same level of insight, in plain English.</p>

      <h2>Our mission</h2>
      <p>To help everyday individuals, couples, and households better understand their finances — whether you're paying down debt, preparing for a loan, considering investment real estate, or simply want more structure than a basic budgeting app provides.</p>

      <p class="note">Clarity is an educational organization tool. It does not provide loan approval, prequalification, or financial advice. Always consult a qualified professional before making financial decisions.</p>

      <div class="own">
        <p><strong>Clarity Financial Tools is owned and operated by Clearpath Digital LLC.</strong></p>
        <p class="copy">© 2026 Clearpath Digital LLC. All rights reserved.</p>
      </div>

      <div class="cta">
        @if (auth.isLoggedIn()) { <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a> }
        @else { <a routerLink="/signup" class="btn-primary">Get Started Free</a> }
      </div>
    </article>
  `,
  styles: [`
    :host { --g:#1D9E75; --ink:#111827; --muted:#6B7280; --line:#E5E7EB; display:block; }
    .about { max-width: 720px; margin: 0 auto; padding: 64px 24px; }
    h1 { font-size: 38px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 16px; color: var(--ink); }
    .lede { font-size: 19px; color: var(--muted); line-height: 1.6; margin: 0 0 32px; }
    h2 { font-size: 21px; font-weight: 700; color: var(--ink); margin: 32px 0 10px; }
    p { font-size: 16px; color: #374151; line-height: 1.75; margin: 0 0 14px; }
    .note { font-size: 13px; color: #9CA3AF; line-height: 1.6; margin-top: 24px; }
    .own { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--line); }
    .own p { font-size: 14px; color: #374151; margin: 0 0 4px; }
    .own .copy { font-size: 12.5px; color: #9CA3AF; }
    .cta { margin-top: 28px; }
    .btn-primary { background: var(--g); color: #fff; text-decoration: none; padding: 13px 26px; border-radius: 11px; font-weight: 600; display: inline-block; &:hover { background:#085041; } }
    @media (max-width: 760px) { h1 { font-size: 30px; } .lede { font-size: 17px; } }
  `],
})
export class PublicAboutComponent {
  readonly auth = inject(AuthService);
}
