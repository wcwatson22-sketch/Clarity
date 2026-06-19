import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../services/auth.service';

/**
 * Public marketing routes are WEB-ONLY. Inside the native app there is no
 * marketing site — the login screen (signed out) or the dashboard (signed in)
 * is the anchor/landing point. This guard runs before the public layout's lazy
 * chunk loads, so the marketing site never renders or flashes in the app.
 */
export const webOnlyGuard: CanActivateFn = () => {
  if (Capacitor.isNativePlatform()) {
    const router = inject(Router);
    const loggedIn = inject(AuthService).isLoggedIn();
    return router.createUrlTree([loggedIn ? '/dashboard' : '/login']);
  }
  return true;   // web: marketing site is the public landing page
};
