import { StaffRole } from '../models/staff-user.model';

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
};

/** Roles that can open Settings (Team & roles inside it is Super Admin only). */
export const SETTINGS_ROLES: StaffRole[] = ['super_admin', 'admin'];
