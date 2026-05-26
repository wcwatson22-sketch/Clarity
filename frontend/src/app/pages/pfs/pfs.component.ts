import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { Account, BudgetItem, IncomeData } from '../../models/finance.models';

@Component({
  selector: 'app-pfs',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, PercentPipe, DatePipe, RouterLink],
  templateUrl: './pfs.component.html',
  styleUrl: './pfs.component.scss'
})
export class PfsComponent implements OnInit {
  private svc  = inject(FinanceService);
  private auth = inject(AuthService);

  accounts    = signal<Account[]>([]);
  budgetItems = signal<BudgetItem[]>([]);
  income      = signal<IncomeData | null>(null);
  today       = new Date();

  readonly user = this.auth.currentUser;

  // Assets
  assets = computed(() => this.accounts().filter(a => a.type === 'Asset'));
  liabilities = computed(() => this.accounts().filter(a => a.type === 'Liability'));

  totalAssets      = computed(() => this.assets().reduce((s, a) => s + a.value, 0));
  totalLiabilities = computed(() => this.liabilities().reduce((s, a) => s + a.value, 0));
  netWorth         = computed(() => this.totalAssets() - this.totalLiabilities());

  // Group assets
  assetGroups = computed(() => this.groupBy(this.assets()));
  liabGroups  = computed(() => this.groupBy(this.liabilities()));

  // Cash Flow — mirrors Cash Flow component formulas exactly (same localStorage keys)
  // so DTI shown here always matches the DTI shown on the Cash Flow page.
  private static readonly SECOND_INC_KEY    = 'clarity_second_income';
  private static readonly SECOND_INC_EN_KEY = 'clarity_second_income_enabled';

  private _secondEnabled = () => localStorage.getItem(PfsComponent.SECOND_INC_EN_KEY) === '1';
  private _secondData    = () => {
    try { return JSON.parse(localStorage.getItem(PfsComponent.SECOND_INC_KEY) ?? '{"gross":0,"net":0}'); }
    catch { return { gross: 0, net: 0 }; }
  };

  grossIncome = computed(() => {
    const i = this.income();
    if (!i) return 0;
    let primary = i.type === 'stable'
      ? i.grossMonthlyIncome
      : (i.variableMonths?.length ? i.variableMonths.reduce((s, m) => s + m.amount, 0) / i.variableMonths.length : 0);
    if (this._secondEnabled()) primary += (this._secondData().gross ?? 0);
    return primary;
  });

  netIncome = computed(() => {
    const i = this.income();
    if (!i) return 0;
    let primary = i.type === 'stable'
      ? i.netMonthlyIncome
      : (i.variableMonths?.length ? i.variableMonths.reduce((s, m) => s + m.amount, 0) / i.variableMonths.length * 0.75 : 0);
    if (this._secondEnabled()) primary += (this._secondData().net ?? 0);
    return primary;
  });

  totalDebt     = computed(() => this.sumGroup('Debt'));
  totalFixed    = computed(() => this.sumGroup('Fixed'));
  totalVariable = computed(() => this.sumGroup('Variable'));
  totalSavings  = computed(() => this.sumGroup('Savings'));
  totalOutflow  = computed(() => this.totalDebt() + this.totalFixed() + this.totalVariable() + this.totalSavings());
  freeCashFlow  = computed(() => this.netIncome() - this.totalOutflow());
  dti           = computed(() => this.grossIncome() > 0 ? this.totalDebt() / this.grossIncome() : 0);
  savingsRate   = computed(() => this.netIncome() > 0 ? this.totalSavings() / this.netIncome() : 0);
  ltv = computed(() => {
    const home = this.accounts().find(a => a.category === 'property' || a.name.toLowerCase().includes('home'));
    const mortgage = this.accounts().find(a => a.category === 'mortgage' || a.name.toLowerCase().includes('mortgage'));
    if (!home || !mortgage || home.value === 0) return 0;
    return mortgage.value / home.value;
  });

  ngOnInit() {
    this.svc.getAccounts().subscribe(a => this.accounts.set(a));
    this.svc.getBudget().subscribe(b => this.budgetItems.set(b));
    this.svc.getIncome().subscribe(i => this.income.set(i));
  }

  print() { window.print(); }

  private sumGroup(g: string) {
    return this.budgetItems().filter(b => b.group === g).reduce((s, b) => s + b.amount, 0);
  }

  private groupBy(accounts: Account[]) {
    const map = new Map<string, { name: string; total: number; items: Account[] }>();
    for (const a of accounts) {
      if (!map.has(a.group)) map.set(a.group, { name: a.group, total: 0, items: [] });
      const g = map.get(a.group)!;
      g.items.push(a);
      g.total += a.value;
    }
    return [...map.values()];
  }
}
