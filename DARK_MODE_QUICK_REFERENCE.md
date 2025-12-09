# Dark Mode Quick Reference

Quick reference for implementing dark mode in Local addon components.

## SASS Import

```scss
@import '~@getflywheel/local-components/src/styles/_partials/theme';
@import '~@getflywheel/local-components/src/styles/_partials/variables';
```

## Common Theme Mixins

### Backgrounds

```scss
// White background in light mode, dark gray in dark mode
@include theme-background-white-else-graydark;

// Alternative dark background
@include theme-background-white-else-graydarkalt;

// Gray variations
@include theme-background-gray2-else-graydark;
@include theme-background-gray15-else-graydark50;
```

### Text Colors

```scss
// Black text in light mode, white in dark mode
@include theme-color-black-else-white;

// Gray text variations
@include theme-color-gray-else-white;
@include theme-color-gray25-else-white;
@include theme-color-graydark-else-white;
```

### Borders

```scss
// Standard border (uses box-shadow)
@include theme-border;

// Specific sides
@include theme-border-top;
@include theme-border-bottom;
@include theme-border-left;
@include theme-border-right;

// Just the color
@include theme-border-color;
```

## Custom Theme Rules

```scss
.my-component {
  // Light mode styles (default)
  @include if-theme-light {
    background: $white;
    color: $gray-dark;
  }

  // Dark mode styles
  @include if-theme-dark {
    background: $gray-dark;
    color: $white;
  }
}
```

## Color Variables (from Local)

### Light Mode
- `$white` - #ffffff
- `$black` - #000000
- `$gray` - #262727 (dark gray)
- `$gray-dark` - #262727
- `$gray-dark50` - Lighter dark gray
- `$gray1` - #e7e7e7 (very light)
- `$gray2` - Lighter gray
- `$gray5` - Light gray
- `$gray15` - Medium-light gray
- `$gray25` - Medium gray
- `$gray75` - Dark gray
- `$green` - #51bb7b (primary)

### Dark Mode
Use same variables - mixins handle swapping

## Class-Based Component Template

```typescript
import * as React from 'react';
import * as styles from './MyComponent.scss';

interface Props {
  // Your props
}

interface State {
  // Your state
}

export default class MyComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      // Initialize state
    };
  }

  render() {
    // Theme is inherited from parent - no need to manage it
    return (
      <div className={styles.myComponent}>
        {/* Your content */}
      </div>
    );
  }
}
```

## WCAG Contrast Requirements

- Normal text (< 18pt): **4.5:1** minimum
- Large text (≥ 18pt): **3:1** minimum
- UI components: **3:1** minimum

## Test Your Colors

- Chrome DevTools: Inspect element → Color picker shows contrast ratio
- WebAIM Checker: https://webaim.org/resources/contrastchecker/

## Smooth Transitions

```scss
.my-component {
  transition: background-color 0.3s ease,
              color 0.3s ease,
              border-color 0.3s ease;

  // Your theme styles
  @include theme-background-white-else-graydark;
}
```

## Common Patterns

### Card/Panel Component

```scss
.panel {
  border-radius: 8px;
  padding: 16px;

  @include theme-background-white-else-graydark;
  @include theme-border;
  @include theme-color-black-else-white;
}
```

### Button Component

```scss
.button {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;

  @include if-theme-light {
    background: $green;
    color: $white;
  }

  @include if-theme-dark {
    background: $green;
    color: $black; // Better contrast on green
  }

  &:hover {
    @include if-theme-light {
      background: darken($green, 10%);
    }

    @include if-theme-dark {
      background: lighten($green, 10%);
    }
  }
}
```

### Input Component

```scss
.input {
  padding: 8px 12px;
  border-radius: 4px;

  @include theme-input-background-color;
  @include theme-input-border;
  @include theme-color-black-else-white;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px $green;
  }
}
```

### List with Alternating Rows

```scss
.list {
  @include theme-background-white-else-graydark;
}

.listItem {
  padding: 12px 16px;

  @include theme-color-black-else-white;

  &:nth-child(even) {
    @include theme-background-gray2-else-graydark50;
  }
}
```

## Don't Do This

### Avoid Inline Styles for Theming

```typescript
// ❌ Bad - hard to maintain
const style = {
  background: theme === 'dark' ? '#262727' : '#ffffff'
};
```

### Avoid Managing Theme State in Every Component

```typescript
// ❌ Bad - unnecessary
interface State {
  theme: 'light' | 'dark'; // Don't do this
}

// ✓ Good - inherit from parent
// No theme state needed
```

### Avoid Pure Black Backgrounds

```scss
// ❌ Bad - causes eye strain
.dark-background {
  background: #000000;
}

// ✓ Good - softer on eyes
.dark-background {
  background: $gray-dark; // #262727
}
```

## Electron Main Process (if needed)

```typescript
import { nativeTheme, ipcMain } from 'electron';

// Get system theme
const getSystemTheme = () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
};

// Listen for changes
nativeTheme.on('updated', () => {
  const theme = getSystemTheme();
  // Notify renderer windows
});

// IPC handler
ipcMain.handle('get-system-theme', () => {
  return getSystemTheme();
});
```

## Renderer IPC Usage

```typescript
const electron = (window as any).electron;

// Get current theme
const theme = await electron.ipcRenderer.invoke('get-system-theme');

// Listen for changes
electron.ipcRenderer.on('theme-changed', (_event, theme) => {
  // Handle theme change
});
```

## Remember

1. Import theme utilities at the top of SASS files
2. Use provided mixins for consistency
3. Test in both light and dark modes
4. Verify contrast ratios (4.5:1 minimum)
5. Use class-based React (no hooks)
6. Inherit theme from parent (don't manage state)
7. Add smooth transitions for polish

## Full Documentation

See `DARK_MODE_BEST_PRACTICES.md` for complete details and examples.
