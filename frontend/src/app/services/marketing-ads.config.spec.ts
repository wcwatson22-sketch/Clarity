import { isApprovedAdRoute } from './marketing-ads.config';

describe('marketing ads — route isolation', () => {
  it('approves ONLY the public marketing home and Learn routes', () => {
    for (const ok of ['/', '', '/learn', '/learn/what-is-dti', '/learn/rental-property-cash-flow?x=1']) {
      expect(isApprovedAdRoute(ok)).withContext(ok).toBeTrue();
    }
  });

  it('rejects every authenticated / auth / other route (no ads in the app)', () => {
    for (const bad of [
      '/dashboard', '/cash-flow', '/real-estate', '/compare', '/loan-prep', '/loan-impact',
      '/pfs', '/settings', '/admin', '/admin/learn', '/app-learn',
      '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email',
      '/features', '/pricing', '/about',   // marketing but NOT approved for ads
    ]) {
      expect(isApprovedAdRoute(bad)).withContext(bad).toBeFalse();
    }
  });

  it('does not let a query/hash smuggle an approved prefix', () => {
    expect(isApprovedAdRoute('/dashboard?next=/learn')).toBeFalse();
    expect(isApprovedAdRoute('/dashboard#/learn')).toBeFalse();
  });
});
