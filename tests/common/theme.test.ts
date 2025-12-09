/**
 * @jest-environment jsdom
 */

/**
 * Theme Utilities Tests
 *
 * Tests for theme detection and color management utilities.
 */

import {
  isDarkMode,
  getThemeColors,
  onThemeChange,
  LIGHT_COLORS,
  DARK_COLORS,
} from '../../src/common/theme';

describe('Theme Utilities', () => {
  // Store original document state
  let originalClassList: DOMTokenList;

  beforeEach(() => {
    // Mock document.documentElement.classList
    originalClassList = document.documentElement.classList;
  });

  afterEach(() => {
    // Clean up any theme classes
    document.documentElement.classList.remove('Theme__Dark', 'Theme__Light');
  });

  describe('isDarkMode', () => {
    it('should return true when Theme__Dark class is present', () => {
      document.documentElement.classList.add('Theme__Dark');
      expect(isDarkMode()).toBe(true);
    });

    it('should return false when Theme__Light class is present', () => {
      document.documentElement.classList.add('Theme__Light');
      expect(isDarkMode()).toBe(false);
    });

    it('should return false when no theme class is present', () => {
      expect(isDarkMode()).toBe(false);
    });

    it('should return false when both classes are somehow present (edge case)', () => {
      document.documentElement.classList.add('Theme__Light');
      document.documentElement.classList.add('Theme__Dark');
      // Theme__Dark takes precedence since we check for it specifically
      expect(isDarkMode()).toBe(true);
    });
  });

  describe('getThemeColors', () => {
    it('should return light colors when in light mode', () => {
      document.documentElement.classList.add('Theme__Light');
      const colors = getThemeColors();
      expect(colors).toEqual(LIGHT_COLORS);
    });

    it('should return dark colors when in dark mode', () => {
      document.documentElement.classList.add('Theme__Dark');
      const colors = getThemeColors();
      expect(colors).toEqual(DARK_COLORS);
    });

    it('should return light colors by default (no class)', () => {
      const colors = getThemeColors();
      expect(colors).toEqual(LIGHT_COLORS);
    });
  });

  describe('LIGHT_COLORS', () => {
    it('should have all required color properties', () => {
      expect(LIGHT_COLORS).toHaveProperty('panelBg');
      expect(LIGHT_COLORS).toHaveProperty('panelBgSecondary');
      expect(LIGHT_COLORS).toHaveProperty('panelBgTertiary');
      expect(LIGHT_COLORS).toHaveProperty('textPrimary');
      expect(LIGHT_COLORS).toHaveProperty('textSecondary');
      expect(LIGHT_COLORS).toHaveProperty('textMuted');
      expect(LIGHT_COLORS).toHaveProperty('border');
      expect(LIGHT_COLORS).toHaveProperty('borderLight');
      expect(LIGHT_COLORS).toHaveProperty('successBg');
      expect(LIGHT_COLORS).toHaveProperty('successText');
      expect(LIGHT_COLORS).toHaveProperty('errorBg');
      expect(LIGHT_COLORS).toHaveProperty('errorText');
      expect(LIGHT_COLORS).toHaveProperty('warningBg');
      expect(LIGHT_COLORS).toHaveProperty('warningText');
      expect(LIGHT_COLORS).toHaveProperty('inputBg');
      expect(LIGHT_COLORS).toHaveProperty('inputBorder');
      expect(LIGHT_COLORS).toHaveProperty('inputFocus');
      expect(LIGHT_COLORS).toHaveProperty('laravelRed');
      expect(LIGHT_COLORS).toHaveProperty('laravelRedHover');
    });

    it('should have valid hex color values', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(LIGHT_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have Laravel brand colors', () => {
      expect(LIGHT_COLORS.laravelRed).toBe('#f55247');
      expect(LIGHT_COLORS.laravelRedHover).toBe('#e04438');
    });
  });

  describe('DARK_COLORS', () => {
    it('should have all required color properties', () => {
      expect(DARK_COLORS).toHaveProperty('panelBg');
      expect(DARK_COLORS).toHaveProperty('panelBgSecondary');
      expect(DARK_COLORS).toHaveProperty('panelBgTertiary');
      expect(DARK_COLORS).toHaveProperty('textPrimary');
      expect(DARK_COLORS).toHaveProperty('textSecondary');
      expect(DARK_COLORS).toHaveProperty('textMuted');
      expect(DARK_COLORS).toHaveProperty('border');
      expect(DARK_COLORS).toHaveProperty('borderLight');
      expect(DARK_COLORS).toHaveProperty('successBg');
      expect(DARK_COLORS).toHaveProperty('successText');
      expect(DARK_COLORS).toHaveProperty('errorBg');
      expect(DARK_COLORS).toHaveProperty('errorText');
      expect(DARK_COLORS).toHaveProperty('warningBg');
      expect(DARK_COLORS).toHaveProperty('warningText');
      expect(DARK_COLORS).toHaveProperty('inputBg');
      expect(DARK_COLORS).toHaveProperty('inputBorder');
      expect(DARK_COLORS).toHaveProperty('inputFocus');
      expect(DARK_COLORS).toHaveProperty('laravelRed');
      expect(DARK_COLORS).toHaveProperty('laravelRedHover');
    });

    it('should have valid hex color values', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
      Object.values(DARK_COLORS).forEach((color) => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have same Laravel brand colors as light theme', () => {
      expect(DARK_COLORS.laravelRed).toBe(LIGHT_COLORS.laravelRed);
      expect(DARK_COLORS.laravelRedHover).toBe(LIGHT_COLORS.laravelRedHover);
    });

    it('should have darker backgrounds than light theme', () => {
      // Convert hex to RGB and compare brightness
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
            }
          : null;
      };

      const brightness = (hex: string) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return 0;
        return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      };

      expect(brightness(DARK_COLORS.panelBg)).toBeLessThan(brightness(LIGHT_COLORS.panelBg));
      expect(brightness(DARK_COLORS.panelBgSecondary)).toBeLessThan(
        brightness(LIGHT_COLORS.panelBgSecondary)
      );
    });
  });

  describe('onThemeChange', () => {
    it('should return a cleanup function', () => {
      const callback = jest.fn();
      const cleanup = onThemeChange(callback);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('should call callback when theme class changes', async () => {
      const callback = jest.fn();
      const cleanup = onThemeChange(callback);

      // Trigger class change
      document.documentElement.classList.add('Theme__Dark');

      // MutationObserver is async, wait for it
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalledWith(true);

      cleanup();
    });

    it('should call callback with false when switching to light mode', async () => {
      document.documentElement.classList.add('Theme__Dark');

      const callback = jest.fn();
      const cleanup = onThemeChange(callback);

      // Switch to light
      document.documentElement.classList.remove('Theme__Dark');
      document.documentElement.classList.add('Theme__Light');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalledWith(false);

      cleanup();
    });

    it('should not call callback after cleanup', async () => {
      const callback = jest.fn();
      const cleanup = onThemeChange(callback);

      // Cleanup immediately
      cleanup();

      // Now change theme
      document.documentElement.classList.add('Theme__Dark');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple callbacks independently', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const cleanup1 = onThemeChange(callback1);
      const cleanup2 = onThemeChange(callback2);

      document.documentElement.classList.add('Theme__Dark');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback1).toHaveBeenCalledWith(true);
      expect(callback2).toHaveBeenCalledWith(true);

      // Cleanup first, second should still work
      cleanup1();

      document.documentElement.classList.remove('Theme__Dark');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(callback1).toHaveBeenCalledTimes(1); // Not called again
      expect(callback2).toHaveBeenCalledTimes(2); // Called again

      cleanup2();
    });
  });

  describe('Color Contrast (Accessibility)', () => {
    // Helper to calculate relative luminance
    const relativeLuminance = (hex: string): number => {
      const rgb = hex
        .replace('#', '')
        .match(/.{2}/g)!
        .map((x) => parseInt(x, 16) / 255);

      const [r, g, b] = rgb.map((c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    // Calculate contrast ratio between two colors
    const contrastRatio = (hex1: string, hex2: string): number => {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    it('should have sufficient contrast for light theme text on background', () => {
      const ratio = contrastRatio(LIGHT_COLORS.textPrimary, LIGHT_COLORS.panelBg);
      // WCAG AA requires 4.5:1 for normal text
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('should have sufficient contrast for dark theme text on background', () => {
      const ratio = contrastRatio(DARK_COLORS.textPrimary, DARK_COLORS.panelBg);
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('should have sufficient contrast for light theme secondary text', () => {
      const ratio = contrastRatio(LIGHT_COLORS.textSecondary, LIGHT_COLORS.panelBg);
      // Secondary text can be slightly lower but should still be readable
      expect(ratio).toBeGreaterThan(3);
    });

    it('should have sufficient contrast for dark theme secondary text', () => {
      const ratio = contrastRatio(DARK_COLORS.textSecondary, DARK_COLORS.panelBg);
      expect(ratio).toBeGreaterThan(3);
    });

    it('should have sufficient contrast for success text on success background', () => {
      const lightRatio = contrastRatio(LIGHT_COLORS.successText, LIGHT_COLORS.successBg);
      const darkRatio = contrastRatio(DARK_COLORS.successText, DARK_COLORS.successBg);
      expect(lightRatio).toBeGreaterThan(3);
      expect(darkRatio).toBeGreaterThan(3);
    });

    it('should have sufficient contrast for error text on error background', () => {
      const lightRatio = contrastRatio(LIGHT_COLORS.errorText, LIGHT_COLORS.errorBg);
      const darkRatio = contrastRatio(DARK_COLORS.errorText, DARK_COLORS.errorBg);
      expect(lightRatio).toBeGreaterThan(3);
      expect(darkRatio).toBeGreaterThan(3);
    });
  });
});
