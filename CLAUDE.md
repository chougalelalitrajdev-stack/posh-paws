# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Roadmap

This repo (PoshPaws) is **phase 1** of a larger multi-module product. Two more modules are planned:

1. An **e-commerce module** (pet products/shop).
2. A **doctor's-appointment module** (vet booking — structurally similar to the grooming booking flow).

Favor architecture that stays easy to extend when those land — keep cross-cutting infrastructure (dialog/bottom-sheet primitives, the booking/subscribe-dialog service pattern, design tokens in `_tokens.scss`/`_components.scss`, the bottom-nav primitive) generic and reusable rather than grooming-specific, so a sibling module can be added rather than requiring a rework. Don't build those modules preemptively — just avoid coupling current routes/services/components tightly enough to grooming that adding one later becomes a rewrite.

## Commands

```bash
npm start          # Dev server at http://localhost:4200 (auto-reloads)
npm run build      # Production build → dist/
npm run watch      # Dev build with watch mode
npm test           # Run unit tests with Vitest
ng generate component path/to/name   # Scaffold new component
```

## Architecture

**PoshPaws** is an Angular 21 pet grooming web app (standalone components, signals-based state).

### Key structural decisions

- **Standalone components only** — no NgModules. Every component declares its own `imports`.
- **Signals everywhere** — use `signal()`, `computed()`, `effect()` for state; avoid RxJS Subject/BehaviorSubject for local state.
- **`ChangeDetectionStrategy.OnPush`** is the default for all components.
- Component selector prefix is `pp-` (e.g. `pp-theme-switcher`).
- New components go under `src/app/shared/components/` (reusable UI) or `src/app/core/` (singleton services/guards).

### Code conventions (modern Angular only)

- **Standalone components only**; omit `standalone: true` in new components (it is the default since v19).
- **DI via `inject()`**, not constructor parameters.
- **Signals for all state**: `signal`/`computed`/`effect`, `input()`/`output()`/`model()` instead of `@Input`/`@Output`, `viewChild()` instead of `@ViewChild`. Expose service state as `.asReadonly()` signals.
- **Built-in control flow** (`@if`, `@for` with `track`, `@switch`), never `*ngIf`/`*ngFor`/`ngSwitch`. Don't import `CommonModule`.
- **Functional guards/resolvers/interceptors** (`CanActivateFn` etc.), not class-based.
- **`host: {}` metadata** for host bindings/listeners in new code, not `@HostBinding`/`@HostListener`.
- **Async work**: prefer `async/await` with signals for one-shot calls; use RxJS only where streams are genuinely needed (e.g. `HttpClient`, router events).
- **Decoupling**: depend on abstractions at boundaries (e.g. `AuthProvider` abstract class bound in `app.config.ts`), keep UI state services free of side effects, and never import from `pages/` into `core/` or `shared/`.

### Folder & model organisation

- **Group by feature, not by file type.** A feature's models, services, and guards live together (e.g. `core/auth/`). Don't create a global `models/` folder.
- **Models stay with the feature that owns them**; promote one to `src/app/shared/models/` only when a second feature needs it.
- **Future modules** (shop, doctor appointments) get their own `features/<module>/` folder and import only from `core/` and `shared/`, never from each other.

### Theme system

Theming is CSS-variable-based, driven by `ThemeService` (`src/app/core/services/theme.service.ts`):

1. Five themes defined in `THEMES` array: `warm-natural` (default), `fresh-teal`, `sober-luxe`, `soft-rose`, `pure-white`.
2. `ThemeService.setTheme(id)` sets `data-theme="<id>"` on `<html>` via an `effect()`.
3. All theme color variables are defined in `src/styles/_tokens.scss` as `[data-theme="<id>"]` selector blocks.
4. **Never hardcode hex values in components** — always use `var(--pp-*)` CSS custom properties.
5. Active theme is persisted to `localStorage` under key `pp_theme`.

### Stylesheet import order (styles.scss)

Order is critical — changing it will break Bootstrap variable overrides:
1. `_tokens.scss` — CSS custom properties / theme definitions
2. `_bootstrap-overrides.scss` — Bootstrap Sass variable overrides (must precede Bootstrap)
3. Bootstrap SCSS
4. `_typography.scss` — fonts and text utilities
5. `_components.scss` — shared component styles

