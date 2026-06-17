import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { PlanAccessService } from '../../services/plan-access.service';
import { NumericDirective } from '../../directives/numeric.directive';
import { BudgetItem, IncomeData } from '../../models/finance.models';
import {
  LoanCategory, monthlyPayment, housingExtrasTotal, currentDti, projectedDti,
  projectedDebt, housingRatio, evaluateRange, REFERENCE_RANGES, HOUSING_RATIO_RANGE,
} from '../../shared/loan-impact';

interface SavedScenario {
  name: string; category: LoanCategory; amount: number; rate: number; term: number;
  payment: number; projectedDtiPct: number;
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

  // ── Source data (read-only copy of Cash Flow) ──────────────────────────────
  private income = signal<IncomeData | null>(null);
  private budget = signal<BudgetItem[]>([]);
  loading = signal(true);

  /** Gross monthly income — mirrors the Dashboard/Cash Flow/PFS formula exactly. */
  readonly grossIncome = computed(() => {
    const inc = this.income();
    if (!inc) return 0;
    let g = inc.type === 'stable'
      ? inc.grossMonthlyIncome
      : (inc.variableMonths?.length ? inc.variableMonths.reduce((s, m) => s + m.amount, 0) / inc.variableMonths.length : 0);
    if (localStorage.getItem('clarity_second_income_enabled') === '1') {
      try { g += (JSON.parse(localStorage.getItem('clarity_second_income') ?? '{}').gross) ?? 0; } catch { /* ignore */ }
    }
    return g;
  });

  /** Existing monthly debt payments — Cash Flow items in the "Debt" group. */
  readonly existingDebt = computed(() =>
    this.budget().filter(b => b.group === 'Debt').reduce((s, b) => s + b.amount, 0));

  readonly currentDtiVal = computed(() => currentDti(this.existingDebt(), this.grossIncome()));
  readonly hasIncome = computed(() => this.grossIncome() > 0);

  // ── Proposed-loan inputs ────────────────────────────────────────────────────
  readonly loanTypes: { id: LoanCategory; label: string; emoji: string }[] = [
    { id: 'mortgage', label: 'Mortgage',        emoji: '🏠' },
    { id: 'auto',     label: 'Auto Loan',       emoji: '🚗' },
    { id: 'personal', label: 'Personal Loan',   emoji: '💼' },
    { id: 'student',  label: 'Student Loan',    emoji: '🎓' },
    { id: 'other',    label: 'Other Installment', emoji: '📄' },
  ];
  category = signal<LoanCategory>('mortgage');

  amount = signal(0);
  rate   = signal(0);
  term   = signal(360);            // months

  // Payment override (lender quote)
  overridePayment = signal(false);
  manualPayment   = signal(0);

  // Mortgage extras (all default 0)
  taxes = signal(0); insurance = signal(0); hoa = signal(0); mortgageIns = signal(0); otherHousing = signal(0);

  // Debt replacement
  replaces        = signal(false);
  replacedPayment = signal(0);

  readonly isMortgage = computed(() => this.category() === 'mortgage');

  /** Calculated principal & interest (or the user override). */
  readonly piPayment = computed(() =>
    this.overridePayment() ? Math.max(0, this.manualPayment())
                           : monthlyPayment(this.amount(), this.rate(), this.term()));

  readonly housingExtras = computed(() => ({
    propertyTaxes: this.taxes(), insurance: this.insurance(), hoa: this.hoa(),
    mortgageInsurance: this.mortgageIns(), other: this.otherHousing(),
  }));

  /** Total proposed payment added to debt: P&I (+ housing extras for a mortgage). */
  readonly proposedPayment = computed(() =>
    this.piPayment() + (this.isMortgage() ? housingExtrasTotal(this.housingExtras()) : 0));

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
    this.isMortgage() ? housingRatio(this.totalHousingPayment(), this.grossIncome()) : null);

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
    // Sensible default terms per category (months)
    this.term.set(c === 'mortgage' ? 360 : c === 'auto' ? 60 : c === 'student' ? 120 : 60);
  }

  saveScenario() {
    if (!this.canCompute() || this.projectedDtiVal() === null) return;
    const list = [...this.scenarios()];
    const name = `${this.loanTypes.find(t => t.id === this.category())?.label ?? 'Loan'} ${list.length + 1}`;
    list.unshift({
      name, category: this.category(), amount: this.amount(), rate: this.rate(), term: this.term(),
      payment: Math.round(this.proposedPayment()), projectedDtiPct: +(this.projectedDtiVal()! * 100).toFixed(1),
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
}
