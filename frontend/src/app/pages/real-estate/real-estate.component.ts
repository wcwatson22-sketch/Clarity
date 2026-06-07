import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, CurrencyPipe, PercentPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PlanAccessService } from '../../services/plan-access.service';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

export interface RealEstateProperty {
  id?: string;
  address: string;
  propertyType: 'ltr' | 'str' | 'multifamily';
  squareFeet?: number;
  bedrooms?: number;
  bathrooms?: number;
  yearBuilt?: number;
  purchasePrice: number;
  appraisedValue: number;
  grossMonthlyRent: number;
  vacancyRate: number;
  otherMonthlyIncome: number;
  managementFee: number;
  managementFeeIsPercent: boolean;
  repairs: number;
  repairReserve: number;
  capExReserve: number;
  propertyTaxes: number;
  insurance: number;
  hoaFees: number;
  utilities: number;
  legalFees: number;
  cleaning: number;
  otherExpenses: number;
  loanAmount: number;
  interestRate: number;
  amortizationYears: number;
  annualRentGrowthPct: number;
  annualAppreciationPct: number;
}

function blankProperty(): RealEstateProperty {
  return {
    address: '',
    propertyType: 'ltr',
    squareFeet: undefined,
    bedrooms: undefined,
    bathrooms: undefined,
    yearBuilt: undefined,
    purchasePrice: 0,
    appraisedValue: 0,
    grossMonthlyRent: 0,
    vacancyRate: 5,
    otherMonthlyIncome: 0,
    managementFee: 10,
    managementFeeIsPercent: true,
    repairs: 0,
    repairReserve: 0,
    capExReserve: 0,
    propertyTaxes: 0,
    insurance: 0,
    hoaFees: 0,
    utilities: 0,
    legalFees: 0,
    cleaning: 0,
    otherExpenses: 0,
    loanAmount: 0,
    interestRate: 7.0,
    amortizationYears: 30,
    annualRentGrowthPct: 3,
    annualAppreciationPct: 3,
  };
}

@Component({
  selector: 'app-real-estate',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, PercentPipe, DecimalPipe, RouterLink],
  templateUrl: './real-estate.component.html',
  styleUrl: './real-estate.component.scss',
})
export class RealEstateComponent implements OnInit {
  private http  = inject(HttpClient);
  private auth  = inject(AuthService);
  private plans = inject(PlanAccessService);
  private toast = inject(ToastService);
  private base  = environment.apiUrl;

  readonly hasAccess = computed(() => this.plans.isPremium() || this.plans.trialActive());

