import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// ── Theme definitions ─────────────────────────────────────────
export interface Theme {
  id: string;
  name: string;
  description: string;
  primaryHex: string;   // for color swatch in switcher UI
  accentHex: string;
}

export const THEMES: Theme[] = [
  {
    id: 'warm-natural',
    name: 'Warm Natural',
    description: 'Forest green · Amber · Earthy cream',
    primaryHex: '#2D6A4F',
    accentHex: '#F4A261',
  },
  {
    id: 'fresh-teal',
    name: 'Fresh Teal',
    description: 'Deep teal · Coral rose · Mint white',
    primaryHex: '#0F7B6C',
    accentHex: '#FF6B6B',
  },
  {
    id: 'sober-luxe',
    name: 'Sober Luxe',
    description: 'Espresso · Taupe gold · Warm ivory',
    primaryHex: '#3D2B1F',
    accentHex: '#B8956A',
  },
  {
    id: 'soft-rose',
    name: 'Soft Rose',
    description: 'Deep plum · Peach coral · Blush pink',
    primaryHex: '#8B3A62',
    accentHex: '#F4845F',
  },
  {
    id: 'pure-white',
    name: 'Pure White',
    description: 'Clean white · Modern blue · Soft gray',
    primaryHex: '#2563EB',
    accentHex: '#10B981',
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Dark',
    description: 'Dark navy · Soft blue · Mint green',
    primaryHex: '#60A5FA',
    accentHex: '#34D399',
  }
];

const STORAGE_KEY = 'pp_theme';
const DEFAULT_THEME = 'warm-natural';

// ─────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // ── State ──────────────────────────────────────────────────
  readonly activeThemeId = signal<string>(this.loadSavedTheme());
  readonly themes = THEMES;

  // ── Computed ───────────────────────────────────────────────
  readonly activeTheme = computed(() =>
    THEMES.find(t => t.id === this.activeThemeId()) ?? THEMES[0]
  );

  constructor() {
    // Apply theme to <html> whenever signal changes
    effect(() => {
      this.applyTheme(this.activeThemeId());
    });
  }

  // ── Public API ─────────────────────────────────────────────

  /** Set a theme by ID — validates against known themes */
  setTheme(id: string): void {
    const valid = THEMES.find(t => t.id === id);
    if (!valid) {
      console.warn(`ThemeService: unknown theme "${id}"`);
      return;
    }
    this.activeThemeId.set(id);
    this.saveTheme(id);
  }

  /** Cycle to the next theme (useful for a quick-toggle button) */
  cycleTheme(): void {
    const idx = THEMES.findIndex(t => t.id === this.activeThemeId());
    const nextIdx = (idx + 1) % THEMES.length;
    this.setTheme(THEMES[nextIdx].id);
  }

  // ── Private ────────────────────────────────────────────────

  /**
   * Sets data-theme="<id>" on <html>.
   * The CSS in _tokens.scss uses [data-theme="<id>"] selectors,
   * so this single attribute change swaps every CSS variable
   * simultaneously — zero JavaScript color manipulation needed.
   */
  private applyTheme(id: string): void {
    if (!this.isBrowser) return;
    document.documentElement.setAttribute('data-theme', id);
  }

  private saveTheme(id: string): void {
    if (!this.isBrowser) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }

  private loadSavedTheme(): string {
    if (!this.isBrowser) return DEFAULT_THEME;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return THEMES.find(t => t.id === saved) ? saved! : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  }
}
