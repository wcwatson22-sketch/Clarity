import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms.component.html',
  styleUrl: './legal.component.scss'
})
export class TermsComponent {
  readonly auth = inject(AuthService);
}
