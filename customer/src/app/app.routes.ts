import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'services',
    loadComponent: () => import('./features/services/services.component').then(m => m.ServicesComponent),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about.component').then(m => m.AboutComponent),
  },
  {
    path: 'membership',
    loadComponent: () => import('./features/membership/membership.component').then(m => m.MembershipComponent),
  },
  {
    path: 'gallery',
    loadComponent: () => import('./features/gallery/gallery.component').then(m => m.GalleryComponent),
  },
  {
    path: 'book',
    loadComponent: () => import('./features/booking/booking.component').then(m => m.BookingComponent),
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./features/account/account.component').then(m => m.AccountComponent),
  },
  {
    path: 'account/pets/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/pet-details/pet-details.component').then(m => m.PetDetailsComponent),
  },

  // Development-only reference page; not registered in production builds.
  ...(isDevMode()
    ? [{
        path: 'styleguide',
        loadComponent: () => import('./features/styleguide/styleguide.component').then(m => m.StyleguideComponent),
      }]
    : []),
];
