import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { ToastService } from '../../services/toast.service';
import { BudgetItem, BudgetGroup, IncomeData, ContributionInput, ContributionMode, emptyIncome } from '../../models/finance.models';
import { NumericDirective } from '../../directives/numeric.directive';
import { AuthService } from '../../services/auth.service';
import { TabTutorialComponent, TutorialStep, shouldShowTutorial, tutorialKey } from '../../components/tab-tutorial/tab-tutorial.component';
import { userScopedKey } from '../../services/scoped-storage';

const SECOND_INC_KEY     = 'clarity_second_income';
const SECOND_INC_EN_KEY  = 'clarity_second_income_enabled';
const RETIREMENT_KEY     = 'clarity_retirement';      // monthly $ amounts
const LEGACY_401K_KEY    = 'clarity_401k_pct';        // old % of primary gross
const LEGACY_401K_2_KEY  = 'clarity_401k_pct_2';      // old % of second gross

type RetType = 'trad401k' | 'roth401k' | 'tradIra' | 'rothIra';

@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, PercentPipe, NumericDirective, TabTutorialComponent],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.scss'
})
export class CashFlowComponent implements OnInit {
  private svc   = inject(FinanceService);
  private toast = inject(ToastService);
  private auth  = inject(AuthService);

  // ── Tab tutorial ─────────────────────────────────────────────────────────
  readonly TUTORIAL_KEY = 'clarity_tutorial_cashflow';
  readonly scopedTutorialKey = tutorialKey(this.TUTORIAL_KEY, this.auth.currentUser()?.id);
  showTutorial = signal(shouldShowTutorial(this.TUTORIAL_KEY, this.auth.currentUser()?.id));
  readonly tutorialSteps: TutorialStep[] = [
    { icon: '💸', title: 'Cash Flow at a Glance', body: 'Enter your income and expenses to see your free cash flow, DTI ratio, savings rate, and a personalized budget breakdown.' },
    { icon: '📋', title: 'Budget by Category', body: 'Expenses are grouped into Debt, Fixed, Variable, and Savings. Expand each to add line items and set monthly budget targets.' },
    { icon: '📊', title: '50/30/20 Benchmark', body: 'See how your spending compares to the 50/30/20 rule and get plain-English insights on your cash flow health.' },
  ];

  // Server income record is the SOURCE OF TRUTH for primary + secondary income
  // and retirement contributions (persisted, feeds Dashboard/PFS/Compare).
  income      = signal<IncomeData>(emptyIncome());
  budgetItems = signal<BudgetItem[]>([]);
  loading     = signal(true);
  showAnnual  = signal(false);    // monthly ↔ annual toggle

  // ── Retirement contributions ──────────────────────────────────────────────
  // Raw mode+value lives in income().retirement; cm() resolves each to monthly $.
  // % mode is computed off the combined monthly gross income and auto-updates.
  private cm(c: ContributionInput): number {
    return c?.mode === 'pct' ? this.grossIncome() * (c.value || 0) / 100 : (c?.value || 0);
  }
  /** Resolved monthly $ per contribution type (employer match is already $/mo). */
  readonly retirement = computed(() => {
    const r = this.income().retirement;
    return {
      trad401k: this.cm(r.trad401k), roth401k: this.cm(r.roth401k),
      tradIra: this.cm(r.tradIra),   rothIra: this.cm(r.rothIra),
      employerMatch: r.employerMatchMonthly || 0,
    };
  });
  /** Employee contributions only (excludes employer match) — the user's own savings. */
  employeeRetirement = computed(() => {
    const r = this.retirement();
    return r.trad401k + r.roth401k + r.tradIra + r.rothIra;
  });
  /** Total retirement savings = employee contributions + employer match. */
  totalRetirementSavings = computed(() => this.employeeRetirement() + this.retirement().employerMatch);

  // ── Second income (spousal / partner) — derived from the server record ─────
  secondIncomeEnabled = computed(() => this.income().secondaryEnabled);
  secondIncome        = computed(() => ({ gross: this.income().secondaryGrossMonthly, net: this.income().secondaryNetMonthly }));

