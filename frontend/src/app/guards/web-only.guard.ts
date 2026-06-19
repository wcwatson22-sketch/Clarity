import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/**
 * Public marketing routes are web-only. Inside the native app there is no
 * marketing site — launch should go straight to the authenticated app (which
 * the auth guard sends to /login when signed out).
 */
export const webOnlyGuard: CanActivateFn = () => {
  if (Capacitor.isNativePlatform()) {
    return inject(Router).createUrlTree(['/dashboard']);
  }
  return true;
};
