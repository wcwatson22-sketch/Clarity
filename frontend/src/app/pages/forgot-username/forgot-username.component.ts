import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-username',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-username.component.html',
  styleUrl: './forgot-username.component.scss'
})
export class ForgotUsernameComponent {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  email   = signal('');
  loading = signal(false);
  sent    = signal(false);
  error   = signal('');

  submit() {
    this.error.set('');
    if (!this.email().includes('@')) { this.error.set('Please enter a valid email address.'); return; }
    this.loading.set(true);
    this.http.post(`${this.base}/auth/forgot-username`, { email: this.email() }).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: () => { this.loading.set(false); this.sent.set(true); } // never leak whether email exists
    });
  }
}
