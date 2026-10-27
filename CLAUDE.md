# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Roadmap

This repo (PoshPaws) is **phase 1** of a larger multi-module product. Two more modules are planned:

1. An **e-commerce module** (pet products/shop).
2. A **doctor's-appointment module** (vet booking, structurally similar to the grooming booking flow).

Keep cross-cutting infrastructure (dialog/bottom-sheet primitives, the dialog-service pattern, design tokens, `shared/ui` components, the bottom-nav) generic rather than grooming-specific, so a sibling module can be added without a rework. Don't build those modules preemptively; just avoid coupling current code to grooming. The backend does not exist yet: every data source sits behind a seam (see "Data & backend seams").

## Commands

```bash
npm start               # Dev server at http://localhost:4200 (auto-reloads); /styleguide is available in dev only
npm run build           # Production build → dist/posh-paws/browser
npm test                # Unit tests (Vitest via ng test)
npm run lint:styles     # Style guard rails (see "Styles"); add -- --update to lock in an improvement
```

## Folder structure

```
src/app/
  core/            app-wide logic, no UI. Group by feature, not by file type.
    auth/          AuthProvider (port) + MockAuthProvider, AuthService, LoginDialogService, authGuard
    pets/          PetsProvider (port) + mock, PetsService, PetDialogService, pet models/options/utils
    catalog/       CatalogService + models + data (services, plans, testimonials, process steps). Prices are PAISE.
    services/      dialog state services (booking, subscribe), ThemeService
    constants/     business.ts (phone number placeholders)
  shared/
    ui/            presentational building blocks used by many pages (see list below)
    layout/        navbar, footer, bottom-nav, theme-switcher
    dialogs/       globally mounted dialogs: booking, subscribe, login, pet
  pages/           one folder per route; compose shared/ui + core data, hold only page-specific code
src/styles/        tokens, typography, layout/, components/, utilities/
scripts/           check-styles.mjs (+ style-baseline.json)
```

Rules:
- `core/` never imports from `shared/` or `pages/`. `shared/` never imports from `pages/`.
- Models stay with the feature that owns them; promote to a shared place only when a second feature needs them.
- Future modules (shop, doctor appointments) get `features/<module>/` and import only from `core/` and `shared/`, never from each other. Move pages into feature folders when module 2 starts.

## Code conventions (modern Angular only)

- **Standalone components only**; omit `standalone: true` (default since v19). Selector prefix `pp-`. `ChangeDetectionStrategy.OnPush` everywhere.
- **DI via `inject()`**, not constructor parameters.
- **Signals for state**: `signal`/`computed`/`effect`; `input()`/`output()`/`model()` instead of decorators; expose service state with `.asReadonly()`.
- **Built-in control flow** (`@if`, `@for` with `track`, `@switch`); never `*ngIf`/`*ngFor`; don't import `CommonModule`.
- **Functional guards/resolvers**; route params arrive as `input()` (router uses `withComponentInputBinding`).
- **`host: {}`** for host bindings/listeners in new code.
- **Async**: `async/await` with signals for one-shot work; RxJS only for real streams.
- **Pages are thin**: shared content (services, plans, testimonials, process steps) comes from `CatalogService`; page-specific copy (e.g. About values, Membership FAQ) may stay in the page, but the moment a second page needs it, move it to the catalog. Repeated markup becomes a `shared/ui` component.
- **Money is paise** (integer). Format with the `inr` pipe; durations with the `duration` pipe. Never store "₹1,200" strings.

## Data & backend seams

Everything is mock/static today; the seam is the only thing that changes when the backend arrives.
- `AuthProvider`, `PetsProvider`: abstract classes bound in `app.config.ts` (`MockAuthProvider`, `MockPetsProvider` use localStorage). Swap by writing one class and changing one line.
- `CatalogService`: static data today; load from an API inside this service later. Pages don't change.
- Features needing login call `await loginDialog.ensureLoggedIn()` (or use `authGuard` on a route). They never touch login UI state.
- Global dialogs: state lives in a small service (`providedIn: 'root'`, no side effects); the component (mounted once in `app.html`) owns any async work.

## Shared UI components (`src/app/shared/ui`)

`pp-icon` (SVG icon set; add icons in `icon/icons.ts`), `pp-page-hero`, `pp-section-header`, `pp-cta-banner`, `pp-service-card`, `pp-plan-card`, `pp-testimonial-card`, `pp-feature-card`, `pp-how-it-works`, `pp-accordion`, `pp-chip-group`, pipes `inr` and `duration`. See them all at `/styleguide` (dev only).

