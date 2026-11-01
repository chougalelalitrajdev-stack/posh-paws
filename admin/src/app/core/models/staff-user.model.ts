export type StaffRole = 'super_admin' | 'admin' | 'staff';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

/** Settings › Team & roles. Invited people can't sign in until they accept. */
export interface TeamMember extends StaffUser {
  status: 'active' | 'invited';
  /** ISO timestamp; null if never signed in. */
  lastSeenAt: string | null;
}

/** Returned by POST /admin/auth/login. */
export interface AuthResponse {
  user: StaffUser;
  token: string;
}