  properties   = signal<(RealEstateProperty & { id: string })[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  showForm     = signal(false);
  editingId    = signal<string | null>(null);
  activeId     = signal<string | null>(null);   // which property is expanded/viewed
  show5Year    = signal(false);

  form = signal<RealEstateProperty>(blankProperty());

  // ── Computed metrics for the active property ─────────────────────────────

  active = computed(() =>
    this.properties().find(p => p.id === this.activeId()) ?? null
  );

  // Effective Gross Income
  egi = computed(() => {
    const p = this.active();
    if (!p) return 0;
    const gross = p.grossMonthlyRent + p.otherMonthlyIncome;
    return gross * (1 - p.vacancyRate / 100);
  });

  // Management fee (handles flat vs %)
  managementFeeAmt = computed(() => {
    const p = this.active();
    if (!p) return 0;
    return p.managementFeeIsPercent
      ? p.grossMonthlyRent * (p.managementFee / 100)
      : p.managementFee;
  });

  totalExpenses = computed(() => {
    const p = this.active();
    if (!p) return 0;
    return this.managementFeeAmt() + p.repairs + p.repairReserve + p.capExReserve +
      p.propertyTaxes + p.insurance + p.hoaFees + p.utilities +
      p.legalFees + p.cleaning + p.otherExpenses;
  });

  noi = computed(() => this.egi() - this.totalExpenses());   // monthly
  noiAnnual = computed(() => this.noi() * 12);

  expenseRatio = computed(() => {
    const egi = this.egi();
    return egi > 0 ? this.totalExpenses() / egi : 0;
  });

  capRate = computed(() => {
    const p = this.active();
    if (!p || p.purchasePrice === 0) return 0;
    return this.noiAnnual() / p.purchasePrice;
  });

  // Monthly mortgage payment (standard amortization formula)
  monthlyPayment = computed(() => {
    const p = this.active();
    if (!p || p.loanAmount === 0 || p.interestRate === 0) return 0;
    const r = p.interestRate / 100 / 12;
    const n = p.amortizationYears * 12;
    return p.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  });

  annualDebtService = computed(() => this.monthlyPayment() * 12);

  dscr = computed(() => {
    const ads = this.annualDebtService();
    return ads > 0 ? this.noiAnnual() / ads : null;
  });

  monthlyCashFlow = computed(() => this.noi() - this.monthlyPayment());
  annualCashFlow  = computed(() => this.monthlyCashFlow() * 12);

  cashOnCash = computed(() => {
    const p = this.active();
    if (!p || p.purchasePrice === 0) return 0;
    const downPayment = p.purchasePrice - p.loanAmount;
    return downPayment > 0 ? this.annualCashFlow() / downPayment : 0;
  });

  grm = computed(() => {
    const p = this.active();
    if (!p || p.grossMonthlyRent === 0) return 0;
    return p.purchasePrice / (p.grossMonthlyRent * 12);
  });

  ltv = computed(() => {
    const p = this.active();
    if (!p || p.appraisedValue === 0) return 0;
    return p.loanAmount / p.appraisedValue;
  });

  equity = computed(() => {
    const p = this.active();
    if (!p) return 0;
    return p.appraisedValue - p.loanAmount;
  });

  downPayment = computed(() => {
    const p = this.active();
    if (!p) return 0;
    return p.purchasePrice - p.loanAmount;
  });

  downPaymentPct = computed(() => {
    const p = this.active();
    if (!p || p.purchasePrice === 0) return 0;
    return this.downPayment() / p.purchasePrice;
  });

  // Break-even occupancy (STR) — what % occupancy covers all costs
  breakEvenOccupancy = computed(() => {
    const p = this.active();
    if (!p || p.grossMonthlyRent === 0) return null;
    const totalMonthlyNeeded = this.totalExpenses() + this.monthlyPayment();
    return totalMonthlyNeeded / p.grossMonthlyRent;
  });

  // Suggested vacancy rate range based on property type
  suggestedVacancy = computed(() => {
    const p = this.active() ?? this.form();
    if (p.propertyType === 'str') return '15–20% (STR — confirm with Airbnb/VRBO market data)';
    if (p.propertyType === 'multifamily') return '5–8% (multi-family — confirm with local market)';
    return '3–5% (LTR — confirm with local market)';
  });

  // 5-year projection
  fiveYearProjection = computed(() => {
    const p = this.active();
    if (!p) return [];
    const rows = [];
    let rent    = p.grossMonthlyRent;
    let value   = p.appraisedValue;
    let balance = p.loanAmount;
    const r = p.interestRate / 100 / 12;
    const n = p.amortizationYears * 12;
    const pmt = this.monthlyPayment();

    for (let yr = 1; yr <= 5; yr++) {
      rent  *= (1 + p.annualRentGrowthPct / 100);
      value *= (1 + p.annualAppreciationPct / 100);

      // Amortize 12 months
      for (let m = 0; m < 12; m++) {
        const interest = balance * r;
        const principal = pmt - interest;
        balance = Math.max(0, balance - principal);
      }

      const egi       = rent * 12 * (1 - p.vacancyRate / 100);
      const mgmtFee   = p.managementFeeIsPercent ? rent * (p.managementFee / 100) * 12 : p.managementFee * 12;
      const expenses  = mgmtFee + (p.repairs + p.repairReserve + p.capExReserve + p.propertyTaxes +
                        p.insurance + p.hoaFees + p.utilities + p.legalFees + p.cleaning + p.otherExpenses) * 12;
      const noi       = egi - expenses;
      const cashFlow  = noi - pmt * 12;
      const eq        = value - balance;

      rows.push({ year: yr, grossRent: rent * 12, noi, cashFlow, equity: eq, value });
    }
    return rows;
  });

  // ── DSCR color ────────────────────────────────────────────────────────────
  dscrColor = computed(() => {
    const d = this.dscr();
    if (d === null) return '#6B7280';
    if (d >= 1.25) return '#1D9E75';
    if (d >= 1.0)  return '#D97706';
    return '#EF4444';
  });

  expenseRatioColor = computed(() => {
    const r = this.expenseRatio();
    if (r <= 0.30) return '#1D9E75';
    if (r <= 0.40) return '#D97706';
    return '#EF4444';
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    if (!this.hasAccess()) { this.loading.set(false); return; }
    this.http.get<(RealEstateProperty & { id: string })[]>(`${this.base}/real-estate`).subscribe({
      next: props => {
        this.properties.set(props);
        if (props.length > 0) this.activeId.set(props[0].id);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  openAdd() {
    this.editingId.set(null);
    this.form.set(blankProperty());
    // Default loan to 80% of purchase price when user enters it
    this.showForm.set(true);
  }

  openEdit(prop: RealEstateProperty & { id: string }) {
    this.editingId.set(prop.id);
    this.form.set({ ...prop });
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  onPurchasePriceChange() {
    const f = this.form();
    if (f.loanAmount === 0 && f.purchasePrice > 0) {
      this.form.update(v => ({ ...v, loanAmount: Math.round(f.purchasePrice * 0.8) }));
    }
  }

  onPropertyTypeChange() {
    const f = this.form();
    const defaultVacancy = f.propertyType === 'str' ? 18 : f.propertyType === 'multifamily' ? 6 : 5;
    this.form.update(v => ({ ...v, vacancyRate: defaultVacancy }));
  }

  save() {
    const f = this.form();
    if (!f.address.trim()) { this.toast.error('Address is required.'); return; }
    this.saving.set(true);

    const id = this.editingId();
    const req = id
      ? this.http.put<RealEstateProperty & { id: string }>(`${this.base}/real-estate/${id}`, f)
      : this.http.post<RealEstateProperty & { id: string }>(`${this.base}/real-estate`, f);

    req.subscribe({
      next: saved => {
        if (id) {
          this.properties.update(list => list.map(p => p.id === id ? saved : p));
        } else {
          this.properties.update(list => [saved, ...list]);
          this.activeId.set(saved.id);
        }
        this.saving.set(false);
        this.showForm.set(false);
        this.toast.success(id ? 'Property updated.' : 'Property added.');
      },
      error: () => { this.saving.set(false); this.toast.error('Could not save. Please try again.'); }
    });
  }

  deleteProperty(id: string, address: string) {
    if (!confirm(`Remove "${address}"? This cannot be undone.`)) return;
    this.http.delete(`${this.base}/real-estate/${id}`).subscribe({
      next: () => {
        this.properties.update(list => list.filter(p => p.id !== id));
        if (this.activeId() === id) {
          const remaining = this.properties();
          this.activeId.set(remaining.length > 0 ? remaining[0].id : null);
        }
        this.toast.success('Property removed.');
      }
    });
  }

  selectProperty(id: string) {
    this.activeId.set(id);
    this.show5Year.set(false);
  }

  updateForm(field: keyof RealEstateProperty, value: any) {
    this.form.update(v => ({ ...v, [field]: value }));
  }

  fmt(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
  fmtExact(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  }
  fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }
  fmtX(v: number)   { return `${v.toFixed(2)}x`; }
}
