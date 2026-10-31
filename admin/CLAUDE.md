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

A ✅ foundation (shell, login, roles, interceptors, toasts, confirm, mocks) · B Today, Requests, Bookings, New booking, Booking detail · C Customers, Customer profile, Pets, Subscriptions · D Services, Plans, Offers · E Banners, Gallery, Pages & FAQs · F Payments, Templates, Settings · then the FastAPI backend. Unbuilt screens route to `features/coming-soon` (see `app.routes.ts`).

## Folder structure

```
src/
  environments/          apiUrl, useMocks
  styles/                _tokens (brand colours from the design), _bootstrap-overrides, _base, components/
  app/
    core/                app-wide logic, no UI
      constants/         api-endpoints (every URL, under /api/admin), app (role labels, SETTINGS_ROLES), storage-keys
      models/            API shapes (*.model.ts)
      services/          auth, alert (toasts), loader, confirm + one per area (HTTP + signal state)
      interceptors/      auth (Bearer token), loading (progress bar), error (toast; 401 → sign out → /login; 403 toast)
      guards/            authGuard, guestGuard (login pages), roleGuard(...roles)
      handlers/          global-error.handler
      utils/             storage (local or session), error
      mocks/             TEMPORARY fake backend; add a route here for every new endpoint
    shared/
      components/        icon, toast, loader, confirm-dialog, page-header, ...
      layout/            shell (sidebar · top bar · phone tab bar + More sheet), nav-list, profile-menu, nav.config.ts
    features/            one folder per sidebar item (+ auth/, coming-soon/)
```

Rules (same as customer): imports go `features → shared → core`, never backwards; standalone + OnPush + `inject()` + signals + built-in control flow; every component has its own `.html` and `.scss`; keep it simple, no extra layers; ask before adding a new pattern or library.

## Admin-specific conventions

- **Forms use Reactive Forms** (`NonNullableFormBuilder`); show field errors once touched; disable submit while saving.
- **Roles**: `super_admin`, `admin`, `staff` (matrix in the design's Settings › Team). Hide what a role can't use (nav items carry `roles` in `nav.config.ts`) AND guard the route with `roleGuard`. Staff see catalog and content read-only; Settings is Super Admin + Admin; Team & roles and refunds are Super Admin only.
- **Confirm before destructive actions**: `await confirm.ask({ title, message, confirmLabel, tone: 'danger' })`.
- **Errors**: interceptor toasts by default; screens that show errors inline pass `{ context: withoutErrorAlert() }`.
- **Session**: "Keep me signed in" → localStorage, otherwise sessionStorage.
- **Libraries**: Bootstrap (only reboot, grid, dropdown, utilities are compiled in `styles.scss`) and ng-bootstrap (dropdowns). Add Angular CDK (drag-drop, clipboard) and ngx-quill (Pages rich text) in the phases that need them.
- **Layout**: sidebar from 992px; below that a dark header + bottom tab bar (Today, Requests, Bookings, Customers, More). Touch targets ≥ 44px. Verify at 390, 768, 1024, 1440.
