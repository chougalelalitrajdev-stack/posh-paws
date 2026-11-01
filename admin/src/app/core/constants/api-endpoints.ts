import { environment } from '../../../environments/environment';

const api = `${environment.apiUrl}/admin`;

/** Every backend URL the admin calls. Services build requests from these, never from string literals. */
export const API = {
  auth: {
    login: `${api}/auth/login`,
    forgotPassword: `${api}/auth/forgot-password`,
  },
  dashboard: `${api}/dashboard`,
  bookings: `${api}/bookings`,
  bookingCounts: `${api}/bookings/counts`,
  calendar: `${api}/calendar`,
  slots: `${api}/slots`,
  blocks: `${api}/blocks`,
  customers: `${api}/customers`,
  customerCounts: `${api}/customers/counts`,
  customerLookup: `${api}/customers/lookup`,
  pets: `${api}/pets`,
  petCounts: `${api}/pets/counts`,
  subscriptions: `${api}/subscriptions`,
  subscriptionSummary: `${api}/subscriptions/summary`,
  search: `${api}/search`,
  services: `${api}/services`,
  plans: `${api}/plans`,
  offers: `${api}/offers`,
  banners: `${api}/banners`,
  gallery: `${api}/gallery`,
  pages: `${api}/pages`,
  faqs: `${api}/faqs`,
  uploads: `${api}/uploads`,
  payments: `${api}/payments`,
  paymentSummary: `${api}/payments/summary`,
  templates: `${api}/templates`,
  settings: `${api}/settings`,
  team: `${api}/team`,
  stations: `${api}/stations`,
};
