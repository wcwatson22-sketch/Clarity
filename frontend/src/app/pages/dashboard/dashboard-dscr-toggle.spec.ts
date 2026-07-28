import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardComponent } from './dashboard.component';
import { FinanceService } from '../../services/finance.service';
import { AuthService } from '../../services/auth.service';
import { RealEstateService } from '../../services/real-estate.service';

describe('DashboardComponent — Personal DSCR / DTI toggle pill', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let reService: { hasProperties: () => boolean; properties: any; load: () => void };

  function setup(hasProperties: boolean) {
    TestBed.resetTestingModule();
    reService = {
      hasProperties: () => hasProperties, properties: () => [], load: () => {},
      totalGrossRent: () => 0, totalNOI: () => 0, totalCashFlow: () => 0,
      totalValue: () => 0, totalDebt: () => 0, totalEquity: () => 0,
      portfolioLTV: () => 0, portfolioDSCR: () => null,
    } as any;

    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: FinanceService,
          useValue: {
            getAccounts: () => of([]),
            getSnapshots: () => of([]),
            getBudget: () => of([{ id: '1', group: 'Debt', name: 'Car', amount: 500 }]),
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 10000, netMonthlyIncome: 7500 }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 5, username: 'emailtest99', firstName: 'Test' }) } },
        { provide: RealEstateService, useValue: reService },
      ],
    }).compileComponents();

    localStorage.removeItem('clarity_dash_metric_dti_5'); // clear any prior per-user override
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => localStorage.clear());

  it('defaults to DTI when the user has no investment properties', () => {
    setup(false);
    expect(component.displayDti()).toBeTrue();
  });

  it('defaults to DSCR (Personal DSCR) once the user has an investment property', () => {
    setup(true);
    expect(component.displayDti()).toBeFalse();
  });

  it('computes DTI off gross income but Personal DSCR off NET income', () => {
    setup(true);
    expect(component.debtToIncome()).toBeCloseTo(500 / 10000, 5); // DTI stays gross-based
    expect(component.personalDscr()).toBeCloseTo(7500 / 500, 5);  // DSCR is net-based
    expect(component.personalDscr()).not.toBeCloseTo(10000 / 500, 1); // confirms not accidentally gross
  });

  it('toggle pill flips the mode regardless of the default, and it sticks', () => {
    setup(true); // default DSCR
    expect(component.displayDti()).toBeFalse();
    component.toggleMetricMode();
    expect(component.displayDti()).toBeTrue(); // manually flipped to DTI

    setup(false); // default DTI
    expect(component.displayDti()).toBeTrue();
    component.toggleMetricMode();
    expect(component.displayDti()).toBeFalse(); // manually flipped to DSCR
  });

  it('Personal DSCR is null (not Infinity) when there is no debt to divide by', () => {
    TestBed.resetTestingModule();
    reService = {
      hasProperties: () => true, properties: () => [], load: () => {},
      totalGrossRent: () => 0, totalNOI: () => 0, totalCashFlow: () => 0,
      totalValue: () => 0, totalDebt: () => 0, totalEquity: () => 0,
      portfolioLTV: () => 0, portfolioDSCR: () => null,
    } as any;
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: FinanceService,
          useValue: {
            getAccounts: () => of([]),
            getSnapshots: () => of([]),
            getBudget: () => of([]), // zero debt
            getIncome: () => of({ type: 'stable', grossMonthlyIncome: 10000, netMonthlyIncome: 7500 }),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 6, username: 'x', firstName: 'X' }) } },
        { provide: RealEstateService, useValue: reService },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.personalDscr()).toBeNull();
  });
});
