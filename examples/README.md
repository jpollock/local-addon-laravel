# Dark Mode Implementation Examples

This directory contains practical examples demonstrating dark mode implementation best practices for Local addons.

## Files

### ThemeAwareComponent.tsx / .scss

A complete, production-ready example component demonstrating:

- **Class-based React component** (required for Local's React version)
- **Local's SASS theme mixins** (proper integration with Local's theme system)
- **WCAG-compliant color contrast** (4.5:1 minimum for text)
- **Smooth theme transitions** (0.3s ease for theme changes)
- **Interactive elements** with proper focus/hover states
- **Accessibility best practices** (keyboard navigation, screen readers)

#### Component Features

1. **Collapsible Panel** - Header with expand/collapse toggle
2. **Themed List** - Alternating row colors that adapt to theme
3. **Action Buttons** - Primary and secondary buttons with proper contrast
4. **Info Card** - Informational callout with theme-aware styling
5. **State Management** - Class-based state handling without hooks

#### Usage Example

```typescript
import ThemeAwareComponent from './examples/ThemeAwareComponent';

// In your render method
<ThemeAwareComponent
  title="Example Panel"
  description="This panel demonstrates dark mode support"
  onAction={() => console.log('Action clicked')}
/>
```

## Key Concepts Demonstrated

### 1. SASS Theme Mixins

```scss
// Import Local's utilities
@import '~@getflywheel/local-components/src/styles/_partials/theme';
@import '~@getflywheel/local-components/src/styles/_partials/variables';

// Use theme mixins
.myElement {
  @include theme-background-white-else-graydark;
  @include theme-color-black-else-white;
  @include theme-border;
}
```

### 2. Custom Theme Logic

```scss
// When you need custom theme-specific styles
.myElement {
  @include if-theme-light {
    background: $white;
    color: $gray-dark;
  }

  @include if-theme-dark {
    background: $gray-dark;
    color: $white;
  }
}
```

### 3. Class-Based React (No Hooks)

```typescript
// Always use class components
export default class MyComponent extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { /* ... */ };
  }

  // No hooks - use lifecycle methods instead
  componentDidMount() { /* ... */ }
  componentWillUnmount() { /* ... */ }

  render() { /* ... */ }
}
```

### 4. Theme Inheritance

```typescript
// Don't manage theme state in components
// ❌ Bad
interface State {
  theme: 'light' | 'dark'; // Unnecessary
}

// ✓ Good - Theme is inherited from parent
// No theme state needed - just use SASS mixins
```

### 5. Accessibility

```scss
.button {
  // High contrast colors
  @include if-theme-light {
    background: $green;
    color: $white; // 3.3:1 contrast
  }

  // Visible focus state
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba($green, 0.3);
  }
}
```

## Common Patterns

### Panel with Header

```scss
.panel {
  @include theme-background-white-else-graydark;
  @include theme-border;

  .header {
    @include theme-background-gray2-else-graydark50;
    @include theme-border-bottom;
  }
}
```

### Button Variations

```scss
.primaryButton {
  @include if-theme-light {
    background: $green;
    color: $white;
  }
  @include if-theme-dark {
    background: $green;
    color: $black; // Better contrast
  }
}

.secondaryButton {
  @include theme-border;
  @include theme-background-white-else-graydark;
  @include theme-color-black-else-white;
}
```

### List Items

```scss
.listItem {
  @include theme-color-black-else-white;

  &:nth-child(even) {
    @include theme-background-gray2-else-graydark50;
  }

  &:hover {
    @include if-theme-light {
      background: $gray5;
    }
    @include if-theme-dark {
      background: lighten($gray-dark50, 5%);
    }
  }
}
```

## Testing Your Components

1. **Build the addon**: `npm run build`
2. **Start Local** and enable dark mode (Preferences → General → Theme)
3. **Toggle between themes** to verify styling
4. **Check contrast** using browser DevTools color picker
5. **Test interactions** (hover, focus, active states)
6. **Verify accessibility** with keyboard navigation

## Contrast Testing Tools

- **Chrome DevTools**: Inspect element → Color shows contrast ratio
- **WebAIM**: https://webaim.org/resources/contrastchecker/
- **Accessible Colors**: https://accessible-colors.com/

## Color Palette Reference

### Light Mode
- Background: `$white` (#ffffff)
- Text: `$gray-dark` (#262727)
- Border: `$gray1` (#e7e7e7)
- Primary: `$green` (#51bb7b)

### Dark Mode
- Background: `$gray-dark` (#262727)
- Text: `$white` (#ffffff)
- Border: `$gray` (darker variation)
- Primary: `$green` (#51bb7b)

## Documentation

See the main documentation files for complete details:

- **DARK_MODE_BEST_PRACTICES.md** - Comprehensive guide with theory and examples
- **DARK_MODE_QUICK_REFERENCE.md** - Quick reference for common patterns

## Checklist for Your Components

- [ ] Import Local's theme utilities in SASS
- [ ] Use `@include if-theme-light` and `@include if-theme-dark`
- [ ] Test in both light and dark modes
- [ ] Verify contrast ratios (4.5:1 minimum)
- [ ] Use class-based React components (no hooks)
- [ ] Add smooth transitions for theme changes
- [ ] Provide visible focus states for interactive elements
- [ ] Test keyboard navigation
- [ ] Avoid hardcoded colors (use variables/mixins)
- [ ] Handle hover/active states for both themes

## Additional Resources

- **Local Components**: https://getflywheel.github.io/local-components/
- **Electron nativeTheme**: https://www.electronjs.org/docs/latest/api/native-theme
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

---

**Last Updated**: 2025-12-09
