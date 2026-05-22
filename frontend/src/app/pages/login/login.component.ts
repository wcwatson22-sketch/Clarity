import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  username = signal('');
  password = signal('');
  loading  = signal(false);
  error    = signal('');

  submit() {
    this.error.set('');
    if (!this.username() || !this.password()) {
      this.error.set('Please enter your username and password.');
      return;
    }
    this.loading.set(true);
    this.auth.login({ username: this.username(), password: this.password() }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Login failed. Please try again.');
      }
    });
  }
}
