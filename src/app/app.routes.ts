import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ServicesComponent } from './pages/services/services.component';
import { AboutComponent } from './pages/about/about.component';
import { MembershipComponent } from './pages/membership/membership.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { BookingComponent } from './pages/booking/booking.component';
import { AccountComponent } from './pages/account/account.component';

export const routes: Routes = [
  { path: '',            component: HomeComponent },
  { path: 'services',   component: ServicesComponent },
  { path: 'about',      component: AboutComponent },
  { path: 'membership', component: MembershipComponent },
  { path: 'gallery',    component: GalleryComponent },
  { path: 'book',       component: BookingComponent },
  { path: 'account',    component: AccountComponent },
];
