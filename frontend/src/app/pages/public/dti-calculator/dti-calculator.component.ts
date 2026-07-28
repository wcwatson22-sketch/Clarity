import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SeoService } from '../../../services/seo.service';
import { LearnAnalyticsService } from '../../../services/learn-analytics.service';
import { NumericDirective } from '../../../directives/numeric.directive';
import { LearnDisclosureComponent } from '../../../components/learn-disclosure.component';
import { calculateDti, dtiBand, totalMonthlyDebt, DtiBandTone } from '../../../shared/dti-calculator';

/**
 * Public, stateless DTI calculator — /calculators/debt-to-income-ratio.
 * No login, no persistence, no financial values ever leave the browser (only
 * anonymous started/completed *events* are tracked, never the entered numbers).
 */
@Component({
  selector: 'app-dti-calculator',
  standalone: true,
  imports: [RouterLink, NumericDirective, LearnDisclosureComponent],
  templateUrl: './dti-calculator.component.html',
  styleUrl: './dti-calculator.component.scss',
})
export class DtiCalculatorComponent implements OnInit {
  readonly auth = inject(AuthService);
  private seo = inject(SeoService);
  private analytics = inject(LearnAnalyticsService);

  // ── Inputs (all local signals — nothing persisted, nothing sent anywhere) ──
  grossIncome = signal(0);
  housing     = signal(0);
  auto        = signal(0);
  student     = signal(0);
  creditCards = signal(0);
  personal    = signal(0);
  other       = signal(0);

  /** True once the visitor has entered a usable income — used for the one
   *  `dti_calculator_started` analytics event (fires once per visit). */
  private hasStarted = false;

  readonly totalDebt = computed(() => totalMonthlyDebt({
    housing: this.housing(), auto: this.auto(), student: this.student(),
    creditCards: this.creditCards(), personal: this.personal(), other: this.other(),
  }));

  readonly canCalculate = computed(() => this.grossIncome() > 0);

  readonly dtiPct = computed(() => calculateDti(this.grossIncome(), {
    housing: this.housing(), auto: this.auto(), student: this.student(),
    creditCards: this.creditCards(), personal: this.personal(), other: this.other(),
  }));

  readonly band = computed<{ label: string; tone: DtiBandTone } | null>(() => {
    const d = this.dtiPct();
    return d === null ? null : dtiBand(d);
  });

  ngOnInit(): void {
    const path = '/calculators/debt-to-income-ratio';
    this.seo.update({
      title: 'Free Debt-to-Income Ratio Calculator | Clarity',
      description: 'Calculate your debt-to-income ratio for free. Compare your monthly debt payments with your gross income and learn how DTI is generally evaluated.',
      path,
    });
    this.seo.setRobots('index,follow');
    this.seo.setJsonLd('breadcrumb', {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: this.seo.absoluteUrl('/') },
        { '@type': 'ListItem', position: 2, name: 'Learn', item: this.seo.absoluteUrl('/learn') },
        { '@type': 'ListItem', position: 3, name: 'DTI Calculator', item: this.seo.absoluteUrl(path) },
      ],
    });
    this.seo.setJsonLd('webapp', {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'Debt-to-Income Ratio Calculator',
      url: this.seo.absoluteUrl(path),
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: 'Free calculator that estimates your debt-to-income ratio from gross monthly income and monthly debt payments.',
    });
    this.analytics.track('dti_calculator_viewed');
  }

  /** Only digits/decimal ever reach here (NumericDirective sanitizes first). */
  setField(setter: (v: number) => void, raw: string) {
    setter(Math.max(0, +raw || 0));
    if (!this.hasStarted) {
      this.hasStarted = true;
      this.analytics.track('dti_calculator_started');
    }
  }

  private completedTracked = false;
  /** Fires once, the first time a valid result is shown — never with values. */
  private maybeTrackCompleted() {
    if (this.completedTracked || !this.canCalculate()) return;
    this.completedTracked = true;
    this.analytics.track('dti_calculator_completed');
  }

  fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); }
  pct(v: number) { return `${v.toFixed(1)}%`; }

  trackSignup() { this.analytics.track('dti_calculator_signup_clicked'); }
  trackArticle(slug: string) { this.analytics.track('dti_calculator_article_clicked', { slug }); }

  // Called from the template whenever dtiPct recomputes to a real value.
  onResultShown() { this.maybeTrackCompleted(); }
}
