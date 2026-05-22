import { Component, inject } from '@angular/core';
import { NgClass, NgFor } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [NgFor, NgClass],
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      @for (toast of toastSvc.toasts(); track toast.id) {
        <div class="toast" [ngClass]="toast.type" role="alert">
          <span class="toast-icon">{{ iconFor(toast.type) }}</span>
          <span class="toast-msg">{{ toast.message }}</span>
          <button class="toast-close" (click)="toastSvc.dismiss(toast.id)" aria-label="Dismiss">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 380px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 14px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      pointer-events: all;
      animation: slideIn 0.22s ease;
      border: 1px solid transparent;
    }

    @keyframes slideIn {
      from { opacity: 0; transform: translateY(12px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .toast.success {
      background: #F0FBF7;
      border-color: #6EE7C0;
      color: #1D9E75;
    }
    .toast.error {
      background: #FEF2F2;
      border-color: #FECACA;
      color: #991B1B;
    }
    .toast.warning {
      background: #FFFBEB;
      border-color: #FDE68A;
      color: #92400E;
    }
    .toast.info {
      background: #F0FBF7;
      border-color: #A7F3D0;
      color: #1E40AF;
    }

    .toast-icon { font-size: 16px; flex-shrink: 0; line-height: 1.3; }
    .toast-msg  { flex: 1; line-height: 1.45; }
    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      opacity: 0.55;
      padding: 0;
      flex-shrink: 0;
      line-height: 1.3;
      color: inherit;
      transition: opacity 0.15s;
    }
    .toast-close:hover { opacity: 1; }

    @media (max-width: 640px) {
      .toast-container {
        bottom: 86px; /* above mobile bottom nav */
        right: 16px;
        left: 16px;
        max-width: unset;
      }
    }
  `]
})
export class ToastComponent {
  toastSvc = inject(ToastService);

  iconFor(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warning': return '⚠';
      default:        return 'ℹ';
    }
  }
}
