import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';

/**
 * The PUBLIC Learn hub (/learn, /learn/:slug) is web-only marketing content.
 * Inside the native app there is no marketing chrome — the app has its own
 * Learn tab. On native, send Learn requests to the in-app Learn experience
 * (/app-learn) instead of rendering the public marketing pages.
 *
 * NOTE: this is intentionally NOT webOnlyGuard — webOnlyGuard would bounce the
 * native user to the dashboard and break the Learn tab. This guard preserves
 * Learn access inside the app.
 */
export const learnPlatformGuard: CanActivateFn = (route) => {
  if (Capacitor.isNativePlatform()) {
    const router = inject(Router);
    // Preserve a direct article link where possible; otherwise the hub.
    const slug = route.params['slug'];
    return router.createUrlTree(['/app-learn'], slug ? { queryParams: { article: slug } } : {});
  }
  return true; // web: public Learn is the crawlable marketing experience
};
