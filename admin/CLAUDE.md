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

A ✅ foundation (shell, login, roles, interceptors, toasts, confirm, mocks) · B ✅ Today, Requests, Bookings (list + calendar + block time), New booking, Booking detail · C ✅ Customers, Customer profile, Pets, Subscriptions, top-bar search · D ✅ Services, Membership plans, Offers · E ✅ Banners, Gallery, Pages & FAQs · F ✅ Payments, Message templates, Settings · next: the FastAPI backend (replace `core/mocks` endpoint by endpoint).

## Folder structure

```
src/
  environments/          apiUrl, useMocks
  styles/                _tokens (brand colours from the design), _bootstrap-overrides, _base, components/
  app/
    core/                app-wide logic, no UI
      constants/         api-endpoints (every URL, under /api/admin), app (roles, booking rules), status (stage/payment/offer/banner labels + tones, booking tabs),
                         content (banner placements, customer app links, upload sizes), template (fields + samples), pet, storage-keys
      models/            API shapes (*.model.ts)
      services/          auth, alert (toasts), loader, confirm, upload (resizes then POSTs an image) + one per area: dashboard, booking (+ counts signal),
                         customer, pet, subscription, search, catalog (services + stations signals), plan, offer, banner, gallery, page (pages + FAQs),
                         payment, template (templates signal + render), settings (settings signal + team)
      interceptors/      auth (Bearer token), loading (progress bar), error (toast; 401 → sign out → /login; 403 toast)
      guards/            authGuard, guestGuard (login pages), roleGuard(...roles)
      handlers/          global-error.handler
      utils/             date (local dates, 24h times, petAge, agoLabel), money, contact (phone, tel/WhatsApp links), message (fillTemplate), csv, storage, error,
                         image (types, size limit, browser resize)
      mocks/             TEMPORARY fake backend: mock.interceptor (routing), mock-db (state in localStorage, reseeded daily), mock-data, one mock-<area>.ts per area
    shared/
      components/        icon, toast, loader, confirm-dialog, modal, share-dialog, page-header, status-pill, filter-tabs, segmented, pagination,
                         slot-picker, schedule-grid, avatar, stat, activity-list, switch, image-upload
      directives/        *ppHasRole="roles" (shows content only to those roles)
      pipes/             inr, duration
      layout/            shell (sidebar · top bar · phone tab bar + More sheet), nav-list, profile-menu, global-search, nav.config.ts
    features/            one folder per sidebar item (+ auth/); catalog/ holds services, plans, offers; content/ holds banners, gallery, pages;
                         settings/ holds the shell plus booking-settings and team-settings. A feature may reuse a sibling's component
                         when both are the same area (Customers uses pets/pet-dialog).
```

Rules (same as customer): imports go `features → shared → core`, never backwards; standalone + OnPush + `inject()` + signals + built-in control flow; every component has its own `.html` and `.scss`; keep it simple, no extra layers; ask before adding a new pattern or library.

## Admin-specific conventions

