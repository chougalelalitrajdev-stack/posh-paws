export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export interface NewUserProfile {
  name: string;
  email?: string;
}

export type VerifyOtpResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'new-user' }
  | { status: 'invalid-code' };

export const PHONE_MIN_DIGITS = 10;

export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}
