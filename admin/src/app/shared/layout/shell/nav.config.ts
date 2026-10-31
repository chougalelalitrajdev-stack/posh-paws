import { SETTINGS_ROLES } from '../../../core/constants/app.constants';
import { StaffRole } from '../../../core/models/staff-user.model';
import { IconName } from '../../components/icon/icons';

export interface NavItem {
  label: string;
  icon: IconName;
  /** Missing for "Soon" items, which aren't links yet. */
  path?: string;
  /** Only these roles see the item. Missing = everyone. */
  roles?: StaffRole[];
  soon?: boolean;
  /** Shows a live count from the shell's badge map (e.g. new requests). */
  badge?: 'requests';
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Sidebar navigation, grouped by the job staff are doing (from the admin design). */
export const NAV_GROUPS: NavGroup[] = [
  { label: '', items: [{ label: 'Today', icon: 'home', path: '/today' }] },
  {
    label: 'Operations',
    items: [
      { label: 'Requests', icon: 'phone', path: '/requests', badge: 'requests' },
      { label: 'Bookings', icon: 'calendar', path: '/bookings' },
      { label: 'Customers', icon: 'users', path: '/customers' },
      { label: 'Pets', icon: 'paw', path: '/pets' },
      { label: 'Subscriptions', icon: 'repeat', path: '/subscriptions' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Services', icon: 'scissors', path: '/services' },
      { label: 'Membership plans', icon: 'tag', path: '/plans' },
      { label: 'Offers', icon: 'percent', path: '/offers' },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Banners', icon: 'image', path: '/banners' },
      { label: 'Gallery', icon: 'grid', path: '/gallery' },
      { label: 'Pages & FAQs', icon: 'file', path: '/pages' },
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Payments', icon: 'card', path: '/payments' },
      { label: 'Message templates', icon: 'message', path: '/templates' },
    ],
  },
  {
    label: 'Coming later',
    items: [
      { label: 'Shop', icon: 'bag', soon: true },
      { label: 'Vet care', icon: 'heart', soon: true },
    ],
  },
];

/** Pinned to the bottom of the sidebar. */
export const SETTINGS_ITEM: NavItem = { label: 'Settings', icon: 'settings', path: '/settings', roles: SETTINGS_ROLES };

/** Tabs on the phone tab bar, in order. Everything else sits under "More". */
export const MOBILE_TAB_PATHS = ['/today', '/requests', '/bookings', '/customers'];
