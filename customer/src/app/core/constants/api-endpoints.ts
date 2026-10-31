import { environment } from '../../../environments/environment';

const api = environment.apiUrl;

/** Every backend URL the app calls. Services build requests from these, never from string literals. */
export const API = {
  auth: {
    sendOtp: `${api}/auth/otp/send`,
    verifyOtp: `${api}/auth/otp/verify`,
    register: `${api}/auth/register`,
  },
  services: `${api}/services`,
  plans: `${api}/plans`,
  pets: `${api}/pets`,
  slots: `${api}/slots`,
  bookings: `${api}/bookings`,
};
