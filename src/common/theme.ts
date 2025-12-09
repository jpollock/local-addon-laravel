/**
 * Theme Utilities for Local Laravel Addon
 *
 * Provides theme detection and color management to match Local's theme preference.
 * Local uses CSS classes on document.documentElement: .Theme__Dark or .Theme__Light
 */

/**
 * Theme color palette for consistent styling across components.
 */
export interface ThemeColors {
  // Backgrounds
  panelBg: string;
  panelBgSecondary: string;
  panelBgTertiary: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;

  // Status colors
  successBg: string;
  successText: string;
  errorBg: string;
  errorText: string;
  warningBg: string;
  warningText: string;

  // Interactive elements
  inputBg: string;
  inputBorder: string;
  inputFocus: string;

  // Brand colors (consistent across themes)
  laravelRed: string;
  laravelRedHover: string;
}

/**
 * Light theme color palette.
 */
const LIGHT_COLORS: ThemeColors = {
  // Backgrounds
  panelBg: '#ffffff',
  panelBgSecondary: '#f8f9fa',
  panelBgTertiary: '#f0f0f0',

  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  textMuted: '#999999',

  // Borders
  border: '#e5e7eb',
  borderLight: '#f0f0f0',

  // Status colors
  successBg: '#c6f6d5',
  successText: '#276749',
  errorBg: '#fed7d7',
  errorText: '#c53030',
  warningBg: '#fef3c7',
  warningText: '#b7791f',

  // Interactive elements
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
  inputFocus: '#3b82f6',

  // Brand colors
  laravelRed: '#f55247',
  laravelRedHover: '#e04438',
};

/**
 * Dark theme color palette.
 */
const DARK_COLORS: ThemeColors = {
  // Backgrounds
  panelBg: '#2d2d2d',
  panelBgSecondary: '#3d3d3d',
  panelBgTertiary: '#1e1e1e',

  // Text
  textPrimary: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textMuted: '#808080',

  // Borders
  border: '#4a4a4a',
  borderLight: '#3d3d3d',

  // Status colors (adjusted for dark background contrast)
  successBg: '#1a4d2e',
  successText: '#68d391',
  errorBg: '#4d1a1a',
  errorText: '#fc8181',
  warningBg: '#4d3d1a',
  warningText: '#f6e05e',

  // Interactive elements
  inputBg: '#3d3d3d',
  inputBorder: '#5a5a5a',
  inputFocus: '#6366f1',

  // Brand colors (same across themes)
  laravelRed: '#f55247',
  laravelRedHover: '#e04438',
};

/**
 * Check if Local is currently in dark mode.
 *
 * Local sets CSS classes on document.documentElement:
 * - .Theme__Dark for dark mode
 * - .Theme__Light for light mode
 *
 * @returns true if dark mode is active, false otherwise
 */
export function isDarkMode(): boolean {
  // Guard for SSR/Node environment
  if (typeof document === 'undefined') {
    return false;
  }

  return document.documentElement.classList.contains('Theme__Dark');
}

/**
 * Get theme-appropriate colors based on current Local theme.
 *
 * @returns ThemeColors object with colors for the current theme
 */
export function getThemeColors(): ThemeColors {
  return isDarkMode() ? DARK_COLORS : LIGHT_COLORS;
}

/**
 * Subscribe to theme changes via MutationObserver.
 *
 * Local toggles CSS classes on document.documentElement when theme changes.
 * This function watches for those changes and calls the callback.
 *
 * @param callback Function called when theme changes, receives isDark boolean
 * @returns Cleanup function to stop observing
 *
 * @example
 * ```typescript
 * componentDidMount() {
 *   this.themeCleanup = onThemeChange((isDark) => {
 *     this.forceUpdate(); // or setState to trigger re-render
 *   });
 * }
 *
 * componentWillUnmount() {
 *   if (this.themeCleanup) {
 *     this.themeCleanup();
 *   }
 * }
 * ```
 */
export function onThemeChange(callback: (isDark: boolean) => void): () => void {
  // Guard for SSR/Node environment
  if (typeof document === 'undefined') {
    return () => {};
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        callback(isDarkMode());
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => observer.disconnect();
}

/**
 * Export color constants for direct access if needed.
 */
export { LIGHT_COLORS, DARK_COLORS };
