import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { userScopedKey } from '../../services/scoped-storage';
import { PlanAccessService } from '../../services/plan-access.service';
import { RealEstateService } from '../../services/real-estate.service';
import { RealEstateProperty } from '../real-estate/real-estate.component';
import { Account, BudgetItem, IncomeData } from '../../models/finance.models';

@Component({
  selector: 'app-pfs',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, PercentPipe, DatePipe, RouterLink],
  templateUrl: './pfs.component.html',
  styleUrl: './pfs.component.scss'
})
export class PfsComponent implements OnInit {
  private svc   = inject(FinanceService);
  private auth  = inject(AuthService);
  private plans = inject(PlanAccessService);
  readonly re   = inject(RealEstateService);

  /** PFS is a Premium ($2.99/mo) banker-readiness tool. */
  readonly hasAccess = this.plans.canPfs;

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

  // User-scoped keys so PFS reads the same per-account values Cash Flow writes.
  private k(base: string): string { return userScopedKey(base, this.auth.currentUser()?.id ?? null); }
  private _secondEnabled = () => localStorage.getItem(this.k(PfsComponent.SECOND_INC_EN_KEY)) === '1';
  private _secondData    = () => {
    try { return JSON.parse(localStorage.getItem(this.k(PfsComponent.SECOND_INC_KEY)) ?? '{"gross":0,"net":0}'); }
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

  // ── Investment Real Estate (from analyzer) ──────────────────────────────
  investProps      = computed(() => this.re.properties());
  hasInvestProps   = computed(() => this.investProps().length > 0);
  investTotalValue = computed(() => this.re.totalValue());
  investTotalDebt  = computed(() => this.re.totalDebt());
  investTotalEquity= computed(() => this.re.totalEquity());

  /** Threshold: at or below this count, show full per-property table. Above → grouped summary. */
  readonly SCHEDULE_THRESHOLD = 20;
  readonly useLargePortfolioFormat = computed(() => this.investProps().length > this.SCHEDULE_THRESHOLD);

  /** Per-property metrics — used for Schedule A detail (≤20) and Schedule B CSV (always) */
  scheduleARows = computed(() => this.investProps().map(p => {
    const r   = p.interestRate / 100 / 12;
    const n   = p.amortizationYears * 12;
    const pmt = (p.loanAmount > 0 && p.interestRate > 0)
      ? p.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : 0;
    const gross    = p.grossMonthlyRent + p.otherMonthlyIncome;
    const egi      = gross * (1 - p.vacancyRate / 100);
    const mgmt     = p.managementFeeIsPercent ? p.grossMonthlyRent * (p.managementFee / 100) : p.managementFee;
    const expenses = mgmt + p.repairs + p.repairReserve + p.capExReserve +
      p.propertyTaxes + p.insurance + p.hoaFees + p.utilities +
      p.legalFees + p.cleaning + p.otherExpenses;
    const noi  = egi - expenses;
    const dscr = pmt > 0 ? (noi * 12) / (pmt * 12) : null;
    return {
      address:        p.address,
      propertyType:   p.propertyType === 'ltr' ? 'Long-Term Rental' : p.propertyType === 'str' ? 'Short-Term Rental' : 'Multi-Family',
      appraisedValue: p.appraisedValue,
      loanBalance:    p.loanAmount,
      equity:         p.appraisedValue - p.loanAmount,
      grossRent:      p.grossMonthlyRent,
      noiAnnual:      noi * 12,
      monthlyPayment: pmt,
      annualDebtSvc:  pmt * 12,
      dscr,
      interestRate:   p.interestRate,
      amortYears:     p.amortizationYears,
    };
  }));

  /** Grouped summary by property type — used for Schedule A when > 20 properties */
  scheduleAGroups = computed(() => {
    const typeLabel: Record<string, string> = {
      ltr: 'Long-Term Rental (LTR)',
      str: 'Short-Term Rental (STR)',
      multifamily: 'Multi-Family',
    };
    const groups = new Map<string, {
      label: string; count: number;
      totalValue: number; totalDebt: number; totalEquity: number;
      totalGrossRent: number; totalNOI: number; totalDebtSvc: number;
    }>();

    for (const row of this.scheduleARows()) {
      const key = this.investProps().find(p => p.address === row.address)?.propertyType ?? 'ltr';
      if (!groups.has(key)) groups.set(key, {
        label: typeLabel[key] ?? key,
        count: 0, totalValue: 0, totalDebt: 0, totalEquity: 0,
        totalGrossRent: 0, totalNOI: 0, totalDebtSvc: 0,
      });
      const g = groups.get(key)!;
      g.count++;
      g.totalValue     += row.appraisedValue;
      g.totalDebt      += row.loanBalance;
      g.totalEquity    += row.equity;
      g.totalGrossRent += row.grossRent;
      g.totalNOI       += row.noiAnnual;
      g.totalDebtSvc   += row.annualDebtSvc;
    }

    return [...groups.values()].map(g => ({
      ...g,
      ltv:  g.totalValue  > 0 ? g.totalDebt / g.totalValue : 0,
      dscr: g.totalDebtSvc > 0 ? g.totalNOI / g.totalDebtSvc : null,
    }));
  });

  /** Download full portfolio as CSV (Schedule B) */
  exportCsv() {
    const rows = this.scheduleARows();
    const headers = [
      'Address','Type','Appraised Value','Loan Balance','Equity',
      'Gross Rent/mo','Annual NOI','Monthly P&I','Annual Debt Service',
      'DSCR','Interest Rate (%)','Amort (yrs)'
    ];
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.address}"`,
        `"${r.propertyType}"`,
        r.appraisedValue.toFixed(0),
        r.loanBalance.toFixed(0),
        r.equity.toFixed(0),
        r.grossRent.toFixed(0),
        r.noiAnnual.toFixed(0),
        r.monthlyPayment.toFixed(2),
        r.annualDebtSvc.toFixed(2),
        r.dscr != null ? r.dscr.toFixed(3) : '',
        r.interestRate,
        r.amortYears,
      ].join(','))
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `clarity-schedule-b-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  ngOnInit() {
    this.svc.getAccounts().subscribe(a => this.accounts.set(a));
    this.svc.getBudget().subscribe(b => this.budgetItems.set(b));
    this.svc.getIncome().subscribe(i => this.income.set(i));
    this.re.load();
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