  /** Per-user localStorage key — only used for the one-time localStorage→server migration. */
  private k(base: string): string { return userScopedKey(base, this.auth.currentUser()?.id ?? null); }

  // raw (editable) retirement value/mode for the template inputs
  readonly retTypes: { key: RetType; label: string }[] = [
    { key: 'trad401k', label: 'Traditional 401(k)' },
    { key: 'roth401k', label: 'Roth 401(k)' },
    { key: 'tradIra',  label: 'Traditional IRA' },
    { key: 'rothIra',  label: 'Roth IRA' },
  ];
  retModeValue(field: RetType): number { return this.income().retirement[field].value; }
  retMode(field: RetType): ContributionMode { return this.income().retirement[field].mode; }
  /** Resolved monthly $ for a contribution type (for the "≈ $X/mo" hint in % mode). */
  retirementResolved(field: RetType): number { return this.retirement()[field]; }

  // 50/30/20 — collapsed by default
  show503020 = signal(false);

  expandedGroups = signal<Set<string>>(this._loadGroupState());

  groups: { key: BudgetGroup; label: string; color: string; bg: string; sub: string }[] = [
    { key: 'Debt',     label: 'Debt Service',          color: '#EF4444', bg: '#FEF2F2', sub: 'Mortgage, cards, loans'     },
    { key: 'Fixed',    label: 'Fixed Expenses',        color: '#378ADD', bg: '#F0FBF7', sub: 'Insurance, phone, internet' },
    { key: 'Variable', label: 'Variable Expenses',     color: '#7F77DD', bg: '#F5F3FF', sub: 'Groceries, utilities, dining'},
    { key: 'Savings',  label: 'Savings & Investments', color: '#1D9E75', bg: '#F0FDF9', sub: 'IRA, brokerage, emergency fund' },
  ];

  // ── Income ────────────────────────────────────────────────────────────────
  // Primary income only (used for 401k calculation basis)
  primaryGrossIncome = computed(() => {
    if (this.income().type === 'stable') return this.income().grossMonthlyIncome;
    const months = this.income().variableMonths;
    return months.length ? months.reduce((s, m) => s + m.amount, 0) / months.length : 0;
  });

  // Combined gross (primary + second if enabled)
  grossIncome = computed(() => {
    const primary = this.primaryGrossIncome();
    if (!this.secondIncomeEnabled()) return primary;
    return primary + this.secondIncome().gross;
  });

  // Primary net only
  primaryNetIncome = computed(() => {
    if (this.income().type === 'stable') return this.income().netMonthlyIncome;
    return this.primaryGrossIncome() * 0.75;
  });

