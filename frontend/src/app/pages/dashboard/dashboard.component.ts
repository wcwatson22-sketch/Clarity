import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { AppInstallService } from '../../services/app-install.service';
import { PushNotificationService } from '../../services/push-notification.service';
import { Account, BudgetItem, IncomeData, Snapshot } from '../../models/finance.models';
import { MeResponse } from '../../models/auth.models';
import { environment } from '../../../environments/environment';
import { NumericDirective } from '../../directives/numeric.directive';
import { TabTutorialComponent, TutorialStep, shouldShowTutorial } from '../../components/tab-tutorial/tab-tutorial.component';

interface AccountGroup { name: string; accounts: Account[]; total: number; }

interface MovementDeltas {
  nw: number;
  assets: number;
  liabs: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, PercentPipe, RouterLink, NumericDirective, TabTutorialComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private svc   = inject(FinanceService);
  private auth  = inject(AuthService);
  private push  = inject(PushNotificationService);
  private toast = inject(ToastService);
  private http  = inject(HttpClient);
  private base  = environment.apiUrl;
  readonly install$ = inject(AppInstallService);
  readonly showInstallModal = signal(false);

  // ── Tab tutorial ─────────────────────────────────────────────────────────
  readonly TUTORIAL_KEY = 'clarity_tutorial_dashboard';
  showTutorial = signal(shouldShowTutorial(this.TUTORIAL_KEY));
  readonly tutorialSteps: TutorialStep[] = [
    { icon: '📊', title: 'Your Financial Dashboard', body: 'Add assets (savings, investments, property) and liabilities (loans, credit cards) to see your net worth in real time.' },
    { icon: '📸', title: 'Save Snapshots', body: 'Hit "Save Snapshot" whenever your balances change. Snapshots power your month-over-month and year-to-date movement cards below.' },
    { icon: '📈', title: 'Track Your Progress', body: 'Your movement cards show net worth, asset, and liability changes since last month and since the start of the year. More snapshots = better tracking.' },
  ];

  // ── In-app progress banner ───────────────────────────────────────────────
  progressMsg    = signal<string | null>(null);
  progressDirUp  = signal<boolean | null>(null);  // true=improved, false=declined, null=neutral
  bannerDismissed = signal(false);

  async triggerInstall() {
    const installed = await this.install$.install();
    if (installed) this.showInstallModal.set(false);
  }

