import { environment } from '../../../environments/environment';

const api = `${environment.apiUrl}/admin`;

/** Every backend URL the admin calls. Services build requests from these, never from string literals. */
export const API = {
  auth: {
    login: `${api}/auth/login`,
    forgotPassword: `${api}/auth/forgot-password`,
  },
};