  // Combined net (primary + second if enabled)
  netIncome = computed(() => {
    const primary = this.primaryNetIncome();
    if (!this.secondIncomeEnabled()) return primary;
    return primary + this.secondIncome().net;
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  totalFixed    = computed(() => this.sumGroup('Fixed'));
  totalVariable = computed(() => this.sumGroup('Variable'));
  totalDebt     = computed(() => this.sumGroup('Debt'));
  totalSavings  = computed(() => this.sumGroup('Savings'));
  totalOutflow  = computed(() => this.totalFixed() + this.totalVariable() + this.totalDebt() + this.totalSavings());
  freeCashFlow  = computed(() => this.netIncome() - this.totalOutflow());

  // Annual projections
  mult = computed(() => this.showAnnual() ? 12 : 1);
  readonly periodLabel = computed(() => this.showAnnual() ? 'annual' : 'monthly');

  /** Convert a stored monthly value to the currently-selected input period (for [value]). */
  disp(monthly: number | null | undefined): number {
    if (monthly == null) return 0;
    return Math.round(monthly * this.mult() * 100) / 100;
  }
  /** Convert a value typed in the current period back to the canonical monthly value (for storage). */
  private toMonthly(val: string): number {
    return Math.max(0, (parseFloat(val) || 0) / this.mult());
  }

  dispGross    = computed(() => this.grossIncome() * this.mult());
  dispNet      = computed(() => this.netIncome() * this.mult());
  dispOutflow  = computed(() => this.totalOutflow() * this.mult());
  dispFCF      = computed(() => this.freeCashFlow() * this.mult());
  dispSavings  = computed(() => this.totalSavings() * this.mult());
  dispFixed    = computed(() => this.totalFixed() * this.mult());
  dispVariable = computed(() => this.totalVariable() * this.mult());
  dispDebt     = computed(() => this.totalDebt() * this.mult());

  // Annual savings total — always annualized, includes retirement contributions + match
  annualSavingsTotal = computed(() => (this.totalSavings() + this.totalRetirementSavings()) * 12);

  // Insights collapse toggle — show first item by default
  showAllInsights = signal(false);

  // ── Ratios ────────────────────────────────────────────────────────────────
  dti = computed(() => this.grossIncome() > 0 ? this.totalDebt() / this.grossIncome() : 0);
  // When 401k is entered: include it and compare against gross (pre-tax basis).
  // When no 401k entered: compare budget savings against net income (take-home basis).
  savingsRate = computed(() => {
    const ret = this.totalRetirementSavings();
    if (ret > 0 && this.grossIncome() > 0) {
      return (this.totalSavings() + ret) / this.grossIncome();
    }
    return this.netIncome() > 0 ? this.totalSavings() / this.netIncome() : 0;
  });
  housingCost = computed(() => {
    const keywords = ['mortgage', 'rent'];
    const item = this.budgetItems().find(b => keywords.some(k => b.name.toLowerCase().includes(k)));
    return item?.amount ?? 0;
  });
  housingRatio = computed(() => this.grossIncome() > 0 ? this.housingCost() / this.grossIncome() : 0);
  fcfRate      = computed(() => this.netIncome() > 0 ? this.freeCashFlow() / this.netIncome() : 0);

  // ── 50/30/20 benchmark ────────────────────────────────────────────────────
  // Needs = Debt + Fixed (target 50%), Wants = Variable (30%), Savings (20%)
  needsTotal  = computed(() => this.totalDebt() + this.totalFixed());
  needsRatio  = computed(() => this.grossIncome() > 0 ? this.needsTotal() / this.grossIncome() : 0);
  wantsRatio  = computed(() => this.grossIncome() > 0 ? this.totalVariable() / this.grossIncome() : 0);
  savingsPct = computed(() => {
    if (this.grossIncome() === 0) return 0;
    return (this.totalSavings() + this.totalRetirementSavings()) / this.grossIncome();
  });

  benchmark503020 = computed(() => {
    const k401Total = this.totalRetirementSavings();
    return [
      {
        label: 'Needs', actual: this.needsRatio(), target: 0.50,
        value: this.needsTotal(), color: '#378ADD',
        status: this.needsRatio() <= 0.50 ? 'good' : this.needsRatio() <= 0.60 ? 'caution' : 'over',
        detail: 'Debt + fixed expenses'
      },
      {
        label: 'Wants', actual: this.wantsRatio(), target: 0.30,
        value: this.totalVariable(), color: '#7F77DD',
        status: this.wantsRatio() <= 0.30 ? 'good' : this.wantsRatio() <= 0.40 ? 'caution' : 'over',
        detail: 'Variable / discretionary'
      },
      {
        label: 'Savings', actual: this.savingsPct(), target: 0.20,
        value: this.totalSavings(), color: '#1D9E75',
        status: this.savingsPct() >= 0.20 ? 'good' : this.savingsPct() >= 0.10 ? 'caution' : 'over',
        detail: k401Total > 0 ? 'Savings + retirement (incl. match)' : 'Savings & investments'
      },
    ];
  });

  // ── Spending bar ──────────────────────────────────────────────────────────
  barSegments = computed(() => {
    const net = this.netIncome();
    if (!net) return [];
    return [
      { label: 'Debt Service',         value: this.totalDebt(),     pct: Math.min(this.totalDebt() / net, 1),     color: '#EF4444' },
      { label: 'Fixed Expenses',       value: this.totalFixed(),    pct: Math.min(this.totalFixed() / net, 1),    color: '#378ADD' },
      { label: 'Variable Expenses',    value: this.totalVariable(), pct: Math.min(this.totalVariable() / net, 1), color: '#7F77DD' },
      { label: 'Savings & Investments',value: this.totalSavings(),  pct: Math.min(this.totalSavings() / net, 1),  color: '#1D9E75' },
    ].filter(s => s.value > 0);
  });

  // ── Insights ──────────────────────────────────────────────────────────────
  insights = computed(() => {
    const msgs: { text: string; tone: 'good' | 'caution' | 'neutral' }[] = [];
    const fcf = this.freeCashFlow();
    const net = this.netIncome();
    if (!net) return [];

    // FCF
    if (fcf > 0) msgs.push({ text: `You have ${this.fmt(fcf)} left over each month after all expenses. That's ${this.fmt(fcf * 12)} a year of flexibility.`, tone: 'good' });
    else if (fcf < 0) msgs.push({ text: `You're spending ${this.fmt(Math.abs(fcf))} more than you earn each month. This is worth reviewing soon.`, tone: 'caution' });

    // DTI
    const dti = this.dti();
    if (dti > 0.43) msgs.push({ text: `Your DTI is ${(dti * 100).toFixed(0)}% — above the 43% threshold most lenders use for qualified mortgages. This may limit new borrowing.`, tone: 'caution' });
    else if (dti > 0.36) msgs.push({ text: `Your DTI is ${(dti * 100).toFixed(0)}%. Approaching the 43% lender cutoff — room to grow, but watch new debt carefully.`, tone: 'neutral' });
    else if (dti > 0) msgs.push({ text: `Your DTI is ${(dti * 100).toFixed(0)}% — healthy. Under 36% puts you in a strong position with most lenders.`, tone: 'good' });

    // Savings rate
    const sr = this.savingsRate();
    if (sr >= 0.2) msgs.push({ text: `Your savings rate is ${(sr * 100).toFixed(0)}% — excellent. You're on track to build meaningful wealth over time.`, tone: 'good' });
    else if (sr >= 0.10) msgs.push({ text: `Your savings rate is ${(sr * 100).toFixed(0)}%. Aim for 20% to build a strong financial cushion faster.`, tone: 'neutral' });
    else if (sr > 0) msgs.push({ text: `Your savings rate is ${(sr * 100).toFixed(0)}%. Even small increases here compound significantly over time.`, tone: 'caution' });

    // Housing
    const hr = this.housingRatio();
    if (hr > 0.35) msgs.push({ text: `Housing is ${(hr * 100).toFixed(0)}% of gross income — above the typical 28–30% guideline. Worth monitoring as rates or rent change.`, tone: 'caution' });

    // Annual savings impact
    const annualSavings = (this.totalSavings() + Math.max(0, fcf)) * 12;
    if (annualSavings > 0 && net > 0) {
      msgs.push({ text: `At this rate, you're on track to accumulate ${this.fmt(annualSavings)} this year between savings buckets and free cash flow.`, tone: 'good' });
    }

    return msgs;
  });

  // ── Per-item Variable budgets ───────────────────────────────────────────────
  // Budgets are planning values for Variable expenses only. Never an actual expense.
  itemHasBudget(item: BudgetItem): boolean { return item.budget != null && item.budget > 0; }
  /** Remaining (positive) or over-budget (negative) for an item with a budget. */
  itemRemaining(item: BudgetItem): number { return (item.budget ?? 0) - item.amount; }
  itemOver(item: BudgetItem): boolean { return this.itemHasBudget(item) && item.amount > (item.budget ?? 0); }
  /** Percentage of budget used (0–…); guarded against divide-by-zero. */
  itemPctUsed(item: BudgetItem): number {
    if (!this.itemHasBudget(item)) return 0;
    return item.amount / (item.budget ?? 1);
  }

  // ── Retirement updates (persist to the server income record) ────────────────
  // Contribution value is raw (% when mode='pct', $/mo when mode='amount') — it is
  // NOT run through the annual toggle. Employer match is always $/mo.
  updateRetirementValue(field: RetType, val: string) {
    const value = Math.max(0, parseFloat(val) || 0);
    this.income.update(i => ({ ...i, retirement: { ...i.retirement, [field]: { ...i.retirement[field], value } } }));
    this.saveIncome();
  }
  setRetirementMode(field: RetType, mode: ContributionMode) {
    this.income.update(i => ({ ...i, retirement: { ...i.retirement, [field]: { ...i.retirement[field], mode } } }));
    this.saveIncome();
  }
  updateEmployerMatch(val: string) {
    const v = Math.max(0, parseFloat(val) || 0);
    this.income.update(i => ({ ...i, retirement: { ...i.retirement, employerMatchMonthly: v } }));
    this.saveIncome();
  }

  /** One-time migration of device-local (localStorage) secondary income + retirement
   *  into the server record, so existing users keep their values. Mutates `inc`;
   *  returns true if anything was migrated (caller then saves + we clear the keys). */
  private _migrateLocalToServer(inc: IncomeData): boolean {
    let changed = false;
    if (!inc.secondaryEnabled && inc.secondaryGrossMonthly === 0 && inc.secondaryNetMonthly === 0) {
      const en = localStorage.getItem(this.k(SECOND_INC_EN_KEY)) === '1';
      let s: { gross?: number; net?: number } | null = null;
      try { s = JSON.parse(localStorage.getItem(this.k(SECOND_INC_KEY)) ?? 'null'); } catch { /* ignore */ }
      if (en || (s && (s.gross || s.net))) {
        inc.secondaryEnabled = en;
        inc.secondaryGrossMonthly = s?.gross || 0;
        inc.secondaryNetMonthly = s?.net || 0;
        changed = true;
      }
    }
    const r = inc.retirement;
    const retEmpty = !r.trad401k.value && !r.roth401k.value && !r.tradIra.value && !r.rothIra.value && !r.employerMatchMonthly;
    if (retEmpty) {
      let old: Record<string, number> | null = null;
      try { old = JSON.parse(localStorage.getItem(this.k(RETIREMENT_KEY)) ?? 'null'); } catch { /* ignore */ }
      if (old) {
        r.trad401k = { mode: 'amount', value: old['trad401k'] || 0 };
        r.roth401k = { mode: 'amount', value: old['roth401k'] || 0 };
        r.tradIra  = { mode: 'amount', value: old['tradIra']  || 0 };
        r.rothIra  = { mode: 'amount', value: old['rothIra']  || 0 };
        r.employerMatchMonthly = old['employerMatch'] || 0;
        changed = true;
      }
    }
    if (changed) {
      for (const key of [SECOND_INC_EN_KEY, SECOND_INC_KEY, RETIREMENT_KEY, LEGACY_401K_KEY, LEGACY_401K_2_KEY]) {
        localStorage.removeItem(this.k(key));
      }
    }
    return changed;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.svc.getIncome().subscribe({
      next: i => {
        // Defensive merge so the new fields always exist (older responses / null).
        const base = emptyIncome();
        const merged: IncomeData = {
          ...base, ...i,
          retirement: { ...base.retirement, ...(i.retirement ?? {}) },
        };
        const changed = this._migrateLocalToServer(merged);
        this.income.set(merged);
        if (changed) this.saveIncome();   // push migrated local values up once
        done();
      },
      error: done,
    });
    this.svc.getBudget().subscribe({ next: b => { this.budgetItems.set(b); done(); }, error: done });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  sumGroup(group: BudgetGroup) {
    return this.budgetItems().filter(b => b.group === group).reduce((s, b) => s + b.amount, 0);
  }
  /** Parent aggregation only: sum of each item's own budget (Variable planning). */
  groupBudget(group: BudgetGroup) {
    return this.budgetItems().filter(b => b.group === group).reduce((s, b) => s + (b.budget ?? 0), 0);
  }
  /** True when any item in the group has a budget set (controls the parent budget summary). */
  groupHasBudget(group: BudgetGroup) {
    return this.budgetItems().some(b => b.group === group && (b.budget ?? 0) > 0);
  }
  itemsForGroup(group: BudgetGroup) { return this.budgetItems().filter(b => b.group === group); }
  private _loadGroupState(): Set<string> {
    const saved = localStorage.getItem('clarity-cat-cf');
    if (saved !== null) return new Set(JSON.parse(saved));
    return localStorage.getItem('clarity-expand-default') === 'true'
      ? new Set(['Fixed', 'Variable', 'Debt', 'Savings'])
      : new Set();
  }

  toggleGroup(g: string) {
    const s = new Set(this.expandedGroups());
    s.has(g) ? s.delete(g) : s.add(g);
    this.expandedGroups.set(s);
    localStorage.setItem('clarity-cat-cf', JSON.stringify([...s]));
  }
  isExpanded(g: string) { return this.expandedGroups().has(g); }

  // ── Income updates ────────────────────────────────────────────────────────
  setIncomeType(type: 'stable' | 'variable') {
    this.income.update(i => {
      // Auto-populate last 6 calendar months when switching to variable with no months
      if (type === 'variable' && (!i.variableMonths || i.variableMonths.length === 0)) {
        const now = new Date();
        const variableMonths = Array.from({ length: 6 }, (_, k) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
          return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, amount: 0 };
        });
        return { ...i, type, variableMonths };
      }
      return { ...i, type };
    });
    this.saveIncome();
  }
  updateGross(val: string) {
    this.income.update(i => ({ ...i, grossMonthlyIncome: this.toMonthly(val) }));
    this.saveIncome();
  }
  updateNet(val: string) {
    this.income.update(i => ({ ...i, netMonthlyIncome: this.toMonthly(val) }));
    this.saveIncome();
  }
  updateVariableMonth(idx: number, val: string) {
    const months = [...this.income().variableMonths];
    months[idx] = { ...months[idx], amount: parseFloat(val) || 0 };
    this.income.update(i => ({ ...i, variableMonths: months }));
    this.saveIncome();
  }
  saveIncome() { this.svc.updateIncome(this.income()).subscribe(); }

  // ── Second Income (persisted to the server income record) ──────────────────
  toggleSecondIncome() {
    this.income.update(i => ({ ...i, secondaryEnabled: !i.secondaryEnabled }));
    this.saveIncome();
  }
  updateSecondGross(val: string) {
    this.income.update(i => ({ ...i, secondaryGrossMonthly: this.toMonthly(val) }));
    this.saveIncome();
  }
  updateSecondNet(val: string) {
    this.income.update(i => ({ ...i, secondaryNetMonthly: this.toMonthly(val) }));
    this.saveIncome();
  }

  // ── Budget item CRUD ──────────────────────────────────────────────────────
  updateItem(item: BudgetItem, field: 'name' | 'amount' | 'budget', val: string) {
    const latest = this.budgetItems().find(b => b.id === item.id) ?? item;
    let updated: BudgetItem;
    if (field === 'amount') {
      updated = { ...latest, amount: this.toMonthly(val) };
    } else if (field === 'budget') {
      updated = { ...latest, budget: val.trim() === '' ? null : this.toMonthly(val) };
    } else {
      updated = { ...latest, name: val.trim() || latest.name };
    }
    this.svc.updateBudgetItem(item.id, updated).subscribe(res =>
      this.budgetItems.update(list => list.map(b => b.id === res.id ? res : b))
    );
  }
  addItem(group: BudgetGroup) {
    this.svc.createBudgetItem({ group, name: 'New Item', amount: 0 }).subscribe(item =>
      this.budgetItems.update(list => [...list, item])
    );
  }
  deleteItem(id: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    this.svc.deleteBudgetItem(id).subscribe(() =>
      this.budgetItems.update(list => list.filter(b => b.id !== id))
    );
  }

  // ── Formatting ────────────────────────────────────────────────────────────
  fmtMonth(m: string): string {
    // Accepts "2025-11" or "November" — returns "Nov 2025" or original string
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [year, month] = m.split('-');
      const d = new Date(+year, +month - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return m;
  }

  fmt(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
  barWidth(pct: number) { return `${Math.max(pct * 100, 0.5)}%`; }
  benchmarkWidth(actual: number, target: number): string {
    return `${Math.min((actual / (target * 1.5)) * 100, 100).toFixed(1)}%`;
  }
}
