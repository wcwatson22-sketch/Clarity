import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

let _id = 0;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = computed(() => this._toasts());

  show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = ++_id;
    this._toasts.update(ts => [...ts, { id, type, message, duration }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string, duration = 4000) { this.show(message, 'success', duration); }
  error(message: string, duration = 5500)   { this.show(message, 'error', duration); }
  warning(message: string, duration = 5000) { this.show(message, 'warning', duration); }
  info(message: string, duration = 4000)    { this.show(message, 'info', duration); }

  dismiss(id: number) {
    this._toasts.update(ts => ts.filter(t => t.id !== id));
  }
}
