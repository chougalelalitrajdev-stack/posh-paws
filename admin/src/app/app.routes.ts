import { Routes } from '@angular/router';
import { SETTINGS_ROLES } from './core/constants/app.constants';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

const comingSoon = () => import('./features/coming-soon/coming-soon.component').then(m => m.ComingSoonComponent);

/** A screen that isn't built yet: the "coming soon" page, told its title and build phase. */
const later = (path: string, heading: string, phase: string) => ({
  path,
  title: `${heading} · Posh Paws Admin`,
  loadComponent: comingSoon,
  data: { heading, phase },
});

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · Posh Paws Admin',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    title: 'Reset password · Posh Paws Admin',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/shell/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'today' },
      later('today', 'Today', 'B'),
      later('requests', 'Requests', 'B'),
      later('bookings', 'Bookings', 'B'),
      later('bookings/new', 'New booking', 'B'),
      later('customers', 'Customers', 'C'),
      later('pets', 'Pets', 'C'),
      later('subscriptions', 'Subscriptions', 'C'),
      later('services', 'Services', 'D'),
      later('plans', 'Membership plans', 'D'),
      later('offers', 'Offers', 'D'),
      later('banners', 'Banners', 'E'),
      later('gallery', 'Gallery', 'E'),
      later('pages', 'Pages & FAQs', 'E'),
      later('payments', 'Payments', 'F'),
      later('templates', 'Message templates', 'F'),
      { ...later('settings', 'Settings', 'F'), canActivate: [roleGuard(...SETTINGS_ROLES)] },
    ],
  },
  { path: '**', redirectTo: '' },
];
