# CLAUDE.md: customer app

Guidance for the customer-facing Angular app in `customer/`. Monorepo-wide rules are in `../CLAUDE.md`. Run every command below from `customer/`.

## Roadmap

The customer app is **phase 1** of a larger multi-module product. Two more modules are planned:

1. An **e-commerce module** (pet products/shop).
2. A **doctor's-appointment module** (vet booking, structurally similar to the grooming booking flow).

Keep cross-cutting infrastructure (dialog/bottom-sheet primitives, the dialog-service pattern, design tokens, `shared/components`, the bottom-nav) generic rather than grooming-specific, so a sibling module can be added without a rework. Don't build those modules preemptively; just avoid coupling current code to grooming. The FastAPI backend (`../backend`) is not built yet, so `core/mocks` stands in for it (see "Data, API & errors").

## Commands

```bash
npm start               # Dev server at http://localhost:4200 (auto-reloads); /styleguide is available in dev only
npm run build           # Production build → dist/posh-paws/browser
npm test                # Unit tests (Vitest via ng test)
npm run lint:styles     # Style guard rails (see "Styles"); add -- --update to lock in an improvement
```

## Folder structure

```
src/
  environments/        environment.ts (prod) / environment.development.ts (ng serve): apiUrl, useMocks
  app/
    core/              app-wide logic, no UI. Grouped by file type.
      constants/       api-endpoints.ts (every API URL), app.constants.ts, storage-keys.ts, pet.constants.ts, content.constants.ts
      models/          API shapes: user, pet, catalog, booking (*.model.ts)
      services/        one per domain, HTTP + signal state: auth, pet, booking, catalog
                       app helpers: alert (toasts), loader, theme, and the dialog state services
      interceptors/    auth (Bearer token), loading (progress bar), error (toast / logout on 401)
      guards/          auth.guard.ts
      handlers/        global-error.handler.ts (uncaught errors -> toast)
      utils/           date, pet, error, storage, text helpers (plain functions)
      mocks/           TEMPORARY fake backend (mock.interceptor.ts + mock-data.ts); delete when the API is live
    shared/            reusable UI, never calls the API
      components/      presentational building blocks (list below) + toast + loader
      dialogs/         globally mounted dialogs: booking (parked), subscribe, login, pet
      layout/          navbar, footer, bottom-nav, theme-switcher
      pipes/           inr, duration
    features/          one folder per route (lazy-loaded): page component + page-only code
  styles/              tokens, typography, layout/, components/, utilities/
scripts/               check-styles.mjs (+ style-baseline.json)
```

Rules:
- Imports go `features -> shared -> core`, never backwards. `core/` never imports `shared/` or `features/`.
- File names: `*.component.ts|html|scss`, `*.service.ts`, `*.interceptor.ts`, `*.guard.ts`, `*.pipe.ts`, `*.model.ts`, `*.constants.ts`, `*.utils.ts`. Every component has separate `.html` and `.scss` files.
- Keep it simple: no extra layers (no provider/port classes, no context objects). Ask before adding a new pattern.
- Future modules (shop, vet appointments) get their own folders under `features/` and import only from `core/` and `shared/`, never from each other.

## Code conventions (modern Angular only)

- **Standalone components only**; omit `standalone: true` (default since v19). Selector prefix `pp-`. `ChangeDetectionStrategy.OnPush` everywhere.
- **DI via `inject()`**, not constructor parameters.
- **Signals for state**: `signal`/`computed`/`effect`; `input()`/`output()`/`model()` instead of decorators; expose service state with `.asReadonly()`.
- **Built-in control flow** (`@if`, `@for` with `track`, `@switch`); never `*ngIf`/`*ngFor`; don't import `CommonModule`.
- **Functional guards/resolvers**; route params arrive as `input()` (router uses `withComponentInputBinding`).
- **`host: {}`** for host bindings/listeners in new code.
- **Async**: `async/await` with signals for one-shot work; RxJS only for real streams.
- **Pages are thin**: shared content (services, plans, testimonials, process steps) comes from `CatalogService`; page-specific copy (e.g. About values, Membership FAQ) may stay in the page, but the moment a second page needs it, move it to the catalog. Repeated markup becomes a `shared/components` component.
- **Money is paise** (integer). Format with the `inr` pipe; durations with the `duration` pipe. Never store "₹1,200" strings.

## Data, API & errors

- **Services call the API directly** with `HttpClient` + `firstValueFrom`, using URLs from `core/constants/api-endpoints.ts`, and hold results in signals (expose with `.asReadonly()`). Components never call `HttpClient`.
- **API contract** (camelCase JSON, money in paise, `{ "detail": "..." }` errors) is in the root `../CLAUDE.md`. Models in `core/models` mirror it.
- **Mocks:** while `environment.useMocks` is true, `core/mocks/mock.interceptor.ts` answers every API call from localStorage (demo OTP `123456`). Add a mock route whenever you add an endpoint. When the FastAPI endpoint exists, nothing in services or pages changes.
- **Errors:** the error interceptor turns every failed request into a toast (`AlertService`) and logs the user out on 401. If a screen shows the error itself, the service passes `{ context: withoutErrorAlert() }` and the component shows `errorMessage(e)` inline. `GlobalErrorHandler` toasts anything uncaught (it ignores HTTP errors, already reported).
- **State:** global state in root services (user, alerts, loading, catalog), feature state in the domain service (my pets, my bookings), screen state in component signals. No NgRx.
- **Loading:** the loading interceptor drives the top progress bar (`pp-loader`); components use their own `loading` signals for inline spinners.
- **Login:** features needing login call `await loginDialog.ensureLoggedIn()` (or use `authGuard`). They never touch login UI state.
- **Global dialogs:** state lives in a small service in `core/services` (`providedIn: 'root'`); the component (mounted once in `app.html`) owns any async work. The call/callback `BookingDialogService` dialog is parked: its calls are commented out where "Book" buttons now `router.navigate(['/book'], { queryParams })`.

