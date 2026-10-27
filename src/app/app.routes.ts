import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'services',
    loadComponent: () => import('./pages/services/services.component').then(m => m.ServicesComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'membership',
    loadComponent: () => import('./pages/membership/membership.component').then(m => m.MembershipComponent),
  },
  {
    path: 'gallery',
    loadComponent: () => import('./pages/gallery/gallery.component').then(m => m.GalleryComponent),
  },
  {
    path: 'book',
    loadComponent: () => import('./pages/booking/booking.component').then(m => m.BookingComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account/account.component').then(m => m.AccountComponent),
  },
  {
    path: 'account/pets/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pet-details/pet-details.component').then(m => m.PetDetailsComponent),
  },

  // Development-only reference page; not registered in production builds.
  ...(isDevMode()
    ? [{
        path: 'styleguide',
        loadComponent: () => import('./pages/styleguide/styleguide.component').then(m => m.StyleguideComponent),
      }]
    : []),
];
