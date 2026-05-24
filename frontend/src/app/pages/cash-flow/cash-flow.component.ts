import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { ToastService } from '../../services/toast.service';
import { BudgetItem, BudgetGroup, IncomeData } from '../../models/finance.models';
import { NumericDirective } from '../../directives/numeric.directive';

const TARGETS_KEY  = 'clarity_budget_targets';
const K401_KEY     = 'clarity_401k_pct';

@Component({
  selector: 'app-cash-flow',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, PercentPipe, NumericDirective],
  templateUrl: './cash-flow.component.html',
  styleUrl: './cash-flow.component.scss'
})
export class CashFlowComponent implements OnInit {
  private svc   = inject(FinanceService);
  private toast = inject(ToastService);

  income      = signal<IncomeData>({ type: 'stable', grossMonthlyIncome: 0, netMonthlyIncome: 0, variableMonths: [] });
  budgetItems = signal<BudgetItem[]>([]);
  loading     = signal(true);
  showAnnual  = signal(false);    // monthly ↔ annual toggle
  editingTarget = signal<string | null>(null);  // which group target is being edited

  // 401(k) — informational only, stored in localStorage, NOT subtracted from FCF
  retirement401kPct = signal(parseFloat(localStorage.getItem(K401_KEY) ?? '0') || 0);
  retirement401kAmt = computed(() => this.grossIncome() * this.retirement401kPct() / 100);

  // 50/30/20 — collapsed by default
  show503020 = signal(false);

  // Per-group budget targets stored in localStorage
  private _savedTargets: Record<string, number> = JSON.parse(localStorage.getItem(TARGETS_KEY) ?? '{}');
  groupTargets = signal<Record<string, number>>(this._savedTargets);

  expandedGroups = signal<Set<string>>(this._loadGroupState());

  groups: { key: BudgetGroup; label: string; color: string; bg: string; sub: string }[] = [
    { key: 'Debt',     label: 'Debt Service',          color: '#D85A30', bg: '#FEF2F2', sub: 'Mortgage, cards, loans'     },
    { key: 'Fixed',    label: 'Fixed Expenses',        color: '#378ADD', bg: '#F0FBF7', sub: 'Insurance, phone, internet' },
    { key: 'Variable', label: 'Variable Expenses',     color: '#7F77DD', bg: '#F5F3FF', sub: 'Groceries, utilities, dining'},
    { key: 'Savings',  label: 'Savings & Investments', color: '#1D9E75', bg: '#F0FDF9', sub: 'IRA, brokerage, emergency fund' },
  ];

  // ── Income ────────────────────────────────────────────────────────────────
  grossIncome = computed(() => {
    if (this.income().type === 'stable') return this.income().grossMonthlyIncome;
    const months = this.income().variableMonths;
    return months.length ? months.reduce((s, m) => s + m.amount, 0) / months.length : 0;
  });
  netIncome = computed(() => {
    if (this.income().type === 'stable') return this.income().netMonthlyIncome;
    return this.grossIncome() * 0.75;
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
  dispGross    = computed(() => this.grossIncome() * this.mult());
  dispNet      = computed(() => this.netIncome() * this.mult());
  dispOutflow  = computed(() => this.totalOutflow() * this.mult());
  dispFCF      = computed(() => this.freeCashFlow() * this.mult());
  dispSavings  = computed(() => this.totalSavings() * this.mult());
  dispFixed    = computed(() => this.totalFixed() * this.mult());
  dispVariable = computed(() => this.totalVariable() * this.mult());
  dispDebt     = computed(() => this.totalDebt() * this.mult());

  // Annual savings total — always annualized, includes 401k estimate when entered
  annualSavingsTotal = computed(() => (this.totalSavings() + this.retirement401kAmt()) * 12);

  // Insights collapse toggle — show first item by default
  showAllInsights = signal(false);

  // ── Ratios ────────────────────────────────────────────────────────────────
  dti = computed(() => this.grossIncome() > 0 ? this.totalDebt() / this.grossIncome() : 0);
  // When 401k is entered: include it and compare against gross (pre-tax basis).
  // When no 401k entered: compare budget savings against net income (take-home basis).
  savingsRate = computed(() => {
    const k401 = this.retirement401kAmt();
    if (k401 > 0 && this.grossIncome() > 0) {
      return (this.totalSavings() + k401) / this.grossIncome();
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
  savingsPct  = computed(() => this.grossIncome() > 0 ? this.totalSavings() / this.grossIncome() : 0);

  benchmark503020 = computed(() => [
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
      detail: 'Savings & investments'
    },
  ]);

  // ── Spending bar ──────────────────────────────────────────────────────────
  barSegments = computed(() => {
    const net = this.netIncome();
    if (!net) return [];
    return [
      { label: 'Debt Service',         value: this.totalDebt(),     pct: Math.min(this.totalDebt() / net, 1),     color: '#D85A30' },
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

  // ── Budget targets ────────────────────────────────────────────────────────
  getTarget(group: string): number { return this.groupTargets()[group] ?? 0; }

  setTarget(group: string, val: string) {
    const n = Math.max(0, parseFloat(val) || 0);
    const updated = { ...this.groupTargets(), [group]: n };
    this.groupTargets.set(updated);
    localStorage.setItem(TARGETS_KEY, JSON.stringify(updated));
    this.editingTarget.set(null);
  }

  targetProgress(group: string): number {
    const target = this.getTarget(group);
    if (!target) return 0;
    return Math.min(this.sumGroup(group as BudgetGroup) / target, 1);
  }

  targetOver(group: string): boolean {
    const t = this.getTarget(group);
    return t > 0 && this.sumGroup(group as BudgetGroup) > t;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.svc.getIncome().subscribe({ next: i => { this.income.set(i); done(); }, error: done });
    this.svc.getBudget().subscribe({ next: b => { this.budgetItems.set(b); done(); }, error: done });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  sumGroup(group: BudgetGroup) {
    return this.budgetItems().filter(b => b.group === group).reduce((s, b) => s + b.amount, 0);
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
    const gross = parseFloat(val) || 0;
    this.income.update(i => ({ ...i, grossMonthlyIncome: gross }));
    this.saveIncome();
  }
  updateNet(val: string) {
    this.income.update(i => ({ ...i, netMonthlyIncome: parseFloat(val) || 0 }));
    this.saveIncome();
  }
  updateVariableMonth(idx: number, val: string) {
    const months = [...this.income().variableMonths];
    months[idx] = { ...months[idx], amount: parseFloat(val) || 0 };
    this.income.update(i => ({ ...i, variableMonths: months }));
    this.saveIncome();
  }
  saveIncome() { this.svc.updateIncome(this.income()).subscribe(); }

  update401k(val: string) {
    const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
    this.retirement401kPct.set(pct);
    localStorage.setItem(K401_KEY, String(pct));
  }

  // ── Budget item CRUD ──────────────────────────────────────────────────────
  updateItem(item: BudgetItem, field: 'name' | 'amount', val: string) {
    const latest = this.budgetItems().find(b => b.id === item.id) ?? item;
    const amount = field === 'amount' ? Math.max(0, parseFloat(val) || 0) : latest.amount;
    const updated = { ...latest, [field]: field === 'amount' ? amount : val.trim() || latest.name };
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