- Content slots use attributes: `ppTitle`, `ppLead`, `ppActions`, `ppVisual`, `ppFooter`, `ppAside`, `ppText`, `ppAction`. Use a `<span>`/element wrapper (not `<ng-container>`) for slot content.
- `page-hero`, `section-header` and `cta-banner` use `ViewEncapsulation.None` with `pp-` prefixed classes so headings projected from the page get styled. The cards use normal encapsulation.
- **Before writing markup or CSS twice, make or extend a shared/ui component.**

## Styles

`src/styles.scss` order: tokens → Bootstrap variable overrides → **Bootstrap** → our `typography` and `components` (loaded with `meta.load-css` *after* Bootstrap). Because ours come last, plain class selectors win; never add `!important` or extra specificity to beat Bootstrap (only to beat Bootstrap's own `!important` utilities, in files marked `lint:allow-important`).

- `src/styles/_components.scss` is only an index of partials in `layout/`, `components/`, `utilities/` (order = cascade order).
- **Tokens only**: colours `var(--pp-*)` (incl. `--pp-card-bg`, `--pp-on-primary`, `--pp-on-dark-*`), type `var(--fs-*)` (xs..6xl, `--fs-title`, `--fs-display`), spacing `var(--space-*)`, plus radius/shadow/z-index/safe-area/tap-target tokens. Themes are `[data-theme]` blocks in `_tokens.scss` (`ThemeService`, currently switcher hidden).
- Use `.on-dark` on a dark-surface section so eyebrow/headings/intro flip to light colours.
- **`npm run lint:styles`** fails if colour literals, `!important`, raw font sizes, raw px spacing or duplicate component classes increase. Currently 0/0/0/83/0; lower is better, never higher.
- Page `.scss` files hold only page-specific rules. Anything used by two pages moves to `shared/ui` or `src/styles`.

## Mobile-first layout rules

Phones are the primary target. Verify at 320, 360, 390, 430 (phone), 768, 820 (iPad portrait), 1024, 1366 (iPad landscape/laptop), 1920, 2560.

- **No sideways scroll**: Bootstrap `g-5`/`gx-5` is capped below 768px; use `overflow-x: clip` (never `hidden`) on page hosts, since `hidden` breaks `position: sticky`.
- **Touch targets ≥ 44px** (`--tap-target-min`), **text ≥ 12px** on touch layouts. `@media (pointer: coarse)` covers iPads at any width.
- **Alignment**: left-aligned on phones; centred from 768px up (`align="center"` on section-header, hero `layout="center"`).
- **Swipe rows**: add `pp-swipe` to a Bootstrap `.row` (keeps its `col-*` classes for desktop); add `pp-swipe-tablet` to keep swiping on iPad portrait; `pp-swipe-first` shows a column first. No `justify-content-center` on swipe rows (use `-lg-center`).
- **CTAs**: wrap in `.pp-cta-wrap` (full-width on phones, centred on desktop).
- **Bottom tab bar** (`pp-bottom-nav`) shows below 992px; `app.scss` reserves space on `pp-footer`. Sticky bars under the navbar use `top: var(--navbar-height-mobile)`.
- **Dialogs** use the `.pp-sheet` bottom-sheet pattern (z-index above the tab bar).
- **Large monitors**: container widens at 1600px and 2200px; root font 18px from 2200px.
- **Phones on their side** (`max-height: 500px`): slim tab bar, navbar scrolls away.

## Testing

- `npm test`: Vitest unit tests (pipes, catalog invariants, app shell smoke test). Add a `*.spec.ts` next to any new service/pipe.
- Verify UI changes in a real browser at the widths above (the `run-app` skill in `.claude/skills` describes the Playwright recipe); `ng build` alone proves nothing about layout.

## Routes / pages

All routes are lazy-loaded (`loadComponent`). `/account*` routes use `authGuard`. `/styleguide` exists only in dev mode.

| Path | Component |
|---|---|
| `/` | `HomeComponent` |
| `/services` | `ServicesComponent`: sticky dog/cat tabs, per-service Book button |
| `/about` | `AboutComponent` |
| `/membership` | `MembershipComponent`: plan cards, Subscribe dialog |
| `/gallery` | `GalleryComponent` |
| `/book` | `BookingComponent`: original 4-step wizard (CTAs now open the booking dialog instead) |
| `/account` | `AccountComponent` (login required): bookings, pets, membership |
| `/account/pets/:id` | `PetDetailsComponent` (login required) |
