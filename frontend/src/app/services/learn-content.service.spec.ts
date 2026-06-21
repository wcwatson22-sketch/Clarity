import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LearnContentService } from './learn-content.service';
import { environment } from '../../environments/environment';

describe('LearnContentService', () => {
  let svc: LearnContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [LearnContentService] });
    svc = TestBed.inject(LearnContentService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('maps published articles from the API', () => {
    let result: any[] = [];
    svc.list().subscribe(r => (result = r));
    http.expectOne(`${environment.apiUrl}/learn/articles`).flush([
      { slug: 'a', title: 'A', summary: 's', category: 'dti', isFeatured: true, readingTimeMinutes: 5, featuredImageUrl: '' },
    ]);
    expect(result.length).toBe(1);
    expect(result[0].slug).toBe('a');
    expect(result[0].readMinutes).toBe(5);
  });

  it('falls back to bundled static content when the API errors', () => {
    let result: any[] = [];
    svc.list().subscribe(r => (result = r));
    http.expectOne(`${environment.apiUrl}/learn/articles`).error(new ProgressEvent('fail'));
    // Static fallback has the 12 published seed articles.
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(a => a.slug === 'what-is-dti')).toBeTrue();
  });

  it('falls back to static for a single article when the API errors', () => {
    let result: any = undefined;
    svc.get('what-is-dti').subscribe(r => (result = r));
    http.expectOne(`${environment.apiUrl}/learn/articles/what-is-dti`).error(new ProgressEvent('fail'));
    expect(result?.slug).toBe('what-is-dti');
    expect(result?.content?.length).toBeGreaterThan(100);
  });
});
