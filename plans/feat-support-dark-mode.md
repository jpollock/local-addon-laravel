# Feature Plan: Dark Mode Support

**Created:** December 9, 2024
**Status:** Draft
**Priority:** High

---

## Overview

### Problem Statement

The Local Laravel addon currently uses hardcoded light-theme colors throughout its UI components. When users switch Local to dark mode via Preferences > Default Apps, the Laravel addon panels remain light-themed, creating visual inconsistency and poor user experience.

### Proposed Solution

Implement dynamic theme detection and color switching across all Laravel addon UI components to match Local's current theme preference. This will use Local's existing CSS class-based theme system (`.Theme__Dark` / `.Theme__Light` on `document.documentElement`).

---

## Research Findings

### Local's Theme System

1. **Theme Detection**: Local sets CSS classes on `document.documentElement`:
   - `.Theme__Dark` when dark mode is enabled
   - `.Theme__Light` when light mode is enabled

2. **No Props/Context**: Local does NOT pass theme information via React props or context to addons. Addons must detect theme via DOM inspection.

3. **Official Pattern**: Local addons use a `getThemeColors()` helper function that reads the DOM class.

### Current State

All Laravel addon components use inline styles with hardcoded colors:
- Backgrounds: `#fff`, `#f8f9fa`, `#1a1a1a`
- Text: `#1a1a1a`, `#666`, `#333`
- Borders: `#e5e7eb`, `#d1d5db`
- Status colors: `#c6f6d5` (success), `#fed7d7` (error)

---

## Technical Approach

### Theme Detection Helper

Create a shared theme utility in `src/common/theme.ts`:

```typescript
/**
 * Check if Local is currently in dark mode.
 */
export function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('Theme__Dark');
}

/**
 * Get theme-appropriate colors.
 */
export function getThemeColors() {
  const dark = isDarkMode();

  return {
    // Backgrounds
    panelBg: dark ? '#2d2d2d' : '#ffffff',
    panelBgSecondary: dark ? '#3d3d3d' : '#f8f9fa',
    panelBgTertiary: dark ? '#1e1e1e' : '#f0f0f0',

    // Text
    textPrimary: dark ? '#e0e0e0' : '#1a1a1a',
    textSecondary: dark ? '#a0a0a0' : '#666666',
    textMuted: dark ? '#808080' : '#999999',

    // Borders
    border: dark ? '#4a4a4a' : '#e5e7eb',
    borderLight: dark ? '#3d3d3d' : '#f0f0f0',

    // Status colors (adjusted for contrast)
    successBg: dark ? '#1a4d2e' : '#c6f6d5',
    successText: dark ? '#68d391' : '#276749',
    errorBg: dark ? '#4d1a1a' : '#fed7d7',
    errorText: dark ? '#fc8181' : '#c53030',
    warningBg: dark ? '#4d3d1a' : '#fef3c7',
    warningText: dark ? '#f6e05e' : '#b7791f',

    // Interactive
    inputBg: dark ? '#3d3d3d' : '#ffffff',
    inputBorder: dark ? '#5a5a5a' : '#d1d5db',
    inputFocus: dark ? '#6366f1' : '#3b82f6',

    // Laravel brand (preserved across themes)
    laravelRed: '#f55247',
    laravelRedHover: '#e04438',
  };
}
```

### Theme Change Detection

For reactive updates when theme changes mid-session:

```typescript
/**
 * Subscribe to theme changes via MutationObserver.
 * Returns cleanup function.
 */
export function onThemeChange(callback: (isDark: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        callback(isDarkMode());
      }
    }
  });

  observer.observe(document.documentElement, { attributes: true });

  return () => observer.disconnect();
}
```

### Component Update Pattern

