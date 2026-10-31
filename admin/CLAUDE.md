# CLAUDE.md: admin app

Guidance for the staff admin Angular app in `admin/`. Monorepo-wide rules and the API contract are in `../CLAUDE.md`. Run every command from `admin/`. The screens follow the "Posh Paws Admin" design (claude.ai artifact); build each screen to match it.

## Commands

```bash
npm start               # http://localhost:4300
npm run build           # → dist/admin/browser
npm test                # Vitest unit tests
npm run lint:styles     # tokens-only styles; every count must stay 0
```

## Build phases

A ✅ foundation (shell, login, roles, interceptors, toasts, confirm, mocks) · B ✅ Today, Requests, Bookings (list + calendar + block time), New booking, Booking detail · C ✅ Customers, Customer profile, Pets, Subscriptions, top-bar search · D Services, Plans, Offers · E Banners, Gallery, Pages & FAQs · F Payments, Templates, Settings · then the FastAPI backend. Unbuilt screens route to `features/coming-soon` (see `app.routes.ts`).

## Folder structure

```
src/
  environments/          apiUrl, useMocks
  styles/                _tokens (brand colours from the design), _bootstrap-overrides, _base, components/
  app/
    core/                app-wide logic, no UI
      constants/         api-endpoints (every URL, under /api/admin), app (roles, booking rules), status (stage/payment labels + tones, booking tabs), storage-keys
      models/            API shapes (*.model.ts)
      services/          auth, alert (toasts), loader, confirm + one per area: dashboard, booking (+ counts signal), customer, pet, subscription, search, catalog
      interceptors/      auth (Bearer token), loading (progress bar), error (toast; 401 → sign out → /login; 403 toast)
      guards/            authGuard, guestGuard (login pages), roleGuard(...roles)
      handlers/          global-error.handler
      utils/             date (local dates, 24h times, petAge), money, contact (phone, tel/WhatsApp links), message (WhatsApp texts), csv, storage, error
      mocks/             TEMPORARY fake backend: mock.interceptor (routing), mock-db (state in localStorage, reseeded daily), mock-data, one mock-<area>.ts per area
    shared/
      components/        icon, toast, loader, confirm-dialog, modal, share-dialog, page-header, status-pill, filter-tabs, segmented, pagination,
                         slot-picker, schedule-grid, avatar, stat, activity-list
      pipes/             inr, duration
      layout/            shell (sidebar · top bar · phone tab bar + More sheet), nav-list, profile-menu, global-search, nav.config.ts
    features/            one folder per sidebar item (+ auth/, coming-soon/). A feature may reuse a sibling's component
                         when both are the same area (Customers uses pets/pet-dialog).
```

Rules (same as customer): imports go `features → shared → core`, never backwards; standalone + OnPush + `inject()` + signals + built-in control flow; every component has its own `.html` and `.scss`; keep it simple, no extra layers; ask before adding a new pattern or library.

## Admin-specific conventions

- **Forms use Reactive Forms** (`NonNullableFormBuilder`); show field errors once touched; disable submit while saving.
- **Roles**: `super_admin`, `admin`, `staff` (matrix in the design's Settings › Team). Hide what a role can't use (nav items carry `roles` in `nav.config.ts`) AND guard the route with `roleGuard`. Staff see catalog and content read-only; Settings is Super Admin + Admin; Team & roles and refunds are Super Admin only.
- **Confirm before destructive actions**: `await confirm.ask({ title, message, confirmLabel, tone: 'danger' })`.
- **Errors**: interceptor toasts by default; screens that show errors inline pass `{ context: withoutErrorAlert() }`.
- **Session**: "Keep me signed in" → localStorage, otherwise sessionStorage.
- **Bookings**: one record from callback request to completed. `stage` (request → draft → awaiting_payment → confirmed → completed | cancelled | no_show) and `paymentStatus` (not_requested → link_sent → paid | failed | refunded) are separate tracks; labels and colours live in `status.constants.ts`. Customer, pet and service are snapshots on the booking. Slots are per station with a 15 min buffer and lunch blocked; the backend owns these rules.
- **Status colours**: use `<pp-status-pill [stage]>` / `[payment]` or a `.pp-tone-*` class (info, draft, warn, success, neutral, danger); never pick colours per screen.
- **Pages** space their sections with `:host { display: flex; flex-direction: column; gap }`; `pp-page-header` has no margin. Actions in the header use `ppActions` (wrap several in `<ng-container ppActions>`).
- **Customers & plans**: a customer's `plan` comes from their active subscription (never stored on the customer); booking prices use its discount. Customer, pet and booking snapshots are kept in step when details change. Customer list numbers (bookings, spent, last visit, next) are computed by the server.
- **Lists**: filters + `pp-pagination` + `.pp-table-wrap` (scrolls sideways on phones, `position: relative` so hidden labels don't widen the page). Check phones with a real 390px viewport (not only `isMobile`, which zooms out to fit and hides overflow).
- **Search**: `pp-global-search` in the top bar; "/" focuses it. Add new kinds of results in `mock-search.ts` / the search endpoint.
- **WhatsApp**: until the backend can send messages, screens offer "Open WhatsApp" (wa.me link with the text filled in) and "Copy"; never claim a message was sent.
- **Libraries**: Bootstrap (only reboot, grid, dropdown, utilities are compiled in `styles.scss`) and ng-bootstrap (dropdowns). Add Angular CDK (drag-drop, clipboard) and ngx-quill (Pages rich text) in the phases that need them.
- **Layout**: sidebar from 992px; below that a dark header + bottom tab bar (Today, Requests, Bookings, Customers, More). Touch targets ≥ 44px. Verify at 390, 768, 1024, 1440.
