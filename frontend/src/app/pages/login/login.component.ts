import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LockService } from '../../services/lock.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private auth   = inject(AuthService);
  private lock   = inject(LockService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  username = signal('');
  password = signal('');
  loading  = signal(false);
  error    = signal('');
  notice   = signal('');

  ngOnInit() {
    // Surface the reason the user landed back here (e.g. expired session from the
    // app's Face ID gate or a 401). This is the ONLY login screen.
    if (this.route.snapshot.queryParamMap.get('reason') === 'expired') {
      this.notice.set('Your session expired. Please log in again.');
    }
  }

  submit() {
    this.error.set('');
    this.notice.set('');
    if (!this.username() || !this.password()) {
      this.error.set('Please enter your username and password.');
      return;
    }
    this.loading.set(true);
    this.auth.login({ username: this.username(), password: this.password() }).subscribe({
      next: () => {
        // Drop any native biometric gate so it can't reappear right after login.
        this.lock.unlock();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Login failed. Please try again.');
      }
    });
  }
}
