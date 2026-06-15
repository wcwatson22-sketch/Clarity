import { bootstrapApplication } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

// ── Native API base-URL safety net ───────────────────────────────────────────
// The web build can use a relative apiUrl ("/api") because the site is served from
// the same origin as the API (Caddy proxies /api). But inside a Capacitor native
// app the web assets are served from capacitor://localhost, so a relative "/api"
// resolves to capacitor://localhost/api — which does not exist, breaking every API
// call (login, dashboard, everything). This guard forces the absolute production
// API URL whenever the app runs natively, regardless of which build configuration
// produced the bundle. Prevents a dev-config build from shipping a broken app.
if (Capacitor.isNativePlatform() && environment.apiUrl.startsWith('/')) {
  environment.apiUrl = 'https://clarityfinancialtools.com/api';
}

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
