# Theming Approaches Comparison

A comprehensive comparison of different theming approaches for Electron/React applications, with specific guidance for Local addon development.

## Quick Summary

| Approach | Recommended for Local? | Complexity | Performance | Maintainability |
|----------|------------------------|------------|-------------|-----------------|
| **SASS Mixins** | ✅ **YES** (Required) | Medium | Excellent | Good |
| CSS Variables | ⚠️ Partial (Hybrid) | Low | Excellent | Excellent |
| CSS-in-JS | ❌ No (Not available) | High | Poor | Good |
| Inline Styles | ❌ No (Anti-pattern) | Low | Poor | Poor |
| Separate CSS Files | ❌ No (Outdated) | Low | Good | Poor |

## Detailed Comparison

### 1. SASS/SCSS Mixins (Local's Approach)

**Status**: **Required for Local addons**

#### Pros

- **Compile-time generation** - No runtime overhead, smaller CSS bundles
- **Powerful computation** - Use SASS functions, loops, conditionals
- **Consistent patterns** - Reusable mixins ensure consistency
- **Type safety** - SASS variables catch errors at build time
- **CSS Modules support** - Scoped styles prevent conflicts
- **Official Local pattern** - Integrates with existing ecosystem

#### Cons

- **Build step required** - Must compile SASS to CSS
- **DOM class switching** - Theme changes require adding/removing CSS classes
- **Verbose output** - Generates more CSS (duplicate rules for themes)
- **Learning curve** - Understanding mixin patterns takes time

#### Implementation

