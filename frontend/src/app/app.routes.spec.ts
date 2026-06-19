import { routes } from './app.routes';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { webOnlyGuard } from './guards/web-only.guard';

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

  it('leaves login and signup publicly reachable (no guard)', () => {
    expect(find('login')!.canActivate).toBeUndefined();
    expect(find('signup')!.canActivate).toBeUndefined();
  });

  it('redirects unknown routes to the public home', () => {
    expect(routes.find(r => r.path === '**')?.redirectTo).toBe('');
  });
});
