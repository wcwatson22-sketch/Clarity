import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MarketingAdUnitComponent } from '../../components/marketing-ad-unit.component';
import { MARKETING_ADS } from '../../services/marketing-ads.config';

@Component({
  selector: 'app-public-home',
  standalone: true,
  imports: [RouterLink, MarketingAdUnitComponent],
  template: `
    <!-- Hero -->
    <section class="hero">
      <h1>See your entire financial picture clearly.</h1>
      <p class="lede">Track cash flow, net worth, debt, assets, liabilities, and loan readiness in one simple financial command center.</p>
      <div class="hero-cta">
        @if (auth.isLoggedIn()) {
          <a routerLink="/dashboard" class="btn-primary">Go to Dashboard</a>
        } @else {
          <a routerLink="/signup" class="btn-primary">Get Started Free</a>
        }
        <a routerLink="/features" class="btn-ghost">See How It Works</a>
      </div>
      <p class="hero-note">Free forever — no credit card, no trial expiration.</p>
    </section>

    <!--
      After-hero two-column layout: main content + desktop sidebar ad rail.
      The sidebar is hidden below 1100 px; the mobile banner appears instead.
      Ad units self-collapse when ads are disabled or no ad is returned.
    -->
    <div class="home-row">
      <div class="home-content">

        <!-- Product previews -->
        <section class="previews">
          <h2>A clear view of every part of your finances</h2>
          <p class="previews-sub">Real screens from Clarity — your dashboard, cash flow, loan prep, and learning center.</p>
          <div class="shots">
            <figure class="shot">
              <div class="shot-frame"><span class="dots"><i></i><i></i><i></i></span>
                <img src="images/preview-dashboard.png" alt="Clarity dashboard showing net worth, assets, liabilities, DTI, and snapshot movement" loading="lazy" width="1100" height="1036" />
              </div>
              <figcaption>Dashboard — net worth, assets &amp; liabilities at a glance</figcaption>
            </figure>
            <figure class="shot">
              <div class="shot-frame"><span class="dots"><i></i><i></i><i></i></span>
                <img src="images/preview-cashflow.png" alt="Clarity cash flow view showing take-home pay, outflow, free cash flow, DTI, and the 50/30/20 rule" loading="lazy" width="1100" height="837" />
              </div>
              <figcaption>Cash Flow — where your take-home pay goes</figcaption>
            </figure>
            <figure class="shot">
              <div class="shot-frame"><span class="dots"><i></i><i></i><i></i></span>
                <img src="images/preview-loanprep.png" alt="Clarity loan prep view with mortgage readiness targets and a documents-to-gather checklist" loading="lazy" width="1100" height="1136" />
              </div>
              <figcaption>Loan Prep — get ready before you apply <span class="shot-prem">Premium</span></figcaption>
            </figure>
            <figure class="shot">
              <div class="shot-frame"><span class="dots"><i></i><i></i><i></i></span>
                <img src="images/preview-learn.png" alt="Clarity learning center with financial education lessons across categories" loading="lazy" width="1100" height="1056" />
              </div>
              <figcaption>Learn — plain-English financial guides, free</figcaption>
            </figure>
          </div>
          <p class="shots-note">The figures shown above are sample values from a test account — not real user data.</p>
        </section>

      </div><!-- /.home-content -->

      <!-- Desktop sidebar ad — hidden on mobile via mobileVisibility + CSS.
           Sits beside the previews section; never beside a primary CTA. -->
      @if (ads.placements.homeSidebarEnabled) {
        <aside class="home-sidebar" aria-label="Advertisement sidebar">
          <app-marketing-ad-unit
            placementName="home_desktop_sidebar"
            [adSlot]="ads.slots.homeDesktop"
            format="auto"
            [minimumHeight]="280"
            mobileVisibility="hidden" />
        </aside>
      }
    </div><!-- /.home-row -->

    <!-- Mobile banner — visible only below 760 px, after the first content section.
         Never above the primary CTA. -->
    @if (ads.placements.homeMobileBannerEnabled) {
      <app-marketing-ad-unit
        placementName="home_mobile_banner"
        [adSlot]="ads.slots.homeMobile"
        format="auto"
        [minimumHeight]="90"
        mobileVisibility="only"
        className="home-mobile-banner" />
    }

    <!-- Core benefits -->
    <section class="band">
      <div class="wrap">
        <h2 class="sr-only">What you can do with Clarity</h2>
        <div class="grid grid-2">
          <div class="card"><h3>Understand your cash flow</h3><p>Track household income, fixed expenses, variable spending with per-item budgets, debt payments, and savings.</p></div>
          <div class="card"><h3>See your full financial position</h3><p>Monitor assets, liabilities, net worth, and DTI — and watch your progress over time with snapshots.</p></div>
          <div class="card"><h3>Prepare for major decisions</h3><p>Compare scenarios, estimate how a new loan would change your DTI, and prepare a banker-style financial picture.</p></div>
          <div class="card"><h3>Analyze real estate</h3><p>Track and evaluate investment property — cash flow, cap rate, DSCR, and more — with Premium tools.</p></div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="wrap how">
      <h2>How it works</h2>
      <div class="grid grid-3">
        <div class="step"><span class="step-n">1</span><h4>Build your financial picture</h4><p>Enter income, expenses, assets, and liabilities — no spreadsheet required.</p></div>
        <div class="step"><span class="step-n">2</span><h4>Track your progress</h4><p>Save snapshots and watch your net worth and DTI move over time.</p></div>
        <div class="step"><span class="step-n">3</span><h4>Make informed decisions</h4><p>Use Compare, Loan Prep, and the Loan Impact Calculator when it counts.</p></div>
      </div>
    </section>

    <!-- Free vs Premium -->
    <section class="band">
      <div class="wrap">
        <h2>Start free. Stay free. Upgrade only when you want deeper analysis.</h2>
        <div class="grid grid-2 plans">
          <div class="card plan">
            <span class="plan-tag">Free</span>
            <div class="plan-price">$0<span>/forever</span></div>
            <ul><li>Dashboard</li><li>Cash Flow</li><li>Learn</li><li>Settings</li></ul>
          </div>
          <div class="card plan plan-prem">
            <span class="plan-tag prem">Premium</span>
            <div class="plan-price">$2.99<span>/month</span></div>
            <ul>
              <li>Everything in Free</li><li>Compare</li><li>Loan Prep</li>
              <li>Real Estate</li><li>Loan Impact Calculator</li>
            </ul>
          </div>
        </div>
        <p class="center"><a routerLink="/pricing" class="link">See full plan details →</a></p>
      </div>
    </section>

    <!-- Differentiator -->
    <section class="wrap diff">
      <h2>Most finance apps focus on where your money went. Clarity helps you understand where you stand.</h2>
      <p>Built from a commercial lender's perspective, Clarity brings together cash flow, net worth, DTI, debt, assets, liabilities, and loan preparation in one place — simple enough for everyday use.</p>
      <p class="fine">Clarity is an educational organization tool. It does not provide loan approval or financial advice.</p>
    </section>

    <!-- Security -->
    <section class="band">
      <div class="wrap security">
        <h2>Your data, your control</h2>
        <div class="grid grid-2">
          <div class="sec-item"><h4>You enter your own data</h4><p>Nothing is pulled from your bank automatically — you decide what to track.</p></div>
          <div class="sec-item"><h4>Secure account access</h4><p>Encrypted in transit; passwords hashed and never stored in plain text.</p></div>
          <div class="sec-item"><h4>Never shared with lenders</h4><p>Clarity is not a lender and does not share your information with one.</p></div>
          <div class="sec-item"><h4>Used per our policy</h4><p>Your information is handled according to our <a href="https://clarityfinancialtools.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</p></div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="wrap final">
      <h2>Ready for a clearer financial picture?</h2>
      @if (auth.isLoggedIn()) {
        <a routerLink="/dashboard" class="btn-primary lg">Go to Dashboard</a>
      } @else {
        <a routerLink="/signup" class="btn-primary lg">Create Your Free Account</a>
      }
    </section>
  `,
  styles: [`
    :host { --g:#1D9E75; --ink:#111827; --muted:#6B7280; --line:#E5E7EB; display:block; }
    h1,h2,h3,h4 { color: var(--ink); }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
    .band { background: #F7FAF9; padding: 64px 0; margin-top: 8px; }
    .grid { display: grid; gap: 18px; }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }

    .hero {
      max-width: 100%; margin: 0; padding: 80px 24px 64px; text-align: center;
      background:
        radial-gradient(900px 380px at 50% -60px, #D7F2E8 0%, rgba(215,242,232,0) 70%),
        linear-gradient(180deg, #F2FBF7 0%, #FFFFFF 100%);
    }
    .hero > * { max-width: 820px; margin-left: auto; margin-right: auto; }
    .hero h1 { font-size: 44px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; margin: 0 0 18px; }
    .lede { font-size: 19px; color: var(--muted); line-height: 1.6; margin: 0 auto 28px; max-width: 640px; }
    .hero-cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .hero-note { font-size: 13px; color: var(--muted); margin-top: 16px; }

    .btn-primary { background: var(--g); color: #fff; text-decoration: none; padding: 13px 26px; border-radius: 11px; font-weight: 600; font-size: 15px; display: inline-block; &:hover { background: #085041; } }
    .btn-primary.lg { padding: 15px 34px; font-size: 16px; }
    .btn-ghost { border: 1.5px solid var(--line); color: var(--ink); text-decoration: none; padding: 13px 24px; border-radius: 11px; font-weight: 600; font-size: 15px; &:hover { border-color: var(--g); color: var(--g); } }

    h2 { font-size: 28px; font-weight: 700; text-align: center; max-width: 760px; margin: 0 auto 32px; line-height: 1.25; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 24px; }
    .card h3 { font-size: 17px; font-weight: 700; margin: 0 0 8px; }
    .card p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }

    /* ── After-hero two-column layout ──────────────────────────────────────── */
    .home-row {
      display: flex; align-items: flex-start; gap: 24px;
      max-width: 1440px; margin: 0 auto;
    }
    .home-content { flex: 1 1 0; min-width: 0; }
    /* Sidebar: 300 px wide, inset from edge, top-padded to align with previews */
    .home-sidebar {
      flex: 0 0 300px; padding-top: 64px; padding-right: 24px;
    }
    /* Hide sidebar below 1100 px; the mobile banner appears instead */
    @media (max-width: 1100px) {
      .home-sidebar { display: none !important; }
    }

    /* Product previews (inside .home-content — no longer needs .wrap centering) */
    .previews { padding: 64px 24px 8px; text-align: center; max-width: 1080px; margin: 0 auto; }
    .previews-sub { font-size: 16px; color: var(--muted); margin: -18px auto 36px; max-width: 620px; line-height: 1.6; }
    .shots { display: grid; grid-template-columns: repeat(2, 1fr); gap: 26px; }
    .shot { margin: 0; }
    .shot-frame {
      border: 1px solid var(--line); border-radius: 16px; overflow: hidden;
      background: linear-gradient(180deg, #F0FBF7, #fff);
      box-shadow: 0 18px 40px rgba(16,24,40,0.10); transition: transform .18s, box-shadow .18s;
    }
    .shot-frame:hover { transform: translateY(-4px); box-shadow: 0 26px 56px rgba(16,24,40,0.14); }
    .dots { display: flex; gap: 6px; padding: 11px 14px; border-bottom: 1px solid #EAF5F0; background: #fff; }
    .dots i { width: 10px; height: 10px; border-radius: 50%; background: #E5E7EB; display: inline-block; }
    .dots i:nth-child(1) { background: #FCA5A5; } .dots i:nth-child(2) { background: #FCD34D; } .dots i:nth-child(3) { background: #86EFAC; }
    .shot-frame img { display: block; width: 100%; height: auto; }
    .shot figcaption { font-size: 14px; color: #374151; font-weight: 600; margin-top: 14px; }
    .shot-prem { display: inline-block; font-size: 11px; font-weight: 700; color: var(--g); background: #E1F5EE; border-radius: 999px; padding: 2px 9px; margin-left: 6px; vertical-align: middle; }
    .shots-note { font-size: 12.5px; color: #9CA3AF; text-align: center; margin: 26px auto 0; max-width: 560px; font-style: italic; }

    /* Mobile banner — the ad unit's own mobileVisibility="only" hides it on
       desktop; this class just adds horizontal breathing room on small screens. */
    ::ng-deep .home-mobile-banner { margin-left: 16px; margin-right: 16px; }

    .how { padding: 64px 24px; }
    .step { text-align: center; padding: 12px; }
    .step-n { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #E1F5EE; color: var(--g); font-weight: 800; font-size: 18px; margin-bottom: 14px; }
    .step h4 { font-size: 16px; margin: 0 0 6px; } .step p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }

    .plans { max-width: 720px; margin: 0 auto; }
    .plan { text-align: center; } .plan-prem { border: 2px solid var(--g); }
    .plan-tag { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .plan-tag.prem { color: var(--g); }
    .plan-price { font-size: 34px; font-weight: 800; margin: 8px 0 14px; span { font-size: 14px; font-weight: 500; color: var(--muted); } }
    .plan ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .plan li { font-size: 14px; color: #374151; } .plan li::before { content: '✓ '; color: var(--g); font-weight: 700; }
    .center { text-align: center; margin-top: 24px; } .link { color: var(--g); font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }

    .diff { padding: 72px 24px; text-align: center; max-width: 820px; }
    .diff p { font-size: 16px; color: var(--muted); line-height: 1.7; max-width: 680px; margin: 0 auto 12px; }
    .diff .fine { font-size: 12.5px; color: #9CA3AF; margin-top: 18px; }

    .security h4 { font-size: 15px; margin: 0 0 6px; } .sec-item p { font-size: 14px; color: var(--muted); line-height: 1.6; margin: 0; }
    .sec-item a { color: var(--g); }

    .final { padding: 72px 24px; text-align: center; }

    @media (max-width: 760px) {
      .hero h1 { font-size: 32px; } .lede { font-size: 17px; }
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .shots { grid-template-columns: 1fr; gap: 22px; }
      h2 { font-size: 23px; }
      /* On mobile home-row collapses to a single column */
      .home-row { display: block; }
    }
  `],
})
export class PublicHomeComponent {
  readonly auth = inject(AuthService);
  readonly ads = MARKETING_ADS;
}