## Shared components (`src/app/shared/components`)

`pp-icon` (SVG icon set; add icons in `icon/icons.ts`), `pp-page-hero`, `pp-section-header`, `pp-cta-banner`, `pp-service-card`, `pp-plan-card`, `pp-testimonial-card`, `pp-feature-card`, `pp-how-it-works`, `pp-accordion`, `pp-chip-group`, `pp-date-strip`, `pp-slot-grid`, `pp-toast`, `pp-loader`; pipes `inr` and `duration` in `shared/pipes`. See them all at `/styleguide` (dev only).

- Content slots use attributes: `ppTitle`, `ppLead`, `ppActions`, `ppVisual`, `ppFooter`, `ppAside`, `ppText`, `ppAction`. Use a `<span>`/element wrapper (not `<ng-container>`) for slot content.
- `page-hero`, `section-header` and `cta-banner` use `ViewEncapsulation.None` with `pp-` prefixed classes so headings projected from the page get styled. The cards use normal encapsulation.
- **Before writing markup or CSS twice, make or extend a shared component.**

## Styles

`src/styles.scss` order: tokens → Bootstrap variable overrides → **Bootstrap** → our `typography` and `components` (loaded with `meta.load-css` *after* Bootstrap). Because ours come last, plain class selectors win; never add `!important` or extra specificity to beat Bootstrap (only to beat Bootstrap's own `!important` utilities, in files marked `lint:allow-important`).

- `src/styles/_components.scss` is only an index of partials in `layout/`, `components/`, `utilities/` (order = cascade order).
- **Tokens only**: colours `var(--pp-*)` (incl. `--pp-card-bg`, `--pp-on-primary`, `--pp-on-dark-*`), type `var(--fs-*)` (xs..6xl, `--fs-title`, `--fs-display`), spacing `var(--space-*)`, plus radius/shadow/z-index/safe-area/tap-target tokens. Themes are `[data-theme]` blocks in `_tokens.scss` (`ThemeService`, currently switcher hidden).
- Use `.on-dark` on a dark-surface section so eyebrow/headings/intro flip to light colours.
- **`npm run lint:styles`** fails if colour literals, `!important`, raw font sizes, raw px spacing or duplicate component classes increase. Currently 0/0/0/59/0; lower is better, never higher.
- Page `.scss` files hold only page-specific rules. Anything used by two pages moves to `shared/components` or `src/styles`.

## Mobile-first layout rules

Phones are the primary target. Verify at 320, 360, 390, 430 (phone), 768, 820 (iPad portrait), 1024, 1366 (iPad landscape/laptop), 1920, 2560.

- **No sideways scroll**: Bootstrap `g-5`/`gx-5` is capped below 768px; use `overflow-x: clip` (never `hidden`) on page hosts, since `hidden` breaks `position: sticky`.
- **Touch targets ≥ 44px** (`--tap-target-min`), **text ≥ 12px** on touch layouts. `@media (pointer: coarse)` covers iPads at any width.
- **Alignment**: left-aligned on phones; centred from 768px up (`align="center"` on section-header, hero `layout="center"`).
- **Swipe rows**: add `pp-swipe` to a Bootstrap `.row` (keeps its `col-*` classes for desktop); add `pp-swipe-tablet` to keep swiping on iPad portrait; `pp-swipe-first` shows a column first. No `justify-content-center` on swipe rows (use `-lg-center`).
- **CTAs**: wrap in `.pp-cta-wrap` (full-width on phones, centred on desktop). A flow's pinned action bar uses `.pp-sticky-cta` (sits above the tab bar below 992px).
- **Bottom tab bar** (`pp-bottom-nav`) shows below 992px; `app.scss` reserves space on `pp-footer`. Sticky bars under the navbar use `top: var(--navbar-height-mobile)`.
- **Dialogs** use the `.pp-sheet` bottom-sheet pattern (z-index above the tab bar).
- **Large monitors**: container widens at 1600px and 2200px; root font 18px from 2200px.
- **Phones on their side** (`max-height: 500px`): slim tab bar, navbar scrolls away.

## Testing

- `npm test`: Vitest unit tests (pipes, date utils, the fake API's rules, app shell smoke test). Add a `*.spec.ts` next to logic worth testing (utils, pipes, services with rules).
- Verify UI changes in a real browser at the widths above (the `run-app` skill in `.claude/skills` describes the Playwright recipe); `ng build` alone proves nothing about layout.

## Routes

All routes are lazy-loaded from `features/` (`loadComponent`). `/account*` routes use `authGuard`. `/styleguide` exists only in dev mode.

| Path | Component |
|---|---|
| `/` | `HomeComponent` |
| `/services` | `ServicesComponent`: sticky dog/cat tabs, per-service Book button |
| `/about` | `AboutComponent` |
| `/membership` | `MembershipComponent`: plan cards, Subscribe dialog |
| `/gallery` | `GalleryComponent` |
| `/book` | `BookingComponent`: slot booking: service → date & time → pet → review → payment (dummy ₹100 slot hold until a gateway is added) → confirmed, with a link to My bookings. Query params `pet`, `service`, `petId` prefill it; login is asked for before the pet step; a 409 (slot taken) sends the user back to pick a new time |
| `/account` | `AccountComponent` (login required): bookings (from `BookingService`, with cancel), pets, membership |
| `/account/pets/:id` | `PetDetailsComponent` (login required) |