### CSS variable naming

All design tokens follow `--pp-*` prefix. Key variables:
- Colors: `--pp-primary`, `--pp-primary-dark`, `--pp-primary-light`, `--pp-accent`, `--pp-accent-dark`, `--pp-accent-light`
- Surfaces: `--pp-bg`, `--pp-surface`, `--pp-surface-2`, `--pp-sand`
- Text: `--pp-text`, `--pp-muted`, `--pp-subtle`
- Borders: `--pp-border`, `--pp-border-strong`
- Special: `--pp-navbar-bg`, `--pp-footer-bg`
- Shared (not per-theme): `--ff-serif`, `--ff-sans`, `--radius`, `--radius-lg`, `--radius-pill`, `--shadow-sm/md/lg`, `--transition`
- Spacing scale: `--space-1` through `--space-24` (rem-based; use these instead of hardcoding px values)
- Section rhythm: `--section-y`, `--section-y-sm`, `--section-y-xs`, `--section-y-lg` (clamp-based fluid values)

### Shared utility classes (`_components.scss`)

Prefer these over writing equivalent styles per-component:

- **Section spacing**: `.section-pad`, `.section-pad-sm`, `.section-pad-xs`, `.section-pad-lg` — apply to `<section>` elements
- **Backgrounds**: `.bg-pp-surface`, `.bg-pp-surface2`, `.bg-pp-primary`, `.bg-pp-accent`
- **Buttons**: `.btn-pp-primary`, `.btn-pp-accent`, `.btn-pp-outline`, `.btn-pp-ghost`
- **Form**: `.pp-label`, `.pp-input`
- **Cards**: `.service-card`, `.plan-card`, `.testimonial-card`, `.dash-card`
- **Animations**: `.animate-blob`, `.animate-float`, `.fade-in-up` + `.delay-1/2/3`

### Mobile-first layout rules

Phones are the primary target; verify every change at 360, 390, 430 (phone), 768 (tablet) and 1280+ (desktop).

- **No sideways scroll** at any width. Bootstrap `g-5`/`gx-5` is capped to 1.5rem below 768px (in `_components.scss`); don't re-widen it. Use `overflow-x: clip` (never `hidden`) on page hosts, since `hidden` breaks `position: sticky`.
- **Touch targets ≥ 44px** (`--tap-target-min`) and **text ≥ 12px** on touch layouts (below 992px). Desktop nav links may be smaller.
- **Text alignment:** left-aligned on phones; centred only from 768px up (`text-md-center`; `.eyebrow.center` is tablet-and-up).
- **Section headers on phones:** wrap eyebrow + title in `.pp-section-head` with a `.pp-see-all d-md-none` link on the right (see Home). Phone section spacing is tightened via `--section-y*` overrides in `_tokens.scss`. Dog/cat tabs are a full-width segmented control.
- **Long lists become swipe rows on phones:** add `pp-swipe` to a Bootstrap `.row` (keeps its `col-*` classes for tablet/desktop). Don't put `justify-content-center` on it; use `justify-content-md-center`. Add `pp-swipe-first` to a column to show it first.
- **CTAs:** wrap in `.pp-cta-wrap` for a full-width button on phones, centred on desktop.
- **Bottom tab bar** (`pp-bottom-nav`) shows below 992px; `app.scss` reserves space for it. Sticky bars under the navbar use `top: var(--navbar-height-mobile)`.
- **Dialogs** use the `.pp-sheet` bottom-sheet pattern (z-index above the tab bar).
- **Screen tiers** (all verified): phones 320–767 (swipe rows, tab bar), iPad portrait 768–991 (`pp-swipe-tablet` rows with 46% cards, two-column hero, tab bar), iPad landscape and laptops 992–1599 (desktop layout, no tab bar), large monitors 1600+ (wider container; root font 18px from 2200px). Touch devices of any width get 44px targets via `@media (pointer: coarse)`. Phones held sideways (`max-height: 500px`) get a slimmer tab bar and a navbar that scrolls away.
- **Specificity:** Bootstrap's CSS compiles after `_components.scss`, so equal-specificity rules lose. Use `.row.pp-swipe`, `body .container` or `!important` (documented) when overriding it.

### Routes / pages

All routes are lazy-loaded (`loadComponent`). `/account*` routes use `authGuard`.

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
