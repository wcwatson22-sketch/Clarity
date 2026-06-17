import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { PlanAccessService } from './plan-access.service';
import { environment } from '../../environments/environment';
import { RealEstateProperty } from '../pages/real-estate/real-estate.component';

@Injectable({ providedIn: 'root' })
export class RealEstateService {
  private http  = inject(HttpClient);
  private auth  = inject(AuthService);
  private plans = inject(PlanAccessService);
  private base  = environment.apiUrl;

  properties = signal<(RealEstateProperty & { id: string })[]>([]);
  loaded     = signal(false);

  load() {
    if (this.loaded()) return;
    if (!this.plans.canRealEstate()) {
      this.loaded.set(true);
      return;
    }
    this.http.get<(RealEstateProperty & { id: string })[]>(`${this.base}/real-estate`).subscribe({
      next: props => { this.properties.set(props); this.loaded.set(true); },
      error: ()   => this.loaded.set(true)
    });
  }

  private propMetrics(p: RealEstateProperty) {
    const gross    = p.grossMonthlyRent + p.otherMonthlyIncome;
    const egi      = gross * (1 - p.vacancyRate / 100);
    const mgmt     = p.managementFeeIsPercent ? p.grossMonthlyRent * (p.managementFee / 100) : p.managementFee;
    const expenses = mgmt + p.repairs + p.repairReserve + p.capExReserve +
      p.propertyTaxes + p.insurance + p.hoaFees + p.utilities +
      p.legalFees + p.cleaning + p.otherExpenses;
    const noi = egi - expenses;
    const r   = p.interestRate / 100 / 12;
    const n   = p.amortizationYears * 12;
    const pmt = (p.loanAmount > 0 && p.interestRate > 0)
      ? p.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      : 0;
    return { noi, pmt, cashFlow: noi - pmt };
  }

  totalGrossRent  = computed(() => this.properties().reduce((s, p) => s + p.grossMonthlyRent, 0));
  totalNOI        = computed(() => this.properties().reduce((s, p) => s + this.propMetrics(p).noi, 0));
  totalCashFlow   = computed(() => this.properties().reduce((s, p) => s + this.propMetrics(p).cashFlow, 0));
  totalValue      = computed(() => this.properties().reduce((s, p) => s + p.appraisedValue, 0));
  totalDebt       = computed(() => this.properties().reduce((s, p) => s + p.loanAmount, 0));
  totalEquity     = computed(() => this.totalValue() - this.totalDebt());
  portfolioLTV    = computed(() => {
    const v = this.totalValue();
    return v > 0 ? this.totalDebt() / v : 0;
  });
  portfolioDSCR   = computed(() => {
    let noi = 0, ds = 0;
    for (const p of this.properties()) {
      const m = this.propMetrics(p);
      noi += m.noi * 12;
      ds  += m.pmt * 12;
    }
    return ds > 0 ? noi / ds : null;
  });

  hasProperties = computed(() => this.properties().length > 0);
}
