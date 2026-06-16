import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && auth.isLoggedIn()) {
        // Do NOT auto-logout on /auth/refresh 401.
        // That endpoint is called by the lock screen after Face ID succeeds to
        // validate the stored session. A 401 there means the token expired while
        // the app was backgrounded — an expected, recoverable condition.
        // The lock screen handles this case by showing the password fallback.
        // Auto-logging-out would destroy the lock screen before it could show the
        // password form, leaving the user on the /login page after a successful
        // Face ID scan — which is the bug this fix addresses.
        const isTokenRefresh = req.url.includes('/auth/refresh');
        if (!isTokenRefresh) {
          // Expired/invalid session → clear state and return to the single login
          // screen with a clear message. Never a separate unlock screen.
          auth.logout('expired');
        }
      }
      return throwError(() => err);
    })
  );
};