```scss
@import '~@getflywheel/local-components/src/styles/_partials/theme';

.button {
  padding: 10px 20px;

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

**Compiled Output (Light Theme):**
```css
.button { padding: 10px 20px; }
.button { background: #ffffff; color: #262727; }
.Theme__Dark .button { background: #262727; color: #ffffff; }
```

#### Use Cases

- **Local addon development** (required)
- **Component libraries** with complex theming
- **Applications** requiring compile-time optimization
- **Projects** where bundle size matters

#### Verdict for Local

**✅ USE THIS** - This is the official Local approach and integrates seamlessly with the ecosystem.

---

### 2. CSS Custom Properties (CSS Variables)

**Status**: **Supported as hybrid approach**

#### Pros

- **Runtime switching** - Change theme without page reload
- **Natural cascade** - Variables inherit through DOM
- **Single source** - Change once, applies everywhere
- **Browser native** - No build step needed
- **Easy override** - Can override per component
- **Framework agnostic** - Works with any framework

#### Cons

- **No type safety** - Can set invalid values
- **Browser support** - Not an issue for Electron (evergreen)
- **Can be overridden** - Anywhere in the cascade (pro and con)
- **Limited computation** - No SASS-like functions

#### Implementation

```css
:root {
  --color-bg: #ffffff;
  --color-text: #262727;
}

:root[data-theme="dark"] {
  --color-bg: #262727;
  --color-text: #ffffff;
}

.button {
  background: var(--color-bg);
  color: var(--color-text);
}
```

#### Hybrid Approach (Best of Both Worlds)

Combine SASS mixins with CSS variables:

```scss
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

.button {
  background: var(--color-bg);
  color: var(--color-text);
}
```

**Benefits:**
- SASS mixins handle theme switching logic
- CSS variables provide runtime flexibility
- Cleaner compiled CSS (less duplication)

#### Use Cases

- **Modern web apps** with runtime theming
- **Design systems** with many theme variations
- **Applications** where users can customize themes
- **Hybrid with SASS** for Local addons (advanced)

#### Verdict for Local

**⚠️ OPTIONAL HYBRID** - Can combine with SASS for advanced use cases, but not required.

---

### 3. CSS-in-JS (styled-components, emotion)

**Status**: **Not available in Local (older React version)**

#### Pros

- **Component-scoped** - Styles live with components
- **Dynamic theming** - Full JavaScript power
- **Type safety** - With TypeScript integration
- **Theme provider** - Pass theme via React context
- **Conditional logic** - JavaScript in styles

#### Cons

- **Not available** - Local uses pre-hooks React
- **Runtime overhead** - Styles generated at runtime
- **Bundle size** - Additional library dependencies
- **FOUC risk** - Flash of unstyled content
- **Performance** - Slower than static CSS

#### Implementation (Example Only - NOT FOR LOCAL)

```typescript
// This DOES NOT work in Local - example only
import styled from 'styled-components';

const Button = styled.button`
  background: ${props => props.theme.background};
  color: ${props => props.theme.text};
`;

// Theme provider
<ThemeProvider theme={darkTheme}>
  <Button>Click me</Button>
</ThemeProvider>
```

#### Use Cases

- Modern React apps (16.8+)
- Next.js / Create React App
- Apps requiring dynamic runtime styles

#### Verdict for Local

**❌ NOT AVAILABLE** - Local's React version doesn't support this approach.

---

### 4. Inline Styles

**Status**: **Not recommended (anti-pattern)**

#### Pros

- **Simple** - Direct style objects
- **No build step** - JavaScript only
- **Component-specific** - Scoped by default
- **Dynamic** - Computed at runtime

#### Cons

- **No pseudo-selectors** - Can't style :hover, :focus, etc.
- **No media queries** - Responsive design difficult
- **Performance** - Every element creates inline styles
- **Maintainability** - Hard to update consistently
- **No theme reuse** - Must duplicate logic
- **Poor separation** - Mixes concerns

#### Implementation

```typescript
interface State {
  theme: 'light' | 'dark';
}

class MyComponent extends React.Component<Props, State> {
  getStyles() {
    const { theme } = this.state;
    return {
      button: {
        background: theme === 'dark' ? '#262727' : '#ffffff',
        color: theme === 'dark' ? '#ffffff' : '#262727',
        padding: '10px 20px'
      }
    };
  }

  render() {
    const styles = this.getStyles();
    return <button style={styles.button}>Click</button>;
  }
}
```

#### Use Cases

- **Quick prototypes** - Testing ideas
- **One-off styles** - Rarely needed exceptions
- **Avoid for production** - Not recommended

#### Verdict for Local

**❌ AVOID** - Use SASS instead. Inline styles lack pseudo-selectors and are hard to maintain.

---

### 5. Separate CSS Files per Theme

**Status**: **Outdated approach**

#### Pros

- **Simple concept** - Easy to understand
- **Clear separation** - Each theme is isolated
- **No preprocessing** - Plain CSS

#### Cons

- **Code duplication** - Repeat all styles for each theme
- **Hard to maintain** - Changes need updating multiple files
- **File loading** - Must load different files
- **No shared values** - Can't reuse colors/spacing
- **Theme switching** - Requires file reload

#### Implementation

**light-theme.css:**
```css
.button {
  background: #ffffff;
  color: #262727;
}
```

**dark-theme.css:**
```css
.button {
  background: #262727;
  color: #ffffff;
}
```

**Loading:**
```html
<link id="theme" rel="stylesheet" href="light-theme.css" />

<script>
function switchTheme(theme) {
  document.getElementById('theme').href = `${theme}-theme.css`;
}
</script>
```

#### Use Cases

- **Legacy applications** - Very old codebases
- **Static sites** - No build process
- **Avoid for modern apps** - Better approaches available

#### Verdict for Local

**❌ OUTDATED** - Don't use this approach. SASS mixins are far superior.

---

## Performance Comparison

| Approach | Build Time | Runtime Overhead | Bundle Size | Theme Switch Speed |
|----------|------------|------------------|-------------|-------------------|
| SASS Mixins | Medium | None | Large | Instant (DOM class) |
| CSS Variables | None | None | Small | Instant (CSS recalc) |
| CSS-in-JS | High | High | Large | Fast (re-render) |
| Inline Styles | None | High | None | Slow (re-render all) |
| Separate Files | None | None | Medium | Slow (file load) |

### Performance Notes

**SASS Mixins:**
- Compile-time: ~1-3 seconds for full build
- Runtime: Zero overhead (static CSS)
- Bundle: ~20-50KB for full theme system
- Switch: Instant (just toggle CSS class)

**CSS Variables:**
- Compile-time: None (if pure CSS)
- Runtime: Zero overhead (browser native)
- Bundle: ~5-10KB (minimal CSS)
- Switch: Instant (CSS recalculation ~1-2ms)

**CSS-in-JS:**
- Compile-time: ~3-5 seconds
- Runtime: ~5-10ms per component render
- Bundle: ~30-50KB (library + generated CSS)
- Switch: ~10-50ms (re-render tree)

---

## Maintainability Comparison

### Making a Color Change

**SASS Mixins (Local's Approach):**
```scss
// 1. Update variable
$green: #51bb7b; // Change to #42a86b

// 2. Rebuild
npm run build

// ✓ All components automatically use new color
```

**CSS Variables:**
```css
/* 1. Update variable */
:root {
  --color-primary: #42a86b; /* Changed from #51bb7b */
}

/* ✓ All components automatically use new color
   ✓ No rebuild needed */
```

**Inline Styles:**
```typescript
// ❌ Must find and update every instance
const styles = {
  button: { background: '#42a86b' }, // Was #51bb7b
  icon: { color: '#42a86b' },        // Was #51bb7b
  badge: { border: '1px solid #42a86b' } // Was #51bb7b
};
// ❌ Easy to miss instances
// ❌ No single source of truth
```

### Adding a New Theme Color

**SASS Mixins:**
```scss
// 1. Add variable
$blue: #4a90e2;

// 2. Create mixin
@mixin theme-color-blue-else-lightblue {
  @include __theme-color($blue, lighten($blue, 20%));
}

// 3. Use in components
.myElement {
  @include theme-color-blue-else-lightblue;
}
```

**CSS Variables:**
```css
/* 1. Add variable */
:root {
  --color-blue: #4a90e2;
}

:root[data-theme="dark"] {
  --color-blue: #6aa8f0; /* Lighter for dark mode */
}

/* 2. Use in components */
.myElement {
  color: var(--color-blue);
}
```

---

## Migration Path

### From Inline Styles to SASS

**Before (Inline):**
```typescript
const styles = {
  button: {
    background: theme === 'dark' ? '#262727' : '#ffffff',
    color: theme === 'dark' ? '#ffffff' : '#262727'
  }
};

<button style={styles.button}>Click</button>
```

**After (SASS):**
```scss
// button.scss
.button {
  @include theme-background-white-else-graydark;
  @include theme-color-black-else-white;
}
```

```typescript
import * as styles from './button.scss';

<button className={styles.button}>Click</button>
```

### From CSS Variables to SASS

**Before (CSS Variables):**
```css
:root {
  --color-bg: #ffffff;
}

:root[data-theme="dark"] {
  --color-bg: #262727;
}

.button {
  background: var(--color-bg);
}
```

**After (SASS):**
```scss
.button {
  @include theme-background-white-else-graydark;
}
```

**Hybrid (Best of Both):**
```scss
:root {
  @include if-theme-light {
    --color-bg: #{$white};
  }
  @include if-theme-dark {
    --color-bg: #{$gray-dark};
  }
}

.button {
  background: var(--color-bg);
}
```

---

## Decision Matrix

### Choose SASS Mixins If:

- ✅ Building a Local addon (required)
- ✅ Need compile-time optimization
- ✅ Want zero runtime overhead
- ✅ Building a component library
- ✅ Need complex theme logic

### Choose CSS Variables If:

- ✅ Building a modern web app (standalone)
- ✅ Need runtime theme customization
- ✅ Want minimal bundle size
- ✅ Need user-customizable themes
- ✅ Want simple implementation

### Choose Hybrid Approach If:

- ✅ Need both compile-time and runtime benefits
- ✅ Want SASS power with CSS variable flexibility
- ✅ Building advanced Local addon features
- ✅ Need component-level theme overrides

### Avoid CSS-in-JS If:

- ❌ Using Local's React version (not available)
- ❌ Need optimal performance
- ❌ Want small bundle size

### Avoid Inline Styles If:

- ❌ Building production applications
- ❌ Need pseudo-selectors or media queries
- ❌ Want maintainable code

---

## Recommendations by Project Type

### Local Addon (THIS PROJECT)

**Primary**: SASS Mixins with Local's theme system
**Optional**: CSS Variables for advanced features
**Avoid**: CSS-in-JS, Inline Styles

```scss
// Recommended approach
@import '~@getflywheel/local-components/src/styles/_partials/theme';

.myComponent {
  @include theme-background-white-else-graydark;
  @include theme-color-black-else-white;
}
```

### Modern React App (Standalone)

**Primary**: CSS Variables or CSS-in-JS
**Alternative**: SASS Mixins
**Avoid**: Inline Styles

```css
/* Modern approach */
:root {
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #1a1a1a;
  }
}
```

### Component Library

**Primary**: SASS Mixins
**Alternative**: CSS Variables
**Avoid**: CSS-in-JS, Inline Styles

```scss
/* Component library approach */
@mixin theme-component {
  @include if-theme-light { @content; }
  @include if-theme-dark { @content; }
}
```

---

## Summary

For **Local addon development**, the answer is clear:

**Use SASS Mixins with Local's theme system**

1. Import Local's theme utilities
2. Use provided mixins for common patterns
3. Use `if-theme-light` and `if-theme-dark` for custom logic
4. Leverage Local's color variables
5. Test in both light and dark modes

**Optional Enhancement**: Combine with CSS variables for advanced runtime features

**Avoid**: CSS-in-JS (not available), Inline styles (anti-pattern), Separate files (outdated)

---

**Last Updated**: 2025-12-09
