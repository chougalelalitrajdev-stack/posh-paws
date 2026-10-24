import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { BookingDialogComponent } from './shared/components/booking-dialog/booking-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, BookingDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
