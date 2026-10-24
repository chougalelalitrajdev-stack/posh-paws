import { Injectable } from '@angular/core';
import { AuthProvider } from './auth.provider';
import { AuthUser, NewUserProfile, VerifyOtpResult } from './auth.models';

const MOCK_OTP = '123456';
const REGISTRY_KEY = 'pp_mock_users';
const LATENCY_MS = 500;

/** Stand-in until a backend exists. Known phones are remembered in localStorage. */
@Injectable()
export class MockAuthProvider extends AuthProvider {
  override readonly devHint = `Demo mode — use code ${MOCK_OTP}.`;

  async sendOtp(): Promise<void> {
    await this.delay();
  }

  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    await this.delay();
    if (code !== MOCK_OTP) return { status: 'invalid-code' };

    const user = this.readRegistry()[phone];
    return user ? { status: 'authenticated', user } : { status: 'new-user' };
  }

  async createProfile(phone: string, profile: NewUserProfile): Promise<AuthUser> {
    await this.delay();
    const user: AuthUser = { id: `mock-${phone}`, phone, ...profile };
    this.writeRegistry({ ...this.readRegistry(), [phone]: user });
    return user;
  }

  private delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, LATENCY_MS));
  }

  private readRegistry(): Record<string, AuthUser> {
    try {
      return JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private writeRegistry(registry: Record<string, AuthUser>): void {
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    } catch {
      // Storage unavailable (private mode) — the mock just forgets the user.
    }
  }
}
