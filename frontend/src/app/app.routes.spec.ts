import { routes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { webOnlyGuard } from './guards/web-only.guard';
import { learnPlatformGuard } from './guards/learn-platform.guard';
import { appLearnGuard } from './guards/app-learn.guard';

const find = (p: string) => routes.find(r => r.path === p);

describe('app routes', () => {
  it('exposes the public marketing layout at "" (web-only) with the marketing children', () => {
    const root = find('');
    expect(root).toBeTruthy();
    expect(root!.canActivate).toContain(webOnlyGuard);
    const childPaths = (root!.children ?? []).map(c => c.path);
    expect(childPaths).toEqual(jasmine.arrayContaining(['', 'features', 'pricing', 'about']));
  });

  it('keeps the financial platform routes behind authGuard', () => {
    for (const p of ['dashboard', 'cash-flow', 'settings', 'compare', 'loan-prep', 'real-estate', 'loan-impact']) {
      const r = find(p);
      expect(r).withContext(p).toBeTruthy();
      expect(r!.canActivate).withContext(p).toContain(authGuard);
    }
  });

  it('protects admin with adminGuard', () => {
    expect(find('admin')!.canActivate).toContain(adminGuard);
  });

  it('protects the Learn CMS (/admin/learn) with adminGuard', () => {
    const r = routes.find(x => x.path === 'admin/learn');
    expect(r).toBeTruthy();
    expect(r!.canActivate).toContain(adminGuard);
  });

  it('leaves login and signup publicly reachable (no guard)', () => {
    expect(find('login')!.canActivate).toBeUndefined();
    expect(find('signup')!.canActivate).toBeUndefined();
  });

  it('serves a public Learn hub + articles (no authGuard/webOnlyGuard; native-aware)', () => {
    const learn = find('learn');
    expect(learn).toBeTruthy();
    // Public Learn must NOT sit behind authGuard or webOnlyGuard (would break crawling / the app tab).
    expect(learn!.canActivate).toContain(learnPlatformGuard);
    expect(learn!.canActivate).not.toContain(authGuard);
    expect(learn!.canActivate).not.toContain(webOnlyGuard);
    const childPaths = (learn!.children ?? []).map(c => c.path);
    expect(childPaths).toEqual(jasmine.arrayContaining(['', ':slug']));
  });

  it('hosts the in-app Learn experience at /app-learn (auth, web→public redirect), not /learn', () => {
    const appLearn = find('app-learn');
    expect(appLearn).toBeTruthy();
    expect(appLearn!.canActivate).toContain(appLearnGuard);
    expect(appLearn!.canActivate).toContain(authGuard);
    // The old authenticated "learn" dashboard route is gone (now public).
    const learn = find('learn');
    expect(learn!.canActivate).not.toContain(authGuard);
  });

  it('redirects unknown routes to the public home', () => {
    expect(routes.find(r => r.path === '**')?.redirectTo).toBe('');
  });

  // AppComponent derives whether to show the public marketing header/footer (vs.
  // the authenticated sidebar/bottom-nav) from `data.publicLayout` — this is the
  // single source of truth (see app.component.ts `isPublicPage`). A route missing
  // this flag falls back to the authenticated shell, so every route meant to look
  // public must explicitly declare it here.
  describe('publicLayout route data (single source of truth for app shell visibility)', () => {
    const marketingChildren = () => find('')!.children ?? [];
    const learnChildren = () => find('learn')!.children ?? [];

    it('flags every public marketing child route (/, /features, /pricing, /about, /calculators/...)', () => {
      for (const path of ['', 'features', 'pricing', 'about', 'calculators/debt-to-income-ratio']) {
        const r = marketingChildren().find(c => c.path === path);
        expect(r).withContext(path).toBeTruthy();
        expect(r!.data?.['publicLayout']).withContext(path).toBe(true);
      }
    });

    it('flags the Learn hub and article routes', () => {
      for (const path of ['', ':slug']) {
        const r = learnChildren().find(c => c.path === path);
        expect(r).withContext(path).toBeTruthy();
        expect(r!.data?.['publicLayout']).withContext(path).toBe(true);
      }
    });

    it('flags /terms — public, indexable, uses the marketing layout (no sidebar/app chrome)', () => {
      // /terms lives in its own `path: ''` group (separate from the main
      // marketing-site group), so search across all top-level '' groups for it.
      const r = routes
        .filter(top => top.path === '')
        .flatMap(top => top.children ?? [])
        .find(c => c.path === 'terms');
      expect(r).toBeTruthy();
      expect(r!.data?.['publicLayout']).toBe(true);
    });

    it('has no Angular route for /privacy — a static file at public/privacy/index.html ' +
       'is served directly and is the single authoritative Privacy Policy', () => {
      expect(find('privacy')).toBeUndefined();
    });

    it('does NOT flag any authenticated/private route', () => {
      for (const path of ['dashboard', 'cash-flow', 'settings', 'compare', 'loan-prep', 'real-estate', 'admin', 'login', 'signup']) {
        expect(find(path)?.data?.['publicLayout']).withContext(path).not.toBe(true);
      }
    });
  });
});
