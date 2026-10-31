import { Paise } from '../models/catalog.model';

// Placeholder business contact details — swap for the real values before launch.
export const BUSINESS_PHONE_DISPLAY = '+91 00000 00000';
export const BUSINESS_PHONE_TEL = '+910000000000';

// Login
export const PHONE_MIN_DIGITS = 10;
export const OTP_LENGTH = 6;

// Booking
/** Refundable amount paid online to hold a slot. */
export const BOOKING_DEPOSIT_PAISE: Paise = 10000;
/** How many days ahead (including today) customers can book. */
export const BOOKING_WINDOW_DAYS = 14;
/** Cancelling at least this many hours before the slot refunds the deposit. */
export const FREE_CANCELLATION_HOURS = 24;
