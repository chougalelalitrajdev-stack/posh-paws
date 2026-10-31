import { StaffRole } from '../models/staff-user.model';

export const ROLE_LABELS: Record<StaffRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
};

/** Roles that can open Settings (Team & roles inside it is Super Admin only). */
export const SETTINGS_ROLES: StaffRole[] = ['super_admin', 'admin'];

/** Team & roles, and refunds. */
export const OWNER_ROLES: StaffRole[] = ['super_admin'];

/** Requests waiting longer than this are shown as urgent. */
export const URGENT_REQUEST_MINUTES = 30;

/** Roles that can change catalog and content (services, plans, offers, banners, gallery, pages). Staff see them read-only. */
export const CATALOG_EDIT_ROLES: StaffRole[] = ['super_admin', 'admin'];

/** What each role can do (Settings › Team & roles). Keep in step with nav roles, roleGuard and the server's checks. */
export const ROLE_MATRIX: { area: string; super_admin: string; admin: string; staff: string }[] = [
  { area: 'Requests, bookings, calendar', super_admin: 'Yes', admin: 'Yes', staff: 'Yes' },
  { area: 'Customers and pets', super_admin: 'Yes', admin: 'Yes', staff: 'Yes' },
  { area: 'Payments: view', super_admin: 'Yes', admin: 'Yes', staff: 'Yes' },
  { area: 'Payments: refunds', super_admin: 'Yes', admin: 'No', staff: 'No' },
  { area: 'Services, plans, offers', super_admin: 'Yes', admin: 'Yes', staff: 'View only' },
  { area: 'Banners, gallery, pages', super_admin: 'Yes', admin: 'Yes', staff: 'View only' },
  { area: 'Message templates', super_admin: 'Yes', admin: 'Yes', staff: 'View only' },
  { area: 'Settings', super_admin: 'Yes', admin: 'All except team', staff: 'No' },
  { area: 'Team & roles', super_admin: 'Yes', admin: 'No', staff: 'No' },
];
