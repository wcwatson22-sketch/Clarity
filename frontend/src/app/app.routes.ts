import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { webOnlyGuard } from './guards/web-only.guard';
import { learnPlatformGuard } from './guards/learn-platform.guard';
import { appLearnGuard } from './guards/app-learn.guard';

export const routes: Routes = [
  // ── Public marketing site (no auth; own header/footer layout) ──────────
  {
    path: '',
    canActivate: [webOnlyGuard],
    loadComponent: () => import('./pages/public/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      { path: '', title: 'Clarity Financial Tools | Understand Your Full Financial Picture',
        data: { description: 'Track cash flow, net worth, debt, assets, liabilities, DTI, and financial progress with Clarity Financial Tools.' },
        loadComponent: () => import('./pages/public/home.component').then(m => m.PublicHomeComponent) },
      { path: 'features', title: 'Features | Clarity Financial Tools',
        data: { description: 'See what Clarity offers free and with Premium — cash flow, net worth, DTI, snapshots, Compare, Loan Prep, and real estate analysis.' },
        loadComponent: () => import('./pages/public/features.component').then(m => m.PublicFeaturesComponent) },
      { path: 'pricing', title: 'Pricing | Clarity Financial Tools',
        data: { description: 'Clarity is free forever. Upgrade to Premium for $2.99/month to unlock Compare, Loan Prep, and Real Estate tools.' },
        loadComponent: () => import('./pages/public/pricing.component').then(m => m.PublicPricingComponent) },
      { path: 'about', title: 'About Clarity Financial Tools',
        data: { description: 'Clarity began as a personal finance spreadsheet, rebuilt into a simple command center. Owned and operated by Clearpath Digital LLC.' },
        loadComponent: () => import('./pages/public/about.component').then(m => m.PublicAboutComponent) },
    ],
  },

  // ── Public Learn hub + articles (crawlable; no auth) ───────────────────────
  // Reuses the marketing PublicLayout (header/footer). learnPlatformGuard sends
  // native-app users to the in-app Learn tab (/app-learn) instead — it does NOT
  // use webOnlyGuard, so the app Learn experience is never broken.
  {
    path: 'learn',
    canActivate: [learnPlatformGuard],
    loadComponent: () => import('./pages/public/public-layout.component').then(m => m.PublicLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/public/learn-hub.component').then(m => m.LearnHubComponent) },
      { path: ':slug', loadComponent: () => import('./pages/public/learn-article.component').then(m => m.LearnArticleComponent) },
    ],
  },

  // ── Public auth (no auth required) ─────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then(m => m.SignupComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'forgot-username',
    loadComponent: () => import('./pages/forgot-username/forgot-username.component').then(m => m.ForgotUsernameComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },

  // ── Protected (requires auth) ──────────────────────────────────────────
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'cash-flow',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/cash-flow/cash-flow.component').then(m => m.CashFlowComponent)
  },
  // App Learn tab (native). On the web this redirects to the public /learn hub
  // (appLearnGuard), so Learn is not part of the authenticated website interface.
  {
    path: 'app-learn',
    canActivate: [appLearnGuard, authGuard],
    loadComponent: () => import('./pages/learn/learn.component').then(m => m.LearnComponent)
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: 'pfs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pfs/pfs.component').then(m => m.PfsComponent)
  },
  {
    path: 'compare',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/compare/compare.component').then(m => m.CompareComponent)
  },
  {
    path: 'loan-prep',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/loan-prep/loan-prep.component').then(m => m.LoanPrepComponent)
  },
  {
    path: 'loan-impact',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/loan-impact/loan-impact.component').then(m => m.LoanImpactComponent)
  },
  {
    path: 'real-estate',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/real-estate/real-estate.component').then(m => m.RealEstateComponent)
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent)
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/legal/terms.component').then(m => m.TermsComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/legal/privacy.component').then(m => m.PrivacyComponent)
  },

  { path: '**', redirectTo: '' }
];
