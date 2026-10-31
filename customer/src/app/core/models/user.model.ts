export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface NewUserProfile {
  name: string;
  email?: string;
}

/** Returned by POST /auth/register, and by POST /auth/otp/verify for a known user. */
export interface AuthResponse {
  user: User;
  token: string;
}

/** POST /auth/otp/verify: a known user is logged in; a new user goes on to register. */
export type VerifyOtpResponse = ({ status: 'authenticated' } & AuthResponse) | { status: 'new-user' };
