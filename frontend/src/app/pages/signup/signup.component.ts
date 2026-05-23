import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NumericDirective } from '../../directives/numeric.directive';

export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
  'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
  'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
  'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
  'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
  'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming','District of Columbia'
];

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, NumericDirective],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  readonly states = US_STATES;

  firstName       = signal('');
  username        = signal('');
  password        = signal('');
  confirmPassword = signal('');
  email           = signal('');
  state           = signal('');
  city            = signal('');
  age             = signal('');

  loading       = signal(false);
  error         = signal('');
  termsAccepted = signal(false);

  submit() {
    this.error.set('');

    // Validation
    if (!this.firstName().trim()) {
      this.error.set('First name is required.'); return;
    }
    if (!this.username() || this.username().length < 3) {
      this.error.set('Username must be at least 3 characters.'); return;
    }
    if (!this.password() || this.password().length < 6) {
      this.error.set('Password must be at least 6 characters.'); return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.error.set('Passwords do not match.'); return;
    }
    if (!this.email() || !this.email().includes('@')) {
      this.error.set('Please enter a valid email address.'); return;
    }
    if (!this.state()) {
      this.error.set('Please select your state.'); return;
    }
    if (!this.city().trim()) {
      this.error.set('Please enter your city.'); return;
    }
    const ageNum = parseInt(this.age(), 10);
    if (isNaN(ageNum) || ageNum < 18 || ageNum > 120) {
      this.error.set('Age must be between 18 and 120.'); return;
    }
    if (!this.termsAccepted()) {
      this.error.set('You must accept the Privacy Policy and Terms of Service to continue.'); return;
    }

    this.loading.set(true);
    this.auth.signup({
      username: this.username(),
      password: this.password(),
      firstName: this.firstName().trim(),
      email: this.email(),
      state: this.state(),
      city: this.city(),
      age: ageNum,
    }).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error ?? 'Sign-up failed. Please try again.');
      }
    });
  }
}
