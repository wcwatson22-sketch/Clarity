import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { RealEstateService } from './real-estate.service';
import { PlanAccessService } from './plan-access.service';
import { environment } from '../../environments/environment';

describe('RealEstateService', () => {
  let service: RealEstateService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlanAccessService, useValue: { canRealEstate: () => true } },
      ],
    });
    service = TestBed.inject(RealEstateService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('refetches on every load() call instead of caching forever after the first result', () => {
    // First load: empty (e.g. PFS/Dashboard visited before any property exists yet).
    service.load();
    httpMock.expectOne(`${environment.apiUrl}/real-estate`).flush([]);
    expect(service.properties()).toEqual([]);
    expect(service.hasProperties()).toBeFalse();

    // A property gets added elsewhere (the Real Estate tab manages its own CRUD,
    // independent of this shared service) — load() must pick it up on the next call.
    service.load();
    const prop = { id: '1', address: '123 Main St', grossMonthlyRent: 2000 } as any;
    httpMock.expectOne(`${environment.apiUrl}/real-estate`).flush([prop]);
    expect(service.properties().length).toBe(1);
    expect(service.hasProperties()).toBeTrue();
  });

  it('does not call the API when the plan lacks real-estate access', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlanAccessService, useValue: { canRealEstate: () => false } },
      ],
    });
    service = TestBed.inject(RealEstateService);
    httpMock = TestBed.inject(HttpTestingController);

    service.load();
    httpMock.expectNone(`${environment.apiUrl}/real-estate`);
    expect(service.loaded()).toBeTrue();
  });
});
