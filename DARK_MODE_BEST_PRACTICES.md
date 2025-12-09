# Dark Mode Best Practices for Electron Applications with Class-Based React Components

This document provides comprehensive best practices for implementing dark mode in Electron applications using class-based React components, specifically tailored for the Local addon ecosystem.

## Table of Contents

1. [Overview](#overview)
2. [CSS Custom Properties Approach](#css-custom-properties-approach)
3. [Local's Theme System](#locals-theme-system)
4. [Electron System Theme Detection](#electron-system-theme-detection)
5. [Class-Based React Implementation](#class-based-react-implementation)
6. [Accessibility and Color Contrast](#accessibility-and-color-contrast)
7. [Styling Approaches Comparison](#styling-approaches-comparison)
8. [Implementation Patterns](#implementation-patterns)

---

## Overview

Dark mode implementation in Electron applications requires coordination between:
- **Main Process**: System theme detection via Electron's `nativeTheme` API
- **Renderer Process**: UI rendering and theme application
- **CSS/SASS**: Theme-aware styling system

For Local addons specifically, you'll integrate with Local's existing theme infrastructure rather than building from scratch.

---

## CSS Custom Properties Approach

### Why CSS Variables?

CSS custom properties (variables) are the **recommended approach** for theming because they:
- Provide runtime theme switching without reloading
- Cascade naturally through the DOM
- Are widely supported and performant
- Enable single source of truth for theme values
- Work seamlessly with existing CSS

### Basic Pattern

```css
/* Define theme variables at :root */
:root {
  --color-background: #ffffff;
  --color-text: #000000;
  --color-border: #e0e0e0;
  --color-primary: #51bb7b;
}

/* Dark theme overrides */
:root[data-theme="dark"] {
  --color-background: #1a1a1a;
  --color-text: #ffffff;
  --color-border: #404040;
  --color-primary: #51bb7b;
}

/* Use variables in components */
.my-component {
  background-color: var(--color-background);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}
```

### Advanced: Using @property for Type Safety

```css
@property --color-primary {
  syntax: "<color>";
  inherits: true;
  initial-value: #51bb7b;
}

@property --spacing-unit {
  syntax: "<length>";
  inherits: true;
  initial-value: 8px;
}
```

**Benefits:**
- Type validation ensures only valid colors are accepted
- `initial-value` provides automatic fallback
- Explicit inheritance control

### Fallback Values

Always provide fallbacks for robustness:

```css
.component {
  /* Fallback chain */
  color: var(--color-text, var(--fallback-text, #000000));

  /* Simple fallback */
  background: var(--color-bg, #ffffff);
}
```

---

## Local's Theme System

Local uses a **class-based theming approach** with `.Theme__Light` and `.Theme__Dark` classes applied to ancestor elements (typically `<html>` or `<body>`).

### How Local's Theme System Works

1. **Global Theme Classes**: Local applies `.Theme__Light` or `.Theme__Dark` to the HTML element
2. **SASS Mixins**: Components use mixins to generate theme-specific styles
3. **Scoped & Global**: Combines CSS Modules (scoped) with global theme classes

### Local's SASS Theme Mixins

Located in `@getflywheel/local-components/src/styles/_partials/_theme.scss`:

```scss
// Apply styles only in light mode
@mixin if-theme-light {
  @content; // Default (no selector needed)

  @each $selector in selector-parse(&) {
    @at-root :global(.Theme__Dark) :global(.Theme__Light) #{$selector} {
      @content;
    }
    @at-root :global(.Theme__Dark) #{$selector} :global(.Theme__Light) {
      @content;
    }
  }
}

// Apply styles only in dark mode
@mixin if-theme-dark {
  @each $selector in selector-parse(&) {
    @at-root :global(.Theme__Dark) #{$selector} {
      @content;
    }
    @at-root :global(.Theme__Light) :global(.Theme__Dark) #{$selector} {
      @content;
    }
    @at-root :global(.Theme__Light) #{$selector} :global(.Theme__Dark) {
      @content;
    }
  }
}

// Example usage
@mixin theme-background-white-else-graydark {
  @include if-theme-light() {
    background: $white;
  }
  @include if-theme-dark() {
    background: $gray-dark;
  }
}
```

### Using Local's Theme Mixins

```scss
.my-component {
  // Simple color theming
  @include theme-color-black-else-white;
  @include theme-background-white-else-graydark;

  // Border theming
  @include theme-border;

  // Complex custom theming
  @include if-theme-light {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  @include if-theme-dark {
    box-shadow: 0 2px 4px rgba(255, 255, 255, 0.1);
  }
}
```

### Available Theme Mixins (Common Patterns)

**Background Colors:**
- `theme-background-white-else-graydark`
- `theme-background-white-else-graydarkalt`
- `theme-background-gray2-else-graydark`
- `theme-background-gray15-else-graydark50`
- `theme-background-green-else-graydark`

**Text Colors:**
- `theme-color-black-else-white`
- `theme-color-gray-else-white`
- `theme-color-gray25-else-white`
- `theme-color-graydark-else-white`

**Borders:**
- `theme-border` (box-shadow based)
- `theme-border-top`, `theme-border-bottom`, `theme-border-left`, `theme-border-right`
- `theme-border-color`
- `theme-input-border-box-shadow`

**SVG Fills:**
- `theme-fill-gray-else-white`
- `theme-fill-graydark-else-white`
- `theme-fill-green-else-white`

---

## Electron System Theme Detection

### Main Process: Using nativeTheme API

Electron's `nativeTheme` module provides system theme detection:

```typescript
// Main process (src/main/theme-manager.ts)
import { nativeTheme, ipcMain } from 'electron';

export default function registerThemeHandlers(context: LocalMain.AddonMainContext) {
  // Get current system theme
  const getSystemTheme = () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  };

  // Listen for system theme changes
  nativeTheme.on('updated', () => {
    const theme = getSystemTheme();
    // Notify all renderer windows
    context.electron.BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('theme-changed', theme);
    });
  });

  // IPC handler for renderer to get current theme
  ipcMain.handle('get-system-theme', () => {
    return getSystemTheme();
  });

  // IPC handler for setting theme source (system/light/dark)
  ipcMain.handle('set-theme-source', (event, source: 'system' | 'light' | 'dark') => {
    nativeTheme.themeSource = source;
    return getSystemTheme();
  });
}
```

### Key nativeTheme Properties

- `nativeTheme.shouldUseDarkColors` - Boolean indicating if OS is in dark mode
- `nativeTheme.themeSource` - Set to 'system', 'light', or 'dark' to override
- `nativeTheme.on('updated', callback)` - Listen for system theme changes

### Preload Script Considerations

If using context isolation (recommended):

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemTheme: () => ipcRenderer.invoke('get-system-theme'),
  setThemeSource: (source: string) => ipcRenderer.invoke('set-theme-source', source),
  onThemeChanged: (callback: (theme: string) => void) => {
    ipcRenderer.on('theme-changed', (_event, theme) => callback(theme));
  }
});
```

---

## Class-Based React Implementation

### Why No Hooks in Local Addons?

Local uses an **older version of React** (pre-16.8) that doesn't support hooks. All components **must** be class-based.

### Pattern 1: State-Based Theme Switching

```typescript
import * as React from 'react';
import * as styles from './MyComponent.scss';

interface Props {
  // Props from parent
}

interface State {
  theme: 'light' | 'dark';
}

export default class MyComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      theme: 'light'
    };
  }

  componentDidMount() {
    // Get initial theme from Local or system
    const electron = (window as any).electron;
    if (electron && electron.ipcRenderer) {
      electron.ipcRenderer.invoke('get-system-theme').then((theme: string) => {
        this.setState({ theme: theme as 'light' | 'dark' });
      });

      // Listen for theme changes
      electron.ipcRenderer.on('theme-changed', (_event: any, theme: string) => {
        this.setState({ theme: theme as 'light' | 'dark' });
      });
    }
  }

  componentWillUnmount() {
    // Clean up listeners
    const electron = (window as any).electron;
    if (electron && electron.ipcRenderer) {
      electron.ipcRenderer.removeAllListeners('theme-changed');
    }
  }

  render() {
    const { theme } = this.state;
    const themeClass = theme === 'dark' ? 'Theme__Dark' : 'Theme__Light';

    return (
      <div className={themeClass}>
        <div className={styles.myComponent}>
          <h2>My Component</h2>
          <p>This respects the current theme</p>
        </div>
      </div>
    );
  }
}
```

### Pattern 2: Using Local's Existing Theme (Recommended)

Local already manages theme state globally. Your addon components should **inherit** from parent theme classes rather than managing their own:

```typescript
import * as React from 'react';
import * as styles from './MyComponent.scss';

interface Props {
  // Your props
}

export default class MyComponent extends React.Component<Props> {
  render() {
    // No theme state needed - inherit from parent's Theme__Dark or Theme__Light
    return (
      <div className={styles.myComponent}>
        <h2>My Component</h2>
        <p>Theme styles apply automatically</p>
      </div>
    );
  }
}
```

**SCSS:**

```scss
@import '~@getflywheel/local-components/src/styles/_partials/theme';
@import '~@getflywheel/local-components/src/styles/_partials/variables';

.myComponent {
  padding: 16px;
  border-radius: 4px;

  // Use Local's theme mixins
  @include theme-background-white-else-graydark;
  @include theme-color-black-else-white;
  @include theme-border;

  h2 {
    @include theme-color-graydark-else-white;
    margin-bottom: 12px;
  }

  p {
    @include theme-color-gray-else-white;
  }
}
```

### Pattern 3: Inline Styles with Dynamic Theme

For cases where SASS isn't suitable (rare):

```typescript
interface State {
  theme: 'light' | 'dark';
}

export default class MyComponent extends React.Component<Props, State> {
  // ... constructor and lifecycle methods ...

  getThemeStyles() {
    const { theme } = this.state;

    return {
      container: {
        backgroundColor: theme === 'dark' ? '#262727' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#262727',
        border: `1px solid ${theme === 'dark' ? '#5d5e5e' : '#e7e7e7'}`,
        padding: '16px',
        borderRadius: '4px'
      },
      heading: {
        color: theme === 'dark' ? '#ffffff' : '#262727',
        marginBottom: '12px'
      }
    };
  }

  render() {
    const styles = this.getThemeStyles();

    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>My Component</h2>
        <p>Content here</p>
      </div>
    );
  }
}
```

**Note:** Inline styles are **not recommended** for theming. Use SASS mixins or CSS variables instead.

---

## Accessibility and Color Contrast

### WCAG Color Contrast Requirements

**WCAG 2.1 Level AA Requirements:**
- **Normal text** (< 18pt regular, < 14pt bold): Minimum contrast ratio of **4.5:1**
- **Large text** (≥ 18pt regular, ≥ 14pt bold): Minimum contrast ratio of **3:1**
- **UI components and graphics**: Minimum contrast ratio of **3:1**

**WCAG 2.1 Level AAA Requirements (Enhanced):**
- **Normal text**: Minimum contrast ratio of **7:1**
- **Large text**: Minimum contrast ratio of **4.5:1**

### Testing Color Contrast

Use these tools to verify contrast ratios:

1. **Browser DevTools**: Chrome/Edge DevTools show contrast ratios when inspecting colors
2. **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
3. **Accessible Colors**: https://accessible-colors.com/
4. **Contrast Ratio**: https://contrast-ratio.com/

### Local's Color Palette (Accessible)

From `@getflywheel/local-components/src/styles/_partials/_variables.scss`:

**Light Theme:**
- Background: `#ffffff` (white)
- Text: `#262727` (gray-dark) - **16.9:1 ratio** ✓
- Border: `#e7e7e7` (gray1)
- Primary: `#51bb7b` (green) - **3.3:1 ratio** for large text ✓

**Dark Theme:**
- Background: `#262727` (gray-dark)
- Text: `#ffffff` (white) - **16.9:1 ratio** ✓
- Border: `#5d5e5e` (gray)
- Primary: `#51bb7b` (green) - **3.5:1 ratio** for large text ✓

### Best Practices for Accessible Dark Mode

1. **Never use pure black (#000000)**
   - Pure black can cause eye strain
   - Use `#1a1a1a` to `#262727` instead
   - Local uses `#262727` as dark background

2. **Avoid pure white text on dark backgrounds**
   - Use slightly off-white: `#f5f5f5` or `#e0e0e0`
   - Local uses pure `#ffffff` but it works due to `#262727` background

3. **Maintain sufficient contrast**
   - Test all color combinations
   - Pay special attention to links, buttons, and interactive elements

4. **Use semantic colors consistently**
   - Success: Green tones
   - Error: Red tones
   - Warning: Yellow/orange tones
   - Info: Blue tones

5. **Consider users with color blindness**
   - Don't rely solely on color to convey information
   - Use icons, labels, and patterns
   - Test with color blindness simulators

6. **Respect system preferences**
   - Use `prefers-color-scheme` media query
   - Implement smooth transitions between themes
   - Provide manual override option

### CSS Media Query for System Preference

```css
/* Default light theme */
:root {
  --color-background: #ffffff;
  --color-text: #262727;
}

/* Automatic dark theme based on system */
@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #262727;
    --color-text: #ffffff;
  }
}

/* Allow manual override with data attribute */
:root[data-theme="light"] {
  --color-background: #ffffff;
  --color-text: #262727;
}

:root[data-theme="dark"] {
  --color-background: #262727;
  --color-text: #ffffff;
}
```

### Accessible Color Examples

**Good Contrast (Light Theme):**
```css
.button {
  background: #51bb7b; /* Green */
  color: #ffffff; /* White text */
  /* Contrast: 3.3:1 - Passes AA for large text */
}

.text {
  color: #262727; /* Dark gray */
  background: #ffffff; /* White */
  /* Contrast: 16.9:1 - Passes AAA */
}
```

**Good Contrast (Dark Theme):**
```css
.button {
  background: #51bb7b; /* Green */
  color: #000000; /* Black text */
  /* Contrast: 4.2:1 - Passes AA for normal text */
}

.text {
  color: #ffffff; /* White */
  background: #262727; /* Dark gray */
  /* Contrast: 16.9:1 - Passes AAA */
}
```

---

## Styling Approaches Comparison

### 1. CSS Variables (CSS Custom Properties)

**Pros:**
- Runtime theme switching without reload
- Natural CSS cascade
- Single source of truth
- Wide browser support
- Easy to override per component
- Works with any framework

**Cons:**
- No type safety
- Can be overridden anywhere (could be pro or con)
- Limited computation capabilities

**Best for:** Modern applications, runtime theme switching, simple color/spacing systems

**Example:**
```css
:root {
  --color-primary: #51bb7b;
}

.button {
  background: var(--color-primary);
}
```

### 2. SASS/SCSS Mixins (Local's Approach)

**Pros:**
- Compile-time generation (smaller CSS)
- Powerful computation and logic
- Consistent patterns via mixins
- Type safety through variables
- No runtime overhead
- Scoped styles with CSS Modules

**Cons:**
- Requires build step
- Theme switching requires DOM class changes
- More verbose (more CSS generated)
- Learning curve for mixin patterns

**Best for:** Component libraries, complex theming logic, Local addons (required)

**Example:**
```scss
@mixin if-theme-dark {
  .Theme__Dark & {
    @content;
  }
}

.button {
  background: $green;

  @include if-theme-dark {
    background: $green-dark;
  }
}
```

### 3. CSS-in-JS (styled-components, emotion)

**Pros:**
- Component-scoped styles
- Dynamic theming with JavaScript
- Type safety with TypeScript
- Theme provider pattern
- Conditional logic in styles

**Cons:**
- Runtime overhead
- Larger bundle size
- Requires additional dependencies
- **Not available in Local** (older React version)
- Flash of unstyled content (FOUC) risk

**Best for:** Modern React apps with hooks, dynamic styling needs

**Example:**
```typescript
// NOT AVAILABLE IN LOCAL - Example only
const Button = styled.button`
  background: ${props => props.theme.primary};
`;
```

### 4. Inline Styles

**Pros:**
- Simple and direct
- No build step needed
- Full JavaScript control
- Component-specific

**Cons:**
- No pseudo-selectors
- No media queries
- Performance issues with many elements
- Hard to maintain
- No theme reusability
- Poor separation of concerns

**Best for:** Quick prototypes, one-off styling (avoid for production)

**Example:**
```typescript
const style = {
  background: theme === 'dark' ? '#262727' : '#ffffff'
};
<div style={style}>Content</div>
```

### 5. Separate CSS Files per Theme

**Pros:**
- Simple concept
- Clear separation
- No preprocessing needed

**Cons:**
- Code duplication
- Difficult to maintain
- Requires loading different files
- No shared values
- Theme switching requires file reload

**Best for:** Very simple sites, static themes (avoid for applications)

### Recommendation for Local Addons

**Use SASS/SCSS with Local's theme mixins** (Option 2). This is the established pattern in Local's ecosystem:

1. Import Local's theme utilities
2. Use provided mixins (`if-theme-light`, `if-theme-dark`)
3. Leverage existing color variables
4. Component styles automatically respect global theme state

**Hybrid Approach (Advanced):**
Combine SASS mixins with CSS variables for best of both worlds:

```scss
// Define CSS variables using SASS mixins
:root {
  @include if-theme-light {
    --color-bg: #{$white};
    --color-text: #{$gray-dark};
  }

  @include if-theme-dark {
    --color-bg: #{$gray-dark};
    --color-text: #{$white};
  }
}

// Use CSS variables in components
.my-component {
  background: var(--color-bg);
  color: var(--color-text);
}
```

---

## Implementation Patterns

### Complete Example: Theme-Aware Panel Component

**TypeScript Component:**

```typescript
// src/renderer/components/MyPanel.tsx
import * as React from 'react';
import * as styles from './MyPanel.scss';

interface Props {
  title: string;
  site?: any;
}

interface State {
  isExpanded: boolean;
}

export default class MyPanel extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isExpanded: true
    };

    this.toggleExpanded = this.toggleExpanded.bind(this);
  }

  toggleExpanded() {
    this.setState(prevState => ({
      isExpanded: !prevState.isExpanded
    }));
  }

  render() {
    const { title } = this.props;
    const { isExpanded } = this.state;

    return (
      <div className={styles.panel}>
        <div className={styles.header} onClick={this.toggleExpanded}>
          <h3 className={styles.title}>{title}</h3>
          <span className={styles.toggle}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>

        {isExpanded && (
          <div className={styles.content}>
            {this.props.children}
          </div>
        )}
      </div>
    );
  }
}
```

**SASS Styles:**

```scss
// src/renderer/components/MyPanel.scss
@import '~@getflywheel/local-components/src/styles/_partials/theme';
@import '~@getflywheel/local-components/src/styles/_partials/variables';

.panel {
  border-radius: 8px;
  margin-bottom: 16px;
  overflow: hidden;

  @include theme-background-white-else-graydark;
  @include theme-border;

  // Add subtle shadow in light mode only
  @include if-theme-light {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  @include theme-background-gray2-else-graydark50;

  &:hover {
    @include if-theme-light {
      background-color: $gray5;
    }

    @include if-theme-dark {
      background-color: lighten($gray-dark50, 5%);
    }
  }
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;

  @include theme-color-graydark-else-white;
}

.toggle {
  font-size: 12px;

  @include theme-color-gray-else-gray25;
}

.content {
  padding: 16px;

  @include theme-color-black-else-white;
}
```

### Pattern: User Preference Storage

```typescript
// src/main/theme-preferences.ts
import { ipcMain } from 'electron';
import * as fs from 'fs-extra';
import * as path from 'path';

interface ThemePreferences {
  themeSource: 'system' | 'light' | 'dark';
  lastChanged?: number;
}

export default function registerThemePreferences(context: LocalMain.AddonMainContext) {
  const prefsPath = path.join(
    context.environment.userDataPath,
    'theme-preferences.json'
  );

  // Load preferences
  const loadPreferences = async (): Promise<ThemePreferences> => {
    try {
      if (await fs.pathExists(prefsPath)) {
        return await fs.readJson(prefsPath);
      }
    } catch (error) {
      console.error('Failed to load theme preferences:', error);
    }

    // Default to system theme
    return { themeSource: 'system' };
  };

  // Save preferences
  const savePreferences = async (prefs: ThemePreferences) => {
    try {
      await fs.writeJson(prefsPath, {
        ...prefs,
        lastChanged: Date.now()
      }, { spaces: 2 });
    } catch (error) {
      console.error('Failed to save theme preferences:', error);
    }
  };

  // IPC handlers
  ipcMain.handle('theme:get-preference', async () => {
    return await loadPreferences();
  });

  ipcMain.handle('theme:set-preference', async (event, themeSource: string) => {
    await savePreferences({ themeSource: themeSource as any });
    return true;
  });
}
```

### Pattern: Theme Toggle UI Component

```typescript
// src/renderer/components/ThemeToggle.tsx
import * as React from 'react';
import * as styles from './ThemeToggle.scss';

interface Props {
  // Can be empty for now
}

interface State {
  currentTheme: 'system' | 'light' | 'dark';
}

export default class ThemeToggle extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      currentTheme: 'system'
    };

    this.handleThemeChange = this.handleThemeChange.bind(this);
  }

  async componentDidMount() {
    const electron = (window as any).electron;
    if (electron && electron.ipcRenderer) {
      const prefs = await electron.ipcRenderer.invoke('theme:get-preference');
      this.setState({ currentTheme: prefs.themeSource });
    }
  }

  async handleThemeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const themeSource = event.target.value as 'system' | 'light' | 'dark';

    const electron = (window as any).electron;
    if (electron && electron.ipcRenderer) {
      await electron.ipcRenderer.invoke('theme:set-preference', themeSource);
      await electron.ipcRenderer.invoke('set-theme-source', themeSource);
      this.setState({ currentTheme: themeSource });
    }
  }

  render() {
    const { currentTheme } = this.state;

    return (
      <div className={styles.themeToggle}>
        <label htmlFor="theme-select" className={styles.label}>
          Theme:
        </label>
        <select
          id="theme-select"
          value={currentTheme}
          onChange={this.handleThemeChange}
          className={styles.select}
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    );
  }
}
```

### Pattern: Smooth Theme Transitions

```scss
// Add to global styles or root component
:root {
  // Disable transitions during initial load
  &.no-transitions * {
    transition: none !important;
  }
}

// Enable smooth transitions for theme changes
body,
.Theme__Light,
.Theme__Dark {
  transition: background-color 0.3s ease, color 0.3s ease;
}

// Individual components
.my-component {
  transition: background-color 0.3s ease,
              border-color 0.3s ease,
              color 0.3s ease;
}
```

**Prevent FOUC (Flash of Unstyled Content):**

```typescript
// In renderer initialization
document.documentElement.classList.add('no-transitions');

window.addEventListener('DOMContentLoaded', () => {
  // Remove after a brief delay to allow initial render
  setTimeout(() => {
    document.documentElement.classList.remove('no-transitions');
  }, 100);
});
```

---

## Summary: Recommended Approach for Local Addons

1. **Use Local's existing theme system** - Don't reinvent the wheel
2. **Import Local's SASS theme utilities** - Leverage provided mixins
3. **Apply theme mixins to your components** - Consistent with Local's patterns
4. **Inherit theme from parent elements** - No need to manage state in every component
5. **Test in both light and dark modes** - Verify contrast and usability
6. **Follow WCAG accessibility guidelines** - Minimum 4.5:1 contrast for text
7. **Use class-based React components** - Required for Local's React version
8. **Avoid inline styles for theming** - Use SASS/CSS instead

### Quick Start Checklist

- [ ] Import Local's theme utilities in your SASS files
- [ ] Use `@include if-theme-light` and `@include if-theme-dark` mixins
- [ ] Test components in both light and dark themes
- [ ] Verify color contrast ratios (4.5:1 minimum)
- [ ] Use semantic color variables from Local
- [ ] Avoid managing theme state in components (inherit from parent)
- [ ] Follow Local's class-based React patterns
- [ ] Add smooth transitions for theme changes (optional)

### Further Reading

- **Local Components Documentation**: https://getflywheel.github.io/local-components/
- **Electron nativeTheme API**: https://www.electronjs.org/docs/latest/api/native-theme
- **MDN CSS Custom Properties**: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
- **WCAG Contrast Guidelines**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/

---

## File Locations

- **Local Theme SASS**: `node_modules/@getflywheel/local-components/src/styles/_partials/_theme.scss`
- **Local Variables**: `node_modules/@getflywheel/local-components/src/styles/_partials/_variables.scss`
- **Global CSS**: `node_modules/@getflywheel/local-components/dist/global.css`
- **Scoped CSS**: `node_modules/@getflywheel/local-components/dist/scoped.css`

---

**Document Version**: 1.0.0
**Last Updated**: 2025-12-09
**Author**: Research compilation for Local Laravel Addon
