import { ApplicationConfig, ErrorHandler, isDevMode } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { nativeHttpInterceptor } from './interceptors/native-http.interceptor';
import { GlobalErrorHandler } from './components/error-boundary/error-boundary.component';

export const appConfig: ApplicationConfig = {
  providers: [
    // Scroll to the top on every navigation (e.g. clicking a related Learn
    // article should start at the top, not retain the previous scroll position),
    // and restore position on back/forward.
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor, nativeHttpInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    // Disable service worker on native (Capacitor) — iOS 16+ supports SW in WKWebView
    // but Angular's ngsw navigation handler intercepts API calls returning index.html
    provideServiceWorker('ngsw-worker.js', {
      enabled: false,
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ]
};
