import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  private http    = inject(HttpClient);
  private route   = inject(ActivatedRoute);
  private router  = inject(Router);
  private base    = environment.apiUrl;

  token      = signal('');
  newPw      = signal('');
  confirmPw  = signal('');
  loading    = signal(false);
  success    = signal(false);
  error      = signal('');

  ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!t) { this.error.set('Invalid or missing reset token.'); }
    this.token.set(t);
  }

  submit() {
    this.error.set('');
    if (this.newPw().length < 6) { this.error.set('Password must be at least 6 characters.'); return; }
    if (this.newPw() !== this.confirmPw()) { this.error.set('Passwords do not match.'); return; }
    this.loading.set(true);
    this.http.post(`${this.base}/auth/reset-password`, { token: this.token(), newPassword: this.newPw() }).subscribe({
      next: () => { this.loading.set(false); this.success.set(true); setTimeout(() => this.router.navigate(['/login']), 2500); },
      error: (err) => { this.loading.set(false); this.error.set(err.error?.error ?? 'Reset failed. Link may have expired.'); }
    });
  }
}
