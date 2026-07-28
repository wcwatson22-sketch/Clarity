import { Component, computed, effect, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { PlanAccessService } from '../../services/plan-access.service';
import { NumericDirective } from '../../directives/numeric.directive';
import { BudgetItem, IncomeData } from '../../models/finance.models';
import {
  LoanCategory, monthlyPayment, housingExtrasTotal, currentDti, projectedDti,
  projectedDebt, housingRatio, evaluateRange, REFERENCE_RANGES, HOUSING_RATIO_RANGE,
  CreExpenseMethod, annualGrossRent, effectiveGrossIncome, ratioOperatingExpenses,
  netOperatingIncome, annualDebtService, propertyDscr, DSCR_REFERENCE, simulatePayoff,
} from '../../shared/loan-impact';

interface SavedScenario {
  name: string; category: LoanCategory; amount: number; rate: number; term: number;
  payment: number; projectedDtiPct: number;
  // Rental property DSCR snapshot (undefined for other loan types).
  rentalDscr?: {
    estimatedRent: number; expenseMethod: CreExpenseMethod; expenseRatioPct: number;
    ownExpenses: number; vacancyPct: number; noiAnnual: number; adsAnnual: number; dscr: number | null;
  };
}

@Component({
  selector: 'app-loan-impact',
  standalone: true,
  imports: [CommonModule, RouterLink, NumericDirective],
  templateUrl: './loan-impact.component.html',
  styleUrl: './loan-impact.component.scss',
})
export class LoanImpactComponent implements OnInit {
  private svc   = inject(FinanceService);
  readonly plan = inject(PlanAccessService);

  readonly hasAccess = this.plan.canLoanPrep;
  readonly Math = Math;
  readonly dscrReference = DSCR_REFERENCE;

  constructor() {
    // Amortization mode's payment field is directly editable (an existing loan's real
    // payment, not a lender-quote override) — auto-seed it from loan amount/rate/term,
    // and keep recalculating as those change, until the user actually types into the
    // payment field themselves. (Previously this guarded on `manualPayment() !== 0`,
    // which broke if amount was filled in before rate: a 0%-rate payment is non-zero,
    // so it looked "already set" and silently blocked the correct value from ever
    // being computed once rate was entered.)
    effect(() => {
      if (!this.isAmortizationMode() || this.manualPaymentEdited()) return;
      const p = monthlyPayment(this.amount(), this.rate(), this.term());
      if (p > 0) this.manualPayment.set(Math.round(p * 100) / 100);
    }, { allowSignalWrites: true });
  }

  // ── Source data (read-only copy of Cash Flow) ──────────────────────────────
  private income = signal<IncomeData | null>(null);
  private budget = signal<BudgetItem[]>([]);
  loading = signal(true);

  /** Gross monthly income — mirrors the Dashboard/Cash Flow/PFS formula exactly.
   *  Secondary income comes from the server income record (source of truth), matching
   *  Dashboard/Cash Flow/PFS — not the old localStorage keys, which those pages stopped
   *  writing to once secondary income moved server-side. */
  readonly grossIncome = computed(() => {
    const inc = this.income();
    if (!inc) return 0;
    let g = inc.type === 'stable'
      ? inc.grossMonthlyIncome
      : (inc.variableMonths?.length ? inc.variableMonths.reduce((s, m) => s + m.amount, 0) / inc.variableMonths.length : 0);
    if (inc.secondaryEnabled) g += inc.secondaryGrossMonthly ?? 0;
    return g;
  });

  /** Net (take-home) monthly income — same pattern as Cash Flow/PFS's netIncome, used for
   *  DSCR (which measures actual capacity to service debt from real cash flow), while DTI
   *  stays gross-based (the conventional basis for DTI). */
  readonly netIncomeVal = computed(() => {
    const inc = this.income();
    if (!inc) return 0;
    let n = inc.type === 'stable'
      ? inc.netMonthlyIncome
      : (inc.variableMonths?.length ? inc.variableMonths.reduce((s, m) => s + m.amount, 0) / inc.variableMonths.length * 0.75 : 0);
    if (inc.secondaryEnabled) n += inc.secondaryNetMonthly ?? 0;
    return n;
  });

  /** Existing monthly debt payments — Cash Flow items in the "Debt" group. */
  readonly existingDebt = computed(() =>
    this.budget().filter(b => b.group === 'Debt').reduce((s, b) => s + b.amount, 0));

  readonly currentDtiVal = computed(() => currentDti(this.existingDebt(), this.grossIncome()));

  /** Current DSCR (pre-loan) = net income ÷ existing debt — the reciprocal of current DTI,
   *  but net-based since DSCR measures actual capacity to service debt from real cash flow.
   *  Shown instead of DTI once a rental DSCR metric is active, since DTI and DSCR measure
   *  the same underlying debt burden inversely and should never be shown side by side. */
  readonly currentDscrVal = computed(() => {
    const d = this.existingDebt();
    return d > 0 ? this.netIncomeVal() / d : null;
  });

  /** True once a DSCR metric is actually on screen — every other DTI display on this page
   *  should convert to DSCR to match, since mixing the two inverse measurements is confusing. */
  readonly dscrActive = computed(() => this.isRental() && this.creRent() > 0);
  readonly hasIncome = computed(() => this.grossIncome() > 0);

  // ── Proposed-loan inputs ────────────────────────────────────────────────────
  // Amortization is a standalone payoff-timeline tool, not a loan purpose, so it's
  // deliberately not in this list — see the separate toggle link in the template.
  readonly loanTypes: { id: LoanCategory; label: string; emoji: string }[] = [
    { id: 'mortgage',     label: 'Mortgage',            emoji: '🏠' },
    { id: 'rental',       label: 'Rental Property',     emoji: '🏘️' },
    { id: 'auto',         label: 'Auto Loan',           emoji: '🚗' },
    { id: 'personal',     label: 'Personal Loan',       emoji: '💼' },
    { id: 'student',      label: 'Student Loan',        emoji: '🎓' },
    { id: 'other',        label: 'Other Installment',   emoji: '📄' },
  ];
  category = signal<LoanCategory>('mortgage');

  amount        = signal(0);
  rate          = signal(0);
  term          = signal(360);            // months (amortization, for rental)
  purchasePrice = signal(0);              // rental only

  /** Defaults loan amount to 80% of purchase price (typical 20% down) — only while
   *  the user hasn't already entered a loan amount, so it never overwrites manual edits. */
  onPurchasePriceChange() {
    if (this.amount() === 0 && this.purchasePrice() > 0) {
      this.amount.set(Math.round(this.purchasePrice() * 0.8));
      this.amountDisplay.set(this.amount().toLocaleString('en-US', { maximumFractionDigits: 0 }));
    }
  }

  // ── Purchase-price display: grouped with commas when not being edited (same pattern as loan amount) ──
  purchasePriceDisplay = signal('');
  onPurchasePriceInput(v: string) {
    const raw = v.replace(/[^0-9.]/g, '');
    this.purchasePrice.set(+raw || 0);
    this.purchasePriceDisplay.set(raw);           // no commas while typing
    this.onPurchasePriceChange();
  }
  onPurchasePriceFocus() { this.purchasePriceDisplay.set(this.purchasePrice() ? String(this.purchasePrice()) : ''); }
  onPurchasePriceBlur()  { this.purchasePriceDisplay.set(this.purchasePrice() ? this.purchasePrice().toLocaleString('en-US', { maximumFractionDigits: 0 }) : ''); }

  /** % of purchase price currently financed — read-only view derived from loan amount. */
  readonly pctFinanced = computed(() => {
    const pp = this.purchasePrice();
    return pp > 0 ? (this.amount() / pp) * 100 : 0;
  });

  /** Sets loan amount from a chosen/typed financing percentage. */
  setPctFinanced(pct: number) {
    const pp = this.purchasePrice();
    if (!(pp > 0)) return;
    const clamped = Math.max(0, Math.min(100, pct));
    this.amount.set(Math.round(pp * clamped / 100));
    this.amountDisplay.set(this.amount().toLocaleString('en-US', { maximumFractionDigits: 0 }));
  }

  /** Rental property amortization is capped at 300 months (25 years) — not typically
   *  eligible for 30-year terms. Other loan categories are unaffected. */
  setTerm(months: number) {
    const clamped = Math.max(0, months);
    this.term.set(this.category() === 'rental' ? Math.min(300, clamped) : clamped);
  }

  // Payment override (lender quote)
  overridePayment = signal(false);
  manualPayment   = signal(0);
  /** True once the user has typed into the payment field directly — distinct from
   *  `manualPayment() !== 0`, since a 0%-rate auto-fill is also non-zero and must not
   *  be mistaken for a user-entered value (see constructor effect above). */
  manualPaymentEdited = signal(false);
  onManualPaymentInput(v: string) {
    this.manualPayment.set(+v || 0);
    this.manualPaymentEdited.set(true);
  }

  // Mortgage extras (all default 0)
  taxes = signal(0); insurance = signal(0); hoa = signal(0); mortgageIns = signal(0); otherHousing = signal(0);

  // Debt replacement
  replaces        = signal(false);
  replacedPayment = signal(0);

  /** Mortgage and Rental Property both use housing extras + a housing ratio. */
  readonly isHousing = computed(() => this.category() === 'mortgage' || this.category() === 'rental');

  /** Rental-property DSCR analysis is shown only for that category. */
  readonly isRental = computed(() => this.category() === 'rental');

  /** Amortization is a standalone payoff-timeline tool — its own category, not an
   *  add-on shown under every other loan type. When active, the DTI/DSCR-focused
   *  sections (current picture, debt replacement, Estimated Impact) are hidden. */
  readonly isAmortizationMode = computed(() => this.category() === 'amortization');

  // ── Rental property DSCR inputs ─────────────────────────────────────────────
  creRent          = signal(0);                          // estimated monthly gross rent
  creExpenseMethod = signal<CreExpenseMethod>('ratio');   // 'ratio' | 'own' — mutually exclusive
  creRatioPct      = signal(30);                          // quick-pick default
  creOwnExpenses   = signal(0);                           // monthly, user's own total operating expenses
  creVacancyPct    = signal(0);                           // optional advanced assumption, default 0
  creShowAdvanced  = signal(false);

  setCreRatio(pct: number) { this.creExpenseMethod.set('ratio'); this.creRatioPct.set(pct); }

  // ── Rental property DSCR calculations ───────────────────────────────────────
  readonly creAnnualGrossRent = computed(() => annualGrossRent(this.creRent()));

  readonly creEffectiveGrossIncome = computed(() =>
    effectiveGrossIncome(this.creAnnualGrossRent(), this.creVacancyPct()));

  /** Annual operating expenses per the selected, mutually-exclusive method. */
  readonly creAnnualOpEx = computed(() =>
    this.creExpenseMethod() === 'ratio'
      ? ratioOperatingExpenses(this.creAnnualGrossRent(), this.creRatioPct())
      : Math.max(0, this.creOwnExpenses() || 0) * 12);

  readonly creNoiAnnual = computed(() =>
    netOperatingIncome(this.creEffectiveGrossIncome(), this.creAnnualOpEx()));

  /** Reuses the same amortization inputs as the rest of the calculator. */
  readonly creAds = computed(() => annualDebtService(this.piPayment()));

  readonly creDscr = computed(() => propertyDscr(this.creNoiAnnual(), this.creAds()));

  /** Calculated principal & interest (or the user override). Amortization mode always
   *  treats the payment as directly editable — it's an existing loan with a real
   *  payment, not a "lender quote" scenario. */
  readonly piPayment = computed(() =>
    (this.overridePayment() || this.isAmortizationMode()) ? Math.max(0, this.manualPayment())
                           : monthlyPayment(this.amount(), this.rate(), this.term()));

  // ── Amortization calculator: payoff timeline with an additional-principal OR a proposed-payment scenario ──
  /** Whether the user's extra-payment entry means "on top of the current payment"
   *  or "a whole new payment amount to switch to." */
  extraPaymentMode = signal<'extra' | 'proposed'>('extra');
  extraPrincipal = signal(0);

  readonly canShowAmortization = computed(() =>
    this.isAmortizationMode() && this.amount() > 0 && this.piPayment() > 0);

  /** Baseline payoff at the current monthly payment — no extra principal / no proposed change. */
  readonly baselinePayoff = computed(() =>
    simulatePayoff(this.amount(), this.rate(), this.piPayment()));

  /** Payoff under the entered extra-principal or proposed-payment scenario — null until
   *  the user actually enters something, so the comparison only appears once there's
   *  something to compare. */
  readonly extraPayoff = computed(() => {
    const v = Math.max(0, this.extraPrincipal());
    if (v <= 0) return null;
    const payment = this.extraPaymentMode() === 'proposed' ? v : this.piPayment() + v;
    return simulatePayoff(this.amount(), this.rate(), payment);
  });

  readonly monthsSaved = computed(() => {
    const e = this.extraPayoff();
    return e && e.payoffPossible ? this.baselinePayoff().months - e.months : null;
  });

  readonly interestSaved = computed(() => {
    const e = this.extraPayoff();
    return e && e.payoffPossible ? this.baselinePayoff().totalInterest - e.totalInterest : null;
  });

  readonly housingExtras = computed(() => ({
    propertyTaxes: this.taxes(), insurance: this.insurance(), hoa: this.hoa(),
    mortgageInsurance: this.mortgageIns(), other: this.otherHousing(),
  }));

  /** Total proposed payment added to debt: P&I (+ housing extras for a mortgage). */
  readonly proposedPayment = computed(() =>
    this.piPayment() + (this.isHousing() ? housingExtrasTotal(this.housingExtras()) : 0));

  readonly totalHousingPayment = this.proposedPayment; // for mortgage display

  // ── Results ─────────────────────────────────────────────────────────────────
  readonly effectiveReplaced = computed(() => this.replaces() ? Math.max(0, this.replacedPayment()) : 0);

  readonly projectedDebtVal = computed(() =>
    projectedDebt(this.existingDebt(), this.proposedPayment(), this.effectiveReplaced()));

  readonly projectedDtiVal = computed(() => projectedDti({
    existingDebt: this.existingDebt(), grossIncome: this.grossIncome(),
    proposedPayment: this.proposedPayment(), replacedPayment: this.effectiveReplaced(),
  }));

  readonly dtiChangePts = computed(() => {
    const c = this.currentDtiVal(), p = this.projectedDtiVal();
    return (c === null || p === null) ? null : (p - c) * 100;
  });

  readonly housingRatioVal = computed(() =>
    this.isHousing() ? housingRatio(this.totalHousingPayment(), this.grossIncome()) : null);

  /** Global DSCR = NET monthly income ÷ total projected monthly debt (personal + this
   *  property's proposed payment) — net-based since DSCR measures actual capacity to
   *  service debt from real cash flow (unlike projected DTI, which stays gross-based). */
  readonly globalDscr = computed(() => {
    const debt = this.projectedDebtVal();
    return debt > 0 ? this.netIncomeVal() / debt : null;
  });

  readonly dtiBand = computed(() => {
    const p = this.projectedDtiVal();
    return p === null ? null : evaluateRange(p, REFERENCE_RANGES[this.category()]);
  });
  readonly housingBand = computed(() => {
    const h = this.housingRatioVal();
    return h === null ? null : evaluateRange(h, HOUSING_RATIO_RANGE);
  });

  // ── Validation ───────────────────────────────────────────────────────────────
  readonly replacementWarning = computed(() =>
    this.replaces() && this.effectiveReplaced() > this.existingDebt()
      ? 'The payment being replaced is larger than your total existing debt payments. Check the amount.'
      : '');

  readonly canCompute = computed(() =>
    this.hasIncome() && (this.overridePayment() ? this.manualPayment() >= 0 : this.amount() > 0 && this.term() > 0 && this.rate() >= 0));

  // ── Saved scenarios (Premium, localStorage, capped) ──────────────────────────
  private readonly SCENARIO_KEY = 'clarity_loan_scenarios';
  private readonly MAX_SCENARIOS = 6;
  scenarios = signal<SavedScenario[]>([]);
  showHow = signal(false);

  ngOnInit() {
    if (!this.hasAccess()) { this.loading.set(false); return; }
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.svc.getIncome().subscribe({ next: i => { this.income.set(i); done(); }, error: done });
    this.svc.getBudget().subscribe({ next: b => { this.budget.set(b); done(); }, error: done });
    try { this.scenarios.set(JSON.parse(localStorage.getItem(this.SCENARIO_KEY) ?? '[]')); } catch { /* ignore */ }
  }

  selectType(c: LoanCategory) {
    this.category.set(c);
    // Sensible default terms per category (months) — rental amortization defaults to 20 years, capped at 25.
    this.term.set(c === 'mortgage' ? 360 : c === 'rental' ? 240 : c === 'auto' ? 60 : c === 'student' ? 120 : 60);
  }

  // ── Loan-amount display: grouped with commas when not being edited ──────────
  amountDisplay = signal('');
  onAmountInput(v: string) {
    const raw = v.replace(/[^0-9.]/g, '');
    this.amount.set(+raw || 0);
    this.amountDisplay.set(raw);                 // no commas while typing
  }
  onAmountFocus() { this.amountDisplay.set(this.amount() ? String(this.amount()) : ''); }
  onAmountBlur()  { this.amountDisplay.set(this.amount() ? this.amount().toLocaleString('en-US', { maximumFractionDigits: 0 }) : ''); }

  saveScenario() {
    if (!this.canCompute() || this.projectedDtiVal() === null) return;
    const list = [...this.scenarios()];
    const name = `${this.loanTypes.find(t => t.id === this.category())?.label ?? 'Loan'} ${list.length + 1}`;
    list.unshift({
      name, category: this.category(), amount: this.amount(), rate: this.rate(), term: this.term(),
      payment: Math.round(this.proposedPayment()), projectedDtiPct: +(this.projectedDtiVal()! * 100).toFixed(1),
      ...(this.isRental() && this.creRent() > 0 ? {
        rentalDscr: {
          estimatedRent: this.creRent(), expenseMethod: this.creExpenseMethod(),
          expenseRatioPct: this.creRatioPct(), ownExpenses: this.creOwnExpenses(),
          vacancyPct: this.creVacancyPct(),
          noiAnnual: Math.round(this.creNoiAnnual()), adsAnnual: Math.round(this.creAds()),
          dscr: this.creDscr() === null ? null : +this.creDscr()!.toFixed(2),
        },
      } : {}),
    });
    const capped = list.slice(0, this.MAX_SCENARIOS);
    this.scenarios.set(capped);
    localStorage.setItem(this.SCENARIO_KEY, JSON.stringify(capped));
  }

  deleteScenario(i: number) {
    const list = this.scenarios().filter((_, idx) => idx !== i);
    this.scenarios.set(list);
    localStorage.setItem(this.SCENARIO_KEY, JSON.stringify(list));
  }

  // ── Formatting ────────────────────────────────────────────────────────────────
  fmt(v: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v); }
  pct(v: number | null) { return v === null ? '—' : `${(v * 100).toFixed(1)}%`; }
  pts(v: number | null) { return v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`; }
  fmtX(v: number | null) { return v === null ? '—' : `${v.toFixed(2)}x`; }
  fmtMonths(m: number) {
    const y = Math.floor(m / 12), rem = m % 12;
    if (y === 0) return `${m} mo`;
    if (rem === 0) return `${y} yr${y === 1 ? '' : 's'}`;
    return `${y} yr${y === 1 ? '' : 's'} ${rem} mo`;
  }
}
