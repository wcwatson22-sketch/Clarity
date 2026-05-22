import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // ── Public (no auth required) ──────────────────────────────────────────
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
  {
    path: 'learn',
    canActivate: [authGuard],
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

  { path: '**', redirectTo: 'dashboard' }
];