  // ── Greeting ─────────────────────────────────────────────────────────────
  readonly today = new Date();

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    const period = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    const user = this.auth.currentUser();
    const name = user?.firstName || user?.username || '';
    return `Good ${period}, ${name}`;
  });

  // ── Trial status ─────────────────────────────────────────────────────────
  readonly trialEndsAt = computed(() => {
    const t = this.auth.currentUser()?.trialEndsAt;
    return t ? new Date(t) : null;
  });
  readonly trialActive = computed(() => {
    if (this.auth.currentUser()?.isPaid) return false;
    const t = this.trialEndsAt();
    return t ? t > new Date() : false;
  });
  readonly trialDaysLeft = computed(() => {
    const t = this.trialEndsAt();
    if (!t) return 0;
    return Math.max(0, Math.ceil((t.getTime() - Date.now()) / 86400000));
  });
  readonly dashboardLocked = computed(() =>
    !this.trialActive() && !(this.auth.currentUser()?.isPaid ?? false)
  );

  // ── Snapshot quota ────────────────────────────────────────────────────────
  private readonly BASE_SNAPSHOT_LIMIT = 10;
  readonly isPremium  = computed(() => this.auth.currentUser()?.isPaid === true && this.auth.currentUser()?.tier === 'Premium');
  readonly isBasePaid = computed(() => this.auth.currentUser()?.isPaid === true && this.auth.currentUser()?.tier === 'Base');

  readonly snapshotsThisMonth = computed(() => {
    const now = new Date();
    return this.snapshots().filter(s => {
      const d = new Date(s.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  });

  // null = unlimited (Premium or trial); number = remaining for Base/Compare plan
  readonly snapshotsRemaining = computed(() => {
    if (!this.isBasePaid()) return null;
    return Math.max(0, this.BASE_SNAPSHOT_LIMIT - this.snapshotsThisMonth());
  });

  // ── First-name modal (shown for existing users who don't have one yet) ────
  showFirstNameModal = signal(false);
  firstNameInput     = signal('');
  savingFirstName    = signal(false);
  firstNameError     = signal('');

  // ── State ────────────────────────────────────────────────────────────────
  accounts      = signal<Account[]>([]);
  snapshots     = signal<Snapshot[]>([]);
  budgetItems   = signal<BudgetItem[]>([]);
  income        = signal<IncomeData | null>(null);
  loading       = signal(true);
  expandedGroups = signal<Set<string>>(this._loadGroupState('clarity-cat-dash'));
  editingId       = signal<string | null>(null);
  editingValueId  = signal<string | null>(null);
  newRowId        = signal<string | null>(null);
  snapshotSaved = signal(false);
  errorMsg      = signal<string | null>(null);
  showUpgradeModal = signal(false);

  // Group color map
  readonly groupColors: Record<string, string> = {
    'Cash & Bank':      '#10B981',
    'Investments':      '#3B82F6',
    'Retirement':       '#8B5CF6',
    'Real Estate':      '#F59E0B',
    'Personal Property':'#F97316',
    'Other Assets':     '#6B7280',
    'Credit Cards':     '#EF4444',
    'Loans':            '#EF4444',
    'Mortgages':        '#DC2626',
    'Other Debts':      '#991B1B',
  };
  readonly groupBgColors: Record<string, string> = {
    'Cash & Bank':      '#F0FDF9',
    'Investments':      '#F0FBF7',
    'Retirement':       '#F5F3FF',
    'Real Estate':      '#FFFBEB',
    'Personal Property':'#FFF7ED',
    'Other Assets':     '#F9FAFB',
    'Credit Cards':     '#FEF2F2',
    'Loans':            '#FEF2F2',
    'Mortgages':        '#FEF2F2',
    'Other Debts':      '#FEF2F2',
  };
  getGroupColor(name: string): string  { return this.groupColors[name] ?? '#6B7280'; }
  getGroupBg(name: string): string     { return this.groupBgColors[name] ?? '#F9FAFB'; }

  // Group reordering (stored in localStorage)
  private readonly ASSET_ORDER_KEY = 'clarity_asset_order';
  private readonly LIAB_ORDER_KEY  = 'clarity_liab_order';

  assetGroupOrder  = signal<string[]>(JSON.parse(localStorage.getItem(this.ASSET_ORDER_KEY) ?? '[]'));
  liabGroupOrder   = signal<string[]>(JSON.parse(localStorage.getItem(this.LIAB_ORDER_KEY) ?? '[]'));

  sortedAssetGroups = computed<AccountGroup[]>(() => {
    const groups = this.assetGroups();
    const order  = this.assetGroupOrder();
    if (!order.length) return groups;
    return [...groups].sort((a, b) => {
      const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  });

  sortedLiabGroups = computed<AccountGroup[]>(() => {
    const groups = this.liabilityGroups();
    const order  = this.liabGroupOrder();
    if (!order.length) return groups;
    return [...groups].sort((a, b) => {
      const ai = order.indexOf(a.name), bi = order.indexOf(b.name);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  });

  moveGroup(type: 'Asset' | 'Liability', name: string, dir: 'up' | 'down') {
    const key    = type === 'Asset' ? this.ASSET_ORDER_KEY : this.LIAB_ORDER_KEY;
    const groups = (type === 'Asset' ? this.sortedAssetGroups() : this.sortedLiabGroups()).map(g => g.name);
    const idx    = groups.indexOf(name);
    const swap   = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= groups.length) return;
    [groups[idx], groups[swap]] = [groups[swap], groups[idx]];
    localStorage.setItem(key, JSON.stringify(groups));
    if (type === 'Asset') this.assetGroupOrder.set([...groups]);
    else this.liabGroupOrder.set([...groups]);
  }

  // ── Category definitions ─────────────────────────────────────────────────
  readonly assetCategories = [
    { value: 'checking',           label: 'Checking Account',       group: 'Cash & Bank',       liquid: true  },
    { value: 'savings',            label: 'Savings Account',        group: 'Cash & Bank',       liquid: true  },
    { value: 'money-market',       label: 'Money Market',           group: 'Cash & Bank',       liquid: true  },
    { value: 'cash',               label: 'Cash on Hand',           group: 'Cash & Bank',       liquid: true  },
    { value: 'brokerage',          label: 'Brokerage Account',      group: 'Investments',       liquid: true  },
    { value: 'stocks',             label: 'Stocks / ETFs',          group: 'Investments',       liquid: true  },
    { value: 'crypto',             label: 'Cryptocurrency',         group: 'Investments',       liquid: true  },
    { value: 'other-investment',   label: 'Other Investment',       group: 'Investments',       liquid: false },
    { value: 'retirement-401k',    label: '401(k)',                 group: 'Retirement',        liquid: false },
    { value: 'retirement-ira',     label: 'Traditional IRA',        group: 'Retirement',        liquid: false },
    { value: 'retirement-roth',    label: 'Roth IRA',               group: 'Retirement',        liquid: false },
    { value: 'retirement-pension', label: 'Pension',                group: 'Retirement',        liquid: false },
    { value: 'retirement',         label: 'Other Retirement',       group: 'Retirement',        liquid: false },
    { value: 'property',           label: 'Primary Residence',      group: 'Real Estate',       liquid: false },
    { value: 'investment-property',label: 'Investment Property',    group: 'Real Estate',       liquid: false },
    { value: 'land',               label: 'Land',                   group: 'Real Estate',       liquid: false },
    { value: 'vehicle',            label: 'Vehicle',                group: 'Personal Property', liquid: false },
    { value: 'collectibles',       label: 'Jewelry / Collectibles', group: 'Personal Property', liquid: false },
    { value: 'asset-other',        label: 'Other Asset',            group: 'Other Assets',      liquid: false },
  ];

  readonly liabilityCategories = [
    { value: 'credit',          label: 'Credit Card',          group: 'Credit Cards' },
    { value: 'personal-loan',   label: 'Personal Loan',        group: 'Loans'        },
    { value: 'student-loan',    label: 'Student Loan',         group: 'Loans'        },
    { value: 'auto',            label: 'Auto Loan',            group: 'Loans'        },
    { value: 'mortgage',        label: 'Mortgage – Primary',   group: 'Mortgages'    },
    { value: 'mortgage-invest', label: 'Mortgage – Investment',group: 'Mortgages'    },
    { value: 'heloc',           label: 'HELOC',                group: 'Mortgages'    },
    { value: 'medical-debt',    label: 'Medical Debt',         group: 'Other Debts'  },
    { value: 'tax-debt',        label: 'Tax Debt',             group: 'Other Debts'  },
    { value: 'debt-other',      label: 'Other Debt',           group: 'Other Debts'  },
  ];

  // Liquid = cash + taxable brokerage, NOT retirement
  private readonly liquidSet = new Set([
    'checking', 'savings', 'money-market', 'cash',
    'brokerage', 'stocks', 'crypto'
  ]);

  // ── Computed: balances ───────────────────────────────────────────────────
  totalAssets      = computed(() => this.accounts().filter(a => a.type === 'Asset').reduce((s, a) => s + a.value, 0));
  totalLiabilities = computed(() => this.accounts().filter(a => a.type === 'Liability').reduce((s, a) => s + a.value, 0));
  netWorth         = computed(() => this.totalAssets() - this.totalLiabilities());
  liquidityPosition = computed(() =>
    this.accounts().filter(a => a.type === 'Asset' && this.liquidSet.has(a.category)).reduce((s, a) => s + a.value, 0)
  );
  debtToIncome = computed(() => {
    const inc = this.income();
    if (!inc) return null;
    let combinedGross = inc.type === 'stable'
      ? inc.grossMonthlyIncome
      : (inc.variableMonths?.length ? inc.variableMonths.reduce((s, m) => s + m.amount, 0) / inc.variableMonths.length : 0);
    const secondEnabled = localStorage.getItem('clarity_second_income_enabled') === '1';
    if (secondEnabled) {
      try {
        const secondData = JSON.parse(localStorage.getItem('clarity_second_income') ?? '{"gross":0,"net":0}');
        combinedGross += secondData.gross ?? 0;
      } catch {}
    }
    if (combinedGross === 0) return null;
    const monthlyDebt = this.budgetItems()
      .filter(b => b.group === 'Debt')
      .reduce((s, b) => s + b.amount, 0);
    return monthlyDebt / combinedGross;
  });
  itemsTracked = computed(() => this.accounts().length);

  // ── Computed: groups ─────────────────────────────────────────────────────
  assetGroups = computed<AccountGroup[]>(() => {
    const assets = this.accounts().filter(a => a.type === 'Asset');
    return [...new Set(assets.map(a => a.group))].map(name => {
      const accts = assets.filter(a => a.group === name);
      return { name, accounts: accts, total: accts.reduce((s, a) => s + a.value, 0) };
    });
  });

  liabilityGroups = computed<AccountGroup[]>(() => {
    const liabs = this.accounts().filter(a => a.type === 'Liability');
    return [...new Set(liabs.map(a => a.group))].map(name => {
      const accts = liabs.filter(a => a.group === name);
      return { name, accounts: accts, total: accts.reduce((s, a) => s + a.value, 0) };
    });
  });

  // ── Computed: LTV ────────────────────────────────────────────────────────
  homeValue       = computed(() => this.accounts().find(a => a.category === 'property')?.value ?? 0);
  mortgageBalance = computed(() => this.accounts().find(a => a.category === 'mortgage' || a.category === 'mortgage-invest')?.value ?? 0);
  showLtv = computed(() => this.homeValue() > 0 && this.mortgageBalance() > 0);
  ltv     = computed(() => this.homeValue() > 0 ? this.mortgageBalance() / this.homeValue() : 0);
  equity  = computed(() => this.homeValue() - this.mortgageBalance());
  pmiRequired    = computed(() => this.homeValue() > 0 && this.ltv() > 0.80);
  helocAvailable = computed(() => Math.max(0, this.homeValue() * 0.899 - this.mortgageBalance()));

  // ── Computed: snapshot helpers ────────────────────────────────────────────
  lastSnapshot = computed(() => this.snapshots()[0] ?? null);

  // ── Computed: movement cards ──────────────────────────────────────────────
  /**
   * Most recent snapshot taken before the current calendar month began.
   * Used as the month-over-month baseline. Null if all snapshots are from the current month.
   */
  priorMonthSnapshot = computed(() => {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return this.snapshots().find(s => new Date(s.createdAt).getTime() < monthStart) ?? null;
  });

  /**
   * Earliest snapshot in the current calendar year, provided there are at least 2 snapshots
   * this year. Returns null if there are fewer than 2 this-year snapshots (can't compute YTD).
   */
  ytdBaseSnapshot = computed(() => {
    const yr = new Date().getFullYear();
    const thisYear = this.snapshots().filter(s => new Date(s.createdAt).getFullYear() === yr);
    return thisYear.length >= 2 ? thisYear[thisYear.length - 1] : null; // oldest (sorted newest-first)
  });

  /**
   * Month-over-month deltas for net worth, assets, and liabilities.
   * Null if no prior-month snapshot exists (user hasn't saved snapshots across months yet).
   */
  momDeltas = computed<MovementDeltas | null>(() => {
    const prior = this.priorMonthSnapshot();
    if (!prior) return null;
    return {
      nw:     this.netWorth()          - prior.netWorth,
      assets: this.totalAssets()       - prior.totalAssets,
      liabs:  this.totalLiabilities()  - prior.totalLiabilities,
    };
  });

  /**
   * Year-to-date deltas for net worth, assets, and liabilities.
   * Null if fewer than 2 snapshots exist in the current calendar year.
   */
  ytdDeltas = computed<MovementDeltas | null>(() => {
    const base = this.ytdBaseSnapshot();
    if (!base) return null;
    return {
      nw:     this.netWorth()          - base.netWorth,
      assets: this.totalAssets()       - base.totalAssets,
      liabs:  this.totalLiabilities()  - base.totalLiabilities,
    };
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    if (!this.auth.currentUser()?.firstName) {
      this.showFirstNameModal.set(true);
    }

    let pending = 4;
    const done = () => {
      if (--pending === 0) {
        this.loading.set(false);
        this.computeProgressBanner();
      }
    };
    this.svc.getAccounts().subscribe({ next: a => { this.accounts.set(a); done(); }, error: done });
    this.svc.getSnapshots().subscribe({ next: s => { this.snapshots.set(s); done(); }, error: done });
    this.svc.getBudget().subscribe({ next: b => { this.budgetItems.set(b); done(); }, error: done });
    this.svc.getIncome().subscribe({ next: i => { this.income.set(i); done(); }, error: done });
  }

  // ── In-app progress banner ───────────────────────────────────────────────
  private computeProgressBanner() {
    const snaps = this.snapshots();
    const msg   = this.push.pickInAppMessage(snaps);
    if (!msg) return;

    this.progressMsg.set(msg);

    if (snaps.length >= 2) {
      const [latest, prev] = snaps;
      const improved = [
        latest.netWorth > prev.netWorth,
        latest.totalAssets > prev.totalAssets,
        latest.totalLiabilities < prev.totalLiabilities,
      ].filter(Boolean).length;
      this.progressDirUp.set(improved >= 2 ? true : improved <= 0 ? false : null);
    }
  }

  dismissBanner() {
    this.bannerDismissed.set(true);
    this.progressMsg.set(null);
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  logout() { this.auth.logout(); }

  // ── First-name save ──────────────────────────────────────────────────────
  saveFirstName() {
    const name = this.firstNameInput().trim();
    if (!name) { this.firstNameError.set('Please enter your first name.'); return; }
    this.firstNameError.set('');
    this.savingFirstName.set(true);

    const u = this.auth.currentUser()!;
    this.http.put<MeResponse>(`${this.base}/profile`, {
      firstName: name,
      email: u.email,
      state: u.state,
      city: u.city,
      age: u.age,
    }).subscribe({
      next: updated => {
        this.auth.updateCachedUser(updated);
        this.savingFirstName.set(false);
        this.showFirstNameModal.set(false);
        this.toast.success(`Welcome, ${updated.firstName}!`);
      },
      error: () => {
        this.savingFirstName.set(false);
        this.firstNameError.set('Could not save. Please try again.');
      }
    });
  }

  // ── Group helpers ────────────────────────────────────────────────────────
  private _loadGroupState(key: string): Set<string> {
    const saved = localStorage.getItem(key);
    if (saved !== null) return new Set(JSON.parse(saved));
    return localStorage.getItem('clarity-expand-default') === 'true'
      ? new Set(['Cash & Bank','Investments','Retirement','Real Estate','Personal Property','Credit Cards','Loans','Mortgages','Other Debts'])
      : new Set();
  }

  toggleGroup(name: string) {
    const s = new Set(this.expandedGroups());
    s.has(name) ? s.delete(name) : s.add(name);
    this.expandedGroups.set(s);
    localStorage.setItem('clarity-cat-dash', JSON.stringify([...s]));
  }
  isExpanded(name: string) { return this.expandedGroups().has(name); }

  expandGroup(name: string) {
    this.expandedGroups.update(s => { const n = new Set(s); n.add(name); return n; });
    localStorage.setItem('clarity-cat-dash', JSON.stringify([...this.expandedGroups()]));
  }

  // ── Account CRUD ─────────────────────────────────────────────────────────
  updateValue(account: Account, raw: string) {
    const val = Math.max(0, parseFloat(raw.replace(/[^0-9.-]/g, '')) || 0);
    const latest = this.accounts().find(a => a.id === account.id) ?? account;
    this.svc.updateAccount(latest.id, { ...latest, value: val }).subscribe(updated => {
      this.accounts.update(list => list.map(a => a.id === updated.id ? updated : a));
      if (this.newRowId() === account.id) this.newRowId.set(null);
    });
  }

  updateName(account: Account, name: string) {
    const trimmed = name.trim();
    this.editingId.set(null);
    if (!trimmed || trimmed === account.name) return;
    this.svc.updateAccount(account.id, { ...account, name: trimmed }).subscribe(updated =>
      this.accounts.update(list => list.map(a => a.id === updated.id ? updated : a))
    );
  }

  updateCategory(account: Account, catValue: string) {
    const cats = account.type === 'Asset' ? this.assetCategories : this.liabilityCategories;
    const cat = cats.find(c => c.value === catValue);
    if (!cat) return;
    const updated = { ...account, category: catValue, group: cat.group };
    this.svc.updateAccount(account.id, updated).subscribe(res => {
      this.accounts.update(list => list.map(a => a.id === res.id ? res : a));
      this.expandGroup(cat.group);
    });
  }

  deleteAccount(id: string, name: string) {
    if (!confirm(`Remove "${name}"? This cannot be undone.`)) return;
    if (this.newRowId() === id) this.newRowId.set(null);
    if (this.editingId() === id) this.editingId.set(null);
    this.svc.deleteAccount(id).subscribe(() =>
      this.accounts.update(list => list.filter(a => a.id !== id))
    );
  }

  private showError(msg: string) {
    this.toast.error(msg);
    this.errorMsg.set(msg);
    setTimeout(() => this.errorMsg.set(null), 5500);
  }

  addNewAccount(type: 'Asset' | 'Liability') {
    const cat = type === 'Asset' ? this.assetCategories[0] : this.liabilityCategories[0];
    this.svc.createAccount({ group: cat.group, category: cat.value, name: 'New Account', value: 0, type })
      .subscribe({
        next: a => {
          this.accounts.update(list => [...list, a]);
          this.newRowId.set(a.id);
          this.editingId.set(a.id);
          this.expandGroup(cat.group);
        },
        error: err => this.showError(`Could not add account — is the backend running? (${err.status ?? err.message})`)
      });
  }

  addToGroup(group: string, type: 'Asset' | 'Liability', category: string) {
    this.svc.createAccount({ group, category, name: 'New Account', value: 0, type }).subscribe({
      next: a => {
        this.accounts.update(list => [...list, a]);
        this.newRowId.set(a.id);
        this.editingId.set(a.id);
      },
      error: err => this.showError(`Could not add account — is the backend running? (${err.status ?? err.message})`)
    });
  }

  getCategories(type: string) {
    return type === 'Asset' ? this.assetCategories : this.liabilityCategories;
  }

  // ── Snapshot ─────────────────────────────────────────────────────────────
  saveSnapshot() {
    const lineItems = this.accounts().map(a => ({
      accountId: a.id,
      name: a.name,
      category: a.category,
      group: a.group,
      type: a.type,
      value: a.value,
    }));
    const snap = {
      netWorth: this.netWorth(),
      totalAssets: this.totalAssets(),
      totalLiabilities: this.totalLiabilities(),
      cashPosition: this.liquidityPosition(),
      lineItems,
    };
    this.svc.createSnapshot(snap).subscribe({
      next: s => {
        this.snapshots.update(list => [s, ...list]);
        this.snapshotSaved.set(true);
        this.toast.success('Snapshot saved!');
        setTimeout(() => this.snapshotSaved.set(false), 3000);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 429) {
          this.showUpgradeModal.set(true);
        } else {
          this.showError('Could not save snapshot. Please try again.');
        }
      }
    });
  }

  dismissUpgradeModal() { this.showUpgradeModal.set(false); }

  // ── Formatting ───────────────────────────────────────────────────────────
  formatCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
  formatCurrencyExact(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  fmtPct(pct: number): string {
    return `${(Math.abs(pct) * 100).toFixed(1)}%`;
  }
  netWorthColor() {
    const nw = this.netWorth();
    return nw > 0 ? '#1D9E75' : nw < 0 ? '#EF4444' : '#6B7280';
  }
}