For class-based components (required by Local's React version):

```typescript
class MyPanel extends React.Component<Props, State> {
  private themeCleanup: (() => void) | null = null;

  state = {
    isDark: isDarkMode(),
  };

  componentDidMount() {
    this.themeCleanup = onThemeChange((isDark) => {
      this.setState({ isDark });
    });
  }

  componentWillUnmount() {
    if (this.themeCleanup) {
      this.themeCleanup();
    }
  }

  render() {
    const colors = getThemeColors();
    // Use colors in inline styles...
  }
}
```

---

## Components Inventory

### High Priority (Main UI)

| Component | File | Complexity | Notes |
|-----------|------|------------|-------|
| LaravelSitePanel | `src/renderer/components/LaravelSitePanel.tsx` | High | Main panel, 800+ lines, multiple sub-sections |
| LaravelBadge | `src/renderer/components/LaravelBadge.tsx` | Low | Status badges |

### Medium Priority (Wizard)

| Component | File | Complexity | Notes |
|-----------|------|------------|-------|
| LaravelEntryStep | `src/renderer/components/wizard/LaravelEntryStep.tsx` | Medium | Entry point selection |
| LaravelConfigStep | `src/renderer/components/wizard/LaravelConfigStep.tsx` | Medium | Configuration options |
| LaravelBuildingStep | `src/renderer/components/wizard/LaravelBuildingStep.tsx` | Medium | Progress display |

### Special Consideration

| Component | Decision |
|-----------|----------|
| Log Viewer | Keep dark background always (industry convention for code/logs) |
| .env Editor | Keep dark background always (code editor convention) |

---

## Implementation Phases

### Phase 1: Theme Infrastructure
- [ ] Create `src/common/theme.ts` with helper functions
- [ ] Add `isDarkMode()`, `getThemeColors()`, `onThemeChange()`
- [ ] Export from common module
- [ ] Add tests for theme utilities

### Phase 2: Main Panel
- [ ] Update `LaravelSitePanel.tsx` with theme detection
- [ ] Add MutationObserver for reactive updates
- [ ] Replace all hardcoded colors with theme colors
- [ ] Test light/dark switching

### Phase 3: Wizard Components
- [ ] Update `LaravelEntryStep.tsx`
- [ ] Update `LaravelConfigStep.tsx`
- [ ] Update `LaravelBuildingStep.tsx`
- [ ] Test wizard flow in both themes

### Phase 4: Badges and Utilities
- [ ] Update `LaravelBadge.tsx`
- [ ] Review any remaining components
- [ ] Final visual QA pass

---

## Color Palette Reference

### Light Theme
```
Background Primary:   #ffffff
Background Secondary: #f8f9fa
Background Tertiary:  #f0f0f0
Text Primary:         #1a1a1a
Text Secondary:       #666666
Text Muted:           #999999
Border:               #e5e7eb
Border Light:         #f0f0f0
```

### Dark Theme
```
Background Primary:   #2d2d2d
Background Secondary: #3d3d3d
Background Tertiary:  #1e1e1e
Text Primary:         #e0e0e0
Text Secondary:       #a0a0a0
Text Muted:           #808080
Border:               #4a4a4a
Border Light:         #3d3d3d
```

### Brand Colors (Both Themes)
```
Laravel Red:          #f55247
Laravel Red Hover:    #e04438
```

---

## Acceptance Criteria

1. **Theme Detection**: Addon correctly detects current Local theme on load
2. **Reactive Updates**: Theme changes mid-session update addon UI without refresh
3. **Visual Consistency**: All addon panels match Local's theme
4. **Contrast Compliance**: Text meets WCAG 2.1 AA contrast ratios (4.5:1 normal, 3:1 large)
5. **Brand Preservation**: Laravel red accent color maintained across themes
6. **Code Editors**: Log viewer and .env editor maintain dark theme always
7. **No Regressions**: All existing functionality continues to work
8. **Tests**: Theme utilities have unit test coverage

---

## Testing Strategy

### Manual Testing
1. Switch Local to dark mode, verify all panels update
2. Switch Local to light mode, verify all panels update
3. Create new Laravel site in dark mode, verify wizard theming
4. Change theme while addon panel is open, verify reactive update

### Automated Testing
1. Unit tests for `isDarkMode()` with mocked DOM
2. Unit tests for `getThemeColors()` light/dark variants
3. Unit tests for `onThemeChange()` callback behavior

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Color contrast issues | Test with contrast checker, follow WCAG guidelines |
| MutationObserver memory leak | Proper cleanup in componentWillUnmount |
| SSR/Node context | Guard with `typeof document` checks |
| Performance with frequent re-renders | Use shouldComponentUpdate if needed |

---

## Estimated Effort

- **Phase 1 (Infrastructure)**: Create theme utilities and tests
- **Phase 2 (Main Panel)**: Update largest component
- **Phase 3 (Wizard)**: Update 3 wizard steps
- **Phase 4 (Polish)**: Badges, QA, edge cases

---

## Open Questions

1. Should form inputs (dropdowns, text fields) follow Local's input styling or custom?
   - **Recommendation**: Follow Local's pattern for consistency

2. Should the progress bar in BuildingStep use theme colors or keep Laravel red?
   - **Recommendation**: Keep Laravel red as brand accent

3. Should we add a theme toggle in addon settings (override Local)?
   - **Recommendation**: No, follow Local's preference for consistency
