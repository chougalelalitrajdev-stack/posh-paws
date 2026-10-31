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
      {
        path: 'today',
        title: 'Today · Posh Paws Admin',
        loadComponent: () => import('./features/today/today.component').then(m => m.TodayComponent),
      },
      {
        path: 'requests',
        title: 'Requests · Posh Paws Admin',
        loadComponent: () => import('./features/requests/requests.component').then(m => m.RequestsComponent),
      },
      {
        path: 'bookings',
        title: 'Bookings · Posh Paws Admin',
        loadComponent: () => import('./features/bookings/booking-list/booking-list.component').then(m => m.BookingListComponent),
      },
      {
        path: 'bookings/new',
        title: 'New booking · Posh Paws Admin',
        loadComponent: () => import('./features/bookings/new-booking/new-booking.component').then(m => m.NewBookingComponent),
      },
      {
        path: 'bookings/:id',
        title: 'Booking · Posh Paws Admin',
        loadComponent: () => import('./features/bookings/booking-detail/booking-detail.component').then(m => m.BookingDetailComponent),
      },
      {
        path: 'customers',
        title: 'Customers · Posh Paws Admin',
        loadComponent: () => import('./features/customers/customer-list/customer-list.component').then(m => m.CustomerListComponent),
      },
      {
        path: 'customers/:id',
        title: 'Customer · Posh Paws Admin',
        loadComponent: () => import('./features/customers/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent),
      },
      {
        path: 'pets',
        title: 'Pets · Posh Paws Admin',
        loadComponent: () => import('./features/pets/pet-list/pet-list.component').then(m => m.PetListComponent),
      },
      {
        path: 'subscriptions',
        title: 'Subscriptions · Posh Paws Admin',
        loadComponent: () => import('./features/subscriptions/subscription-list.component').then(m => m.SubscriptionListComponent),
      },
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
