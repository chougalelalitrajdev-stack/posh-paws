import { AuthUser, NewUserProfile, VerifyOtpResult } from './auth.models';

/**
 * Backend port for authentication. AuthService depends only on this
 * contract; swap the implementation in app.config.ts to go real.
 */
export abstract class AuthProvider {
  /** Shown in the login UI while a mock/dev provider is active. */
  readonly devHint?: string;

  abstract sendOtp(phone: string): Promise<void>;
  abstract verifyOtp(phone: string, code: string): Promise<VerifyOtpResult>;
  abstract createProfile(phone: string, profile: NewUserProfile): Promise<AuthUser>;
}
