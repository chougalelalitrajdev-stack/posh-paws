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

### Routes / pages

| Path | Component |
|---|---|
| `/services` (default) | `ServicesComponent` — dog/cat tab toggle, service cards, how-it-works |
| `/about` | `AboutComponent` |
| `/membership` | `MembershipComponent` — plan cards |
| `/gallery` | `GalleryComponent` |
