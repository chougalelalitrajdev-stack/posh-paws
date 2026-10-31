import { Routes } from '@angular/router';
import { SETTINGS_ROLES } from './core/constants/app.constants';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

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
      {
        path: 'services',
        title: 'Services · Posh Paws Admin',
        loadComponent: () => import('./features/catalog/services/services.component').then(m => m.ServicesComponent),
      },
      {
        path: 'plans',
        title: 'Membership plans · Posh Paws Admin',
        loadComponent: () => import('./features/catalog/plans/plans.component').then(m => m.PlansComponent),
      },
      {
        path: 'offers',
        title: 'Offers · Posh Paws Admin',
        loadComponent: () => import('./features/catalog/offers/offers.component').then(m => m.OffersComponent),
      },
      {
        path: 'banners',
        title: 'Banners · Posh Paws Admin',
        loadComponent: () => import('./features/content/banners/banners.component').then(m => m.BannersComponent),
      },
      {
        path: 'gallery',
        title: 'Gallery · Posh Paws Admin',
        loadComponent: () => import('./features/content/gallery/gallery.component').then(m => m.GalleryComponent),
      },
      {
        path: 'pages',
        title: 'Pages & FAQs · Posh Paws Admin',
        loadComponent: () => import('./features/content/pages/pages.component').then(m => m.PagesComponent),
      },
      {
        path: 'payments',
        title: 'Payments · Posh Paws Admin',
        loadComponent: () => import('./features/payments/payment-list.component').then(m => m.PaymentListComponent),
      },
      {
        path: 'templates',
        title: 'Message templates · Posh Paws Admin',
        loadComponent: () => import('./features/templates/templates.component').then(m => m.TemplatesComponent),
      },
      {
        path: 'settings',
        title: 'Settings · Posh Paws Admin',
        canActivate: [roleGuard(...SETTINGS_ROLES)],
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
