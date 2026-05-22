import { Component, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './terms-modal.component.html',
  styleUrl: './terms-modal.component.scss'
})
export class TermsModalComponent {
  /** Emitted when the user clicks "Accept & Continue" */
  accepted = output<void>();

  checked = signal(false);

  accept() {
    if (this.checked()) this.accepted.emit();
  }
}
