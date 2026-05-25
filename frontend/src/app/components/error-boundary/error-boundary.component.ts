import { Component, ErrorHandler, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

/** Global Angular error handler — catches unhandled component errors.
 *
 *  We deliberately ignore HttpErrorResponse: every HTTP call should have
 *  its own error: callback, and routing a 4xx/5xx to the full-screen
 *  overlay is user-hostile.  Only genuine render/component crashes (null
 *  dereferences, template errors, etc.) ever reach the overlay.
 */
export class GlobalErrorHandler implements ErrorHandler {
  private boundary = inject(ErrorBoundaryService, { optional: true });

  handleError(error: unknown): void {
    // ── HTTP errors ── handled per-request; never show the overlay
    if (error instanceof HttpErrorResponse) {
      if (!['prod', 'production'].includes((window as any).__env?.mode ?? '')) {
        console.warn('[Clarity] HTTP error:', error.status, error.url);
      }
      return;
    }

    // ── Chunk-load errors ── transient network issue; just log, don't alarm user
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
      console.warn('[Clarity] Chunk load error (retrying may help):', msg);
      return;
    }

    // ── Navigation errors ── router handles these itself
    if (msg.includes('NavigationError') || msg.includes('Redirect')) return;

    // ── Biometric/plugin errors from async ngOnInit ── non-fatal
    if (
      msg.includes('BiometricAuth') ||
      msg.includes('plugin is not implemented') ||
      msg.includes('not available')
    ) {
      console.warn('[Clarity] Native plugin error (non-fatal):', msg);
      return;
    }

    // Genuine unhandled component/template error — show the overlay
    console.error('[Clarity] Unhandled error:', error);
    this.boundary?.recordError(error);
  }
}

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ErrorBoundaryService {
  readonly hasError = signal(false);
  readonly errorMessage = signal('');

  recordError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    this.errorMessage.set(msg);
    this.hasError.set(true);
  }

  clear() {
    this.hasError.set(false);
    this.errorMessage.set('');
  }
}

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  template: `
    @if (svc.hasError()) {
      <div class="error-overlay">
        <div class="error-card">
          <div class="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>Clarity ran into an unexpected error. Your data is safe.</p>
          <div class="error-actions">
            <button class="btn-primary" (click)="reload()">Reload page</button>
            <button class="btn-secondary" (click)="dismiss()">Dismiss</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .error-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.6);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .error-card {
      background: #fff; border-radius: 20px;
      padding: 40px 32px; max-width: 400px; width: 100%;
      text-align: center; box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    }
    .error-icon { font-size: 48px; margin-bottom: 12px; }
    h2 { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 8px; }
    p  { font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0 0 24px; }
    .error-actions { display: flex; gap: 12px; justify-content: center; }
    .btn-primary {
      background: #1D9E75; color: #fff; border: none;
      border-radius: 10px; padding: 10px 24px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      &:hover { background: #085041; }
    }
    .btn-secondary {
      background: #F3F4F6; color: #374151; border: 1px solid #D1D5DB;
      border-radius: 10px; padding: 10px 24px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      &:hover { background: #E5E7EB; }
    }
  `]
})
export class ErrorBoundaryComponent {
  readonly svc = inject(ErrorBoundaryService);
  private router = inject(Router);

  reload() {
    this.svc.clear();
    window.location.reload();
  }

  dismiss() {
    this.svc.clear();
    this.router.navigate(['/dashboard']);
  }
}
