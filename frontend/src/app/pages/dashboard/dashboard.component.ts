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

interface AccountGroup { name: string; accounts: Account[]; total: number; }
interface MomentumItem { sentence: string; delta: number; isGood: boolean; }
interface SvgDot { cx: string; cy: string; }
interface ChartSvgData {
  nwPath: string; assetPath: string; liabPath: string;
  gridLines: string[];
  yLabels: { y: string; textY: string; label: string }[];
  xLabels: { x: string; label: string; anchor: string }[];
  nwDots: SvgDot[]; assetDots: SvgDot[]; liabDots: SvgDot[];
  projPath: string; projEndLabel: string; projEndX: string; projEndY: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, PercentPipe, RouterLink, NumericDirective],
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
    const period = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
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
    if (this.auth.currentUser()?.isPaid) return false; // paid subscriber — not on trial
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

  // null = unlimited (Premium or trial); number = remaining for Base plan
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
  editingId       = signal<string | null>(null);  // which row's name is being edited
  editingValueId  = signal<string | null>(null); // which row's value is being edited
  newRowId        = signal<string | null>(null);  // which row just got added (shows cat dropdown)
  snapshotSaved = signal(false);
  errorMsg      = signal<string | null>(null);
  showUpgradeModal = signal(false);

  // Chart
  readonly periods = ['2W', '30D', '3M', '6M', '1Y'];
  chartPeriod  = signal('3M');
  showProjection = signal(false);
  projectionYears = signal(5);  // 1, 3, 5, 10

  // Group color map
  readonly groupColors: Record<string, string> = {
    'Cash & Bank':      '#10B981',
    'Investments':      '#3B82F6',
    'Retirement':       '#8B5CF6',
    'Real Estate':      '#F59E0B',
    'Personal Property':'#F97316',
    'Other Assets':     '#6B7280',
    'Credit Cards':     '#EF4444',
    'Loans':            '#D85A30',
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
    if (!inc || inc.grossMonthlyIncome === 0) return null;
    const monthlyDebt = this.budgetItems()
      .filter(b => b.group === 'Debt')
      .reduce((s, b) => s + b.amount, 0);
    return monthlyDebt / inc.grossMonthlyIncome;
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
  // PMI required when LTV > 80%; HELOC typically available up to 89.9% CLTV
  pmiRequired    = computed(() => this.homeValue() > 0 && this.ltv() > 0.80);
  helocAvailable = computed(() => Math.max(0, this.homeValue() * 0.899 - this.mortgageBalance()));

  // ── Computed: momentum ───────────────────────────────────────────────────
  lastSnapshot = computed(() => this.snapshots()[0] ?? null);

  // Most recent snapshot taken before this month began — used as month-start baseline
  monthStartSnapshot = computed(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return this.snapshots().find(s => new Date(s.createdAt as string).getTime() < monthStart) ?? null;
  });

  readonly currentMonthLabel = computed(() => {
    return new Date().toLocaleDateString('en-US', { month: 'long' });
  });

  momentumItems = computed<MomentumItem[]>(() => {
    const ref = this.monthStartSnapshot();
    if (!ref) return [];

    const month = this.currentMonthLabel();
    const items: MomentumItem[] = [];

    // 1. Net worth — always first
    const nwDelta = this.netWorth() - ref.netWorth;
    const nwPct   = ref.netWorth !== 0 ? nwDelta / Math.abs(ref.netWorth) : 0;
    const nwPctStr = Math.abs(nwPct * 100) >= 0.1 ? ` (${(nwPct * 100).toFixed(1)}%)` : '';
    items.push({
      sentence: `Net worth ${nwDelta >= 0 ? 'up' : 'down'} ${this.formatCurrency(Math.abs(nwDelta))}${nwPctStr} in ${month}`,
      delta: nwDelta,
      isGood: nwDelta >= 0,
    });

    // 2 & 3. Top account-level changes (requires lineItems in snapshot)
    const lineItems = ref.lineItems ?? [];
    if (lineItems.length > 0) {
      const changes = this.accounts()
        .map(a => {
          const prev = lineItems.find(li => li.accountId === a.id);
          if (!prev) return null;
          const delta  = a.value - prev.value;
          const absAmt = Math.abs(delta);
          if (absAmt < 100) return null;                        // skip trivial
          const pct    = prev.value !== 0 ? delta / prev.value : 0;
          const isLiab = a.type === 'Liability';
          const isGood = isLiab ? delta <= 0 : delta >= 0;
          const dir    = delta > 0 ? 'up' : 'down';
          const pctStr = Math.abs(pct * 100) >= 0.5 ? ` (${Math.abs(pct * 100).toFixed(1)}%)` : '';
          return {
            sentence: `${a.name} ${dir} ${this.formatCurrency(absAmt)}${pctStr} this month`,
            delta, isGood, absAmt,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .sort((a, b) => b.absAmt - a.absAmt);

      for (const c of changes.slice(0, 2)) {
        items.push({ sentence: c.sentence, delta: c.delta, isGood: c.isGood });
      }
    }

    return items.slice(0, 3);
  });

  // ── Computed: chart ──────────────────────────────────────────────────────
  chartPoints = computed(() => {
    const days: Record<string, number> = { '2W': 14, '30D': 30, '3M': 90, '6M': 180, '1Y': 365 };
    const cutoff = new Date(Date.now() - (days[this.chartPeriod()] ?? 90) * 86400000);
    const snaps = this.snapshots()
      .filter(s => new Date(s.createdAt as string) >= cutoff)
      .map(s => ({ createdAt: s.createdAt as string, netWorth: s.netWorth, totalAssets: s.totalAssets, totalLiabilities: s.totalLiabilities }))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return [...snaps, { createdAt: new Date().toISOString(), netWorth: this.netWorth(), totalAssets: this.totalAssets(), totalLiabilities: this.totalLiabilities() }];
  });

  chartSvg = computed<(ChartSvgData & { projPath: string; projEndLabel: string; projEndX: string; projEndY: string }) | null>(() => {
    const pts  = this.chartPoints();
    if (pts.length < 2) return null;

    const proj   = this.showProjection() ? this.projectionRawPoints() : [];
    const W = 760, H = 200, padL = 60, padR = 16, padT = 12, padB = 30;
    const chartW = W - padL - padR, chartH = H - padT - padB;

    // Build unified time range (history + projection)
    const allIsos = [...pts.map(p => p.createdAt), ...proj.map(p => p.iso)];
    const times   = allIsos.map(iso => new Date(iso).getTime());
    const tMin = times[0], tMax = times[times.length - 1], tRange = tMax - tMin || 1;

    // Build unified value range — Y-axis scales to next $100K milestone above current NW
    const nwVals    = pts.map(p => p.netWorth);
    const projVals  = proj.map(p => p.nw);
    const allNwVals = [...nwVals, ...projVals];
    const dataMin   = Math.min(...allNwVals);
    const dataMax   = Math.max(...allNwVals);

    // Motivational ceiling: next $100K milestone above current net worth
    // e.g. $90K → $100K, $100K → $200K, $250K → $300K
    const currentNW     = this.netWorth();
    const rawMilestone  = Math.ceil((Math.max(currentNW, 0) + 1) / 100_000) * 100_000;
    const nextMilestone = Math.max(rawMilestone, 100_000); // floor at $100K ceiling

    // Extend if projection or historical data exceeds the milestone
    const vHigh = Math.max(nextMilestone, dataMax * 1.02);

    // Floor: 0 for all-positive values; drop below 0 for negative NW users
    const vLow  = dataMin >= 0
      ? 0
      : Math.floor(dataMin * 1.1 / 10_000) * 10_000;

    const vRange = vHigh - vLow || 1;

    const toX = (iso: string) => padL + ((new Date(iso).getTime() - tMin) / tRange) * chartW;
    const toY = (v: number)   => padT + (1 - (v - vLow) / vRange) * chartH;
    const line = (k: 'netWorth' | 'totalAssets' | 'totalLiabilities') =>
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.createdAt).toFixed(1)},${toY(p[k]).toFixed(1)}`).join(' ');
    const dots = (k: 'netWorth' | 'totalAssets' | 'totalLiabilities'): SvgDot[] =>
      pts.map(p => ({ cx: toX(p.createdAt).toFixed(1), cy: toY(p[k]).toFixed(1) }));

    // Snap Y labels to clean round intervals (25% steps of the range, rounded to nice numbers)
    const rawStep  = vRange / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const niceStep  = Math.ceil(rawStep / magnitude) * magnitude;
    const yLabelVals = Array.from({ length: 5 }, (_, i) => vLow + niceStep * i)
      .filter(v => v <= vHigh * 1.01); // drop any that overshoot
    const yLabels = yLabelVals.map(v => ({
      y: toY(v).toFixed(1), textY: (toY(v) + 4).toFixed(1), label: this.formatCurrencyShort(v)
    }));

    // Projection path: starts from current NW → future
    const todayPt = pts[pts.length - 1];
    const projPath = proj.length
      ? `M${toX(todayPt.createdAt).toFixed(1)},${toY(todayPt.netWorth).toFixed(1)} ` +
        proj.map(p => `L${toX(p.iso).toFixed(1)},${toY(p.nw).toFixed(1)}`).join(' ')
      : '';
    const lastProj   = proj[proj.length - 1];
    const projEndX   = lastProj ? toX(lastProj.iso).toFixed(1) : '0';
    const projEndY   = lastProj ? toY(lastProj.nw).toFixed(1) : '0';
    const projEndLabel = lastProj ? this.formatCurrencyShort(lastProj.nw) : '';

    // x-labels: always show start + today; if projection, also show end year
    const xLabels: { x: string; label: string; anchor: string }[] = [
      { x: toX(pts[0].createdAt).toFixed(1), label: this.fmtDate(pts[0].createdAt), anchor: 'start' },
      { x: toX(todayPt.createdAt).toFixed(1), label: 'Today', anchor: proj.length ? 'middle' : 'end' },
    ];
    if (proj.length) {
      const endYear = new Date(lastProj.iso).getFullYear();
      xLabels.push({ x: projEndX, label: String(endYear), anchor: 'end' });
    }

    return {
      nwPath: line('netWorth'), assetPath: line('totalAssets'), liabPath: line('totalLiabilities'),
      gridLines: yLabels.map(l => `M${padL},${l.y} H${W - padR}`),
      yLabels, xLabels,
      nwDots: dots('netWorth'), assetDots: dots('totalAssets'), liabDots: dots('totalLiabilities'),
      projPath, projEndLabel, projEndX, projEndY,
    };
  });

  // ── Computed: projection ─────────────────────────────────────────────────
  monthlyDelta = computed(() => {
    const inc = this.income();
    if (!inc) return 0;
    const net = inc.type === 'stable' ? inc.netMonthlyIncome
      : inc.variableMonths.length ? inc.variableMonths.reduce((s, m) => s + m.amount, 0) / inc.variableMonths.length * 0.75 : 0;
    const savings  = this.budgetItems().filter(b => b.group === 'Savings').reduce((s, b) => s + b.amount, 0);
    const outflow  = this.budgetItems().reduce((s, b) => s + b.amount, 0);
    const fcf      = net - outflow;
    return savings + Math.max(0, fcf);
  });

  projectionRawPoints = computed(() => {
    const delta  = this.monthlyDelta();
    const years  = this.projectionYears();
    const months = years * 12;
    const now    = Date.now();
    const base   = this.netWorth();
    const r      = 0.06 / 12;  // 6% annual growth / month
    const pts: { iso: string; nw: number }[] = [];
    for (let m = 1; m <= months; m++) {
      const nw = base * Math.pow(1 + r, m) + (r > 0 ? delta * ((Math.pow(1 + r, m) - 1) / r) : delta * m);
      pts.push({ iso: new Date(now + m * 30.44 * 86400000).toISOString(), nw });
    }
    return pts;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit() {
    // Prompt existing users who have no first name yet
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

    // Determine direction for icon/colour
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
    // No saved state — fall back to user's default preference
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
    // Clamp negatives to 0; read latest from signal to avoid stale-name race condition
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

  /** Change category — also moves the account into the right group */
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
    // Keep backward-compat signal for any inline error display still in template
    this.errorMsg.set(msg);
    setTimeout(() => this.errorMsg.set(null), 5500);
  }

  /** Top-level "Add Asset / Liability" — creates in the first group for that type */
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

  /** Per-group "+ Add account" — creates in that specific group */
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

  /** Flat category list for the inline select */
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
  formatCurrencyShort(v: number): string {
    const abs = Math.abs(v), sign = v < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${abs.toFixed(0)}`;
  }
  fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  netWorthColor() {
    const nw = this.netWorth();
    return nw > 0 ? '#1D9E75' : nw < 0 ? '#D85A30' : '#6B7280';
  }
}
