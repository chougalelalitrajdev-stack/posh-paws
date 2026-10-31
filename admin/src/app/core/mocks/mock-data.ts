import { StaffUser } from '../models/staff-user.model';

// Data the fake API serves until the backend is live. It becomes the backend's seed data.

/** Password for every demo account while mocks are on. */
export const MOCK_PASSWORD = 'pawsword';

/** Demo staff accounts, one per role (names from the admin design). */
export const STAFF: StaffUser[] = [
  { id: 'st-1', name: 'Sanjay R.', email: 'owner@poshpaws.in', role: 'super_admin' },
  { id: 'st-2', name: 'Meera K.', email: 'meera@poshpaws.in', role: 'admin' },
  { id: 'st-3', name: 'Amit J.', email: 'amit@poshpaws.in', role: 'staff' },
];