- **Forms use Reactive Forms** (`NonNullableFormBuilder`); show field errors once touched; disable submit while saving.
- **Roles**: `super_admin`, `admin`, `staff` (`ROLE_MATRIX` in app.constants, shown in Settings › Team & roles). Hide what a role can't use (nav items carry `roles` in `nav.config.ts`) AND guard the route with `roleGuard`. Staff see catalog and content read-only (`CATALOG_EDIT_ROLES`: hide buttons with `*ppHasRole`, disable the form); the server refuses their writes with 403 (`requireRole` in the mocks). Settings is Super Admin + Admin (`SETTINGS_ROLES`); Team & roles and refunds are Super Admin only (`OWNER_ROLES`).
- **Confirm before destructive actions**: `await confirm.ask({ title, message, confirmLabel, tone: 'danger' })`.
- **Errors**: interceptor toasts by default; screens that show errors inline pass `{ context: withoutErrorAlert() }`.
- **Session**: "Keep me signed in" → localStorage, otherwise sessionStorage.
- **Bookings**: one record from callback request to completed. `stage` (request → draft → awaiting_payment → confirmed → completed | cancelled | no_show) and `paymentStatus` (not_requested → link_sent → paid | failed | refunded) are separate tracks; labels and colours live in `status.constants.ts`. Customer, pet and service are snapshots on the booking. Slots are per station with a 15 min buffer and lunch blocked; the backend owns these rules.
- **Status colours**: use `<pp-status-pill [stage]>` / `[payment]` or a `.pp-tone-*` class (info, draft, warn, success, neutral, danger); never pick colours per screen.
- **Pages** space their sections with `:host { display: flex; flex-direction: column; gap }`; `pp-page-header` has no margin. Actions in the header use `ppActions` (wrap several in `<ng-container ppActions>`).
- **Customers & plans**: a customer's `plan` comes from their active subscription (never stored on the customer); booking prices use its discount. Customer, pet and booking snapshots are kept in step when details change. Customer list numbers (bookings, spent, last visit, next) are computed by the server.
- **Side lists**: pages with their own section list use `.pp-side-layout` > `nav.pp-card.pp-side-nav` (`.pp-side-nav-item`) + `.pp-side-main`.
- **Lists**: filters + `pp-pagination` + `.pp-table-wrap` (scrolls sideways on phones, `position: relative` so hidden labels don't widen the page). Check phones with a real 390px viewport (not only `isMobile`, which zooms out to fit and hides overflow).
- **List + editor screens** (Services, Offers): `.pp-split` > `.pp-split-list` + `.pp-card.pp-split-editor`; the save bar is `.pp-editor-foot` (`.is-dirty` tints it, `.pp-editor-dirty` / `.pp-editor-note` text). Ask before leaving unsaved changes (`okToLeave`); on phones scroll the editor into view after picking a row. Pick-several chips are `.pp-toggle-chips` > `button.pp-toggle-chip[aria-pressed]`; help text under a field is `.pp-hint`.
- **Catalog**: prices in the editor are whole rupees, sent as paise. Reordering uses CDK drag-drop with arrow keys on the handle as the keyboard alternative. Archived services leave the app and new bookings but keep their history. A plan's price change reaches current members at their next renewal (the renewal link charges the new price). Offer status (draft, scheduled, live, paused, used up, ended) is worked out by the server; codes are unique, upper-case. Photo upload is mocked (data URL) until storage exists.
- **Content**: banners link only to customer app pages (`APP_LINKS`); the first live banner in each placement is shown. Gallery uploads start hidden and need a caption before they're shown. Page text is plain text (a blank line = new paragraph), saved as a draft and published; fixed sections can be hidden, not removed. FAQs go live when saved. Reordering a subset (one placement, category or FAQ group) sends that subset's ids in the new order.
- **Demo photo storage**: while mocks are on, uploads are data URLs in localStorage (~5 MB). Keep upload sizes from `IMAGE_SIZES`; the mock warns at 75% and refuses past `STORAGE_LIMIT`. Real storage removes this.
- **Settings drive the rules**: booking hours, breaks, slot step, buffer, notice, book-ahead days, closures, hold amount, link expiry and the unpaid nudge live in Settings (`SettingsService.settings`, loaded once); the backend applies them when it offers slots and creates links. Screens read display values from the service (e.g. `holdPaise`, `rulesNote`), never from constants.
- **WhatsApp texts** come from Message templates: `templates.render(key, values)` with `{customer_name}` as the first name. Add a template key in the model + seed before using it. Changed texts go back to "Waiting for WhatsApp approval"; manual sends (Open WhatsApp) work regardless.
- **Payments** are worked out from bookings and plan subscriptions (one list, also the customer's Payments tab). Refunds only record the refund until a gateway is connected; the UI says so.
- **Search**: `pp-global-search` in the top bar; "/" focuses it. Add new kinds of results in `mock-search.ts` / the search endpoint.
- **WhatsApp**: until the backend can send messages, screens offer "Open WhatsApp" (wa.me link with the text filled in) and "Copy"; never claim a message was sent.
- **Libraries**: Bootstrap (only reboot, grid, dropdown, utilities are compiled in `styles.scss`), ng-bootstrap (dropdowns), Angular CDK (drag-drop). No rich-text editor: page text is plain text by decision.
- **Layout**: sidebar from 992px; below that a dark header + bottom tab bar (Today, Requests, Bookings, Customers, More). Touch targets ≥ 44px. Verify at 390, 768, 1024, 1440.
