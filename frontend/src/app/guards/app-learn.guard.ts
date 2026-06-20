import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/**
 * /app-learn hosts the native app's in-app Learn experience (the existing
 * LearnComponent). It is intentionally NOT part of the authenticated WEBSITE
 * interface — on the web, Learn lives on the public marketing site (/learn).
 *
 * So on web we redirect /app-learn → /learn (the public hub). On native we
 * allow it through; the authGuard that follows handles the login requirement.
 */
export const appLearnGuard: CanActivateFn = () => {
  if (!Capacitor.isNativePlatform()) {
    return inject(Router).createUrlTree(['/learn']);
  }
  return true;
};
