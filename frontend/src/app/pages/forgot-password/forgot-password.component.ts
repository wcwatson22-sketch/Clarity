import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  email    = signal('');
  loading  = signal(false);
  sent     = signal(false);
  devLink  = signal('');  // shown only in dev when SMTP not configured
  error    = signal('');

  submit() {
    this.error.set('');
    if (!this.email().includes('@')) { this.error.set('Please enter a valid email address.'); return; }
    this.loading.set(true);
    this.http.post<any>(`${this.base}/auth/forgot-password`, { email: this.email() }).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.sent.set(true);
        if (res.resetUrl) this.devLink.set(res.resetUrl);
      },
      error: () => {
        this.loading.set(false);
        this.sent.set(true); // still show "check email" — don't leak whether email exists
      }
    });
  }
}
