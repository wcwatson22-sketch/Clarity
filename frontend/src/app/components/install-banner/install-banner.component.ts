import { Component, inject, signal } from '@angular/core';
import { AppInstallService } from '../../services/app-install.service';

@Component({
  selector: 'app-install-banner',
  standalone: true,
  imports: [],
  templateUrl: './install-banner.component.html',
  styleUrl: './install-banner.component.scss'
})
export class InstallBannerComponent {
  readonly install$ = inject(AppInstallService);
  readonly dismissed = signal(false);

  get show() {
    return this.install$.canInstall() && !this.dismissed() && !this.install$.isInstalled();
  }

  async install() {
    await this.install$.install();
  }

  dismiss() {
    this.dismissed.set(true);
    sessionStorage.setItem('install-banner-dismissed', '1');
  }

  ngOnInit() {
    if (sessionStorage.getItem('install-banner-dismissed')) this.dismissed.set(true);
  }
}
