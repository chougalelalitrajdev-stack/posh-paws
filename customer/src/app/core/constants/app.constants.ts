// The shop's contact details come from the admin (Settings › Business, via GET /shop).

// Login
export const PHONE_MIN_DIGITS = 10;
export const OTP_LENGTH = 6;

// Booking (the advance and the cancellation window come from the server: CatalogService.shop)
/** How many days ahead (including today) customers can book. */
export const BOOKING_WINDOW_DAYS = 14;
