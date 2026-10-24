import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { BookingDialogComponent } from './shared/components/booking-dialog/booking-dialog.component';
import { LoginDialogComponent } from './shared/components/login-dialog/login-dialog.component';
import { SubscribeDialogComponent } from './shared/components/subscribe-dialog/subscribe-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, BookingDialogComponent, SubscribeDialogComponent, LoginDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
