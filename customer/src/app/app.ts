import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/layout/navbar/navbar.component';
import { FooterComponent } from './shared/layout/footer/footer.component';
import { BookingDialogComponent } from './shared/dialogs/booking-dialog/booking-dialog.component';
import { LoginDialogComponent } from './shared/dialogs/login-dialog/login-dialog.component';
import { BottomNavComponent } from './shared/layout/bottom-nav/bottom-nav.component';
import { PetDialogComponent } from './shared/dialogs/pet-dialog/pet-dialog.component';
import { SubscribeDialogComponent } from './shared/dialogs/subscribe-dialog/subscribe-dialog.component';
import { LoaderComponent } from './shared/components/loader/loader.component';
import { ToastComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, BookingDialogComponent, SubscribeDialogComponent, LoginDialogComponent, PetDialogComponent, BottomNavComponent, LoaderComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
