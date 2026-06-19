import { TestBed } from '@angular/core/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('sets a production canonical and og:url for the route', () => {
    const seo = TestBed.inject(SeoService);
    seo.update({ title: 'Pricing | Clarity Financial Tools', description: 'desc', path: '/pricing' });

    const canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    expect(canonical).toBeTruthy();
    expect(canonical.href).toBe('https://clarityfinancialtools.com/pricing');

    const ogUrl = document.head.querySelector('meta[property="og:url"]') as HTMLMetaElement;
    expect(ogUrl.content).toBe('https://clarityfinancialtools.com/pricing');
    expect(ogUrl.content.startsWith('https://clarityfinancialtools.com')).toBeTrue();
  });
});
