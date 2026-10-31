export type StaffRole = 'super_admin' | 'admin' | 'staff';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
}

/** Returned by POST /admin/auth/login. */
export interface AuthResponse {
  user: StaffUser;
  token: string;
}
