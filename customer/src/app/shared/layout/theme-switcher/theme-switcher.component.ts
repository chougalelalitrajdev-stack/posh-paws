import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../../../core/services/theme.service';

@Component({
  selector: 'pp-theme-switcher',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Toggle button -->
    <button
      class="theme-toggle-btn"
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
      aria-label="Switch theme"
      title="Switch theme">
      <span class="toggle-swatch"
        [style.background]="theme.activeTheme().primaryHex">
      </span>
      <span class="toggle-label">{{ theme.activeTheme().name }}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
           [style.transform]="open() ? 'rotate(180deg)' : 'none'"
           style="transition:.2s">
        <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5"
              stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <!-- Dropdown panel -->
    @if (open()) {
      <div class="theme-panel" role="listbox" aria-label="Choose theme">
        <div class="theme-panel-header">Choose a theme</div>

        @for (t of theme.themes; track t.id) {
          <button
            class="theme-option"
            role="option"
            [class.active]="theme.activeThemeId() === t.id"
            [attr.aria-selected]="theme.activeThemeId() === t.id"
            (click)="selectTheme(t)">

            <!-- Dual swatch -->
            <div class="option-swatches">
              <div class="swatch-primary" [style.background]="t.primaryHex"></div>
              <div class="swatch-accent"  [style.background]="t.accentHex"></div>
            </div>

            <!-- Labels -->
            <div class="option-text">
              <div class="option-name">{{ t.name }}</div>
              <div class="option-desc">{{ t.description }}</div>
            </div>

            <!-- Active tick -->
            @if (theme.activeThemeId() === t.id) {
              <svg class="option-tick" width="16" height="16" viewBox="0 0 16 16">
                <path d="M3 8l3.5 3.5L13 5" stroke="currentColor"
                      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                      fill="none"/>
              </svg>
            }
          </button>
        }
      </div>

      <!-- Backdrop to close on outside click -->
      <div class="theme-backdrop" (click)="open.set(false)"></div>
    }
  `,
  styles: [`
    :host {
      position: relative;
      display: inline-block;
    }

    .theme-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      border-radius: var(--radius-pill);
      border: 1.5px solid var(--pp-border);
      background: white;
      color: var(--pp-text);
      font-family: var(--ff-sans);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: border-color var(--transition), box-shadow var(--transition);

      &:hover {
        border-color: var(--pp-primary);
        box-shadow: var(--shadow-sm);
      }
    }

    .toggle-swatch {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      flex-shrink: 0;
      transition: background .3s;
    }

    .toggle-label { color: var(--pp-text); }

    /* ── Dropdown panel ── */
    .theme-panel {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      background: white;
      border: 1px solid var(--pp-border);
      border-radius: var(--radius-lg);
      padding: 8px;
      width: 260px;
      box-shadow: var(--shadow-lg);
      z-index: 1100;
      animation: slideDown .18s ease;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: none; }
    }

    .theme-panel-header {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: var(--pp-muted);
      padding: 6px 10px 10px;
    }

    /* ── Theme option row ── */
    .theme-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: var(--radius);
      border: none;
      background: transparent;
      cursor: pointer;
      transition: background var(--transition);
      text-align: left;

      &:hover  { background: var(--pp-surface); }
      &.active { background: var(--pp-primary-light); }
    }

    .option-swatches {
      display: flex;
      flex-direction: column;
      gap: 3px;
      flex-shrink: 0;
    }

    .swatch-primary,
    .swatch-accent {
      width: 20px;
      height: 9px;
      border-radius: 3px;
    }

    .option-text   { flex: 1; }
    .option-name   { font-size: 13px; font-weight: 500; color: var(--pp-text); margin-bottom: 1px; }
    .option-desc   { font-size: 11px; color: var(--pp-muted); }

    .option-tick {
      flex-shrink: 0;
      color: var(--pp-primary);
    }

    /* ── Backdrop ── */
    .theme-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1099;
    }
  `]
})
export class ThemeSwitcherComponent {
  protected theme = inject(ThemeService);
  protected open  = signal(false);

  selectTheme(t: Theme): void {
    this.theme.setTheme(t.id);
    this.open.set(false);
  }
}
