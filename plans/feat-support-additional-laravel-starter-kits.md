# feat: Support Additional Laravel Starter Kits

**Date:** December 9, 2025
**Author:** Claude Code
**Status:** Draft

## Overview

Add support for additional Laravel starter kits beyond the current Breeze implementation. This includes Laravel Jetstream (with Livewire and Inertia stacks), Breeze API-only mode, and architecture to support future community kits.

## Problem Statement / Motivation

The Local Laravel addon currently only supports:
- No starter kit (vanilla Laravel)
- Laravel Breeze with 4 stacks (Blade, Livewire, React, Vue)

Laravel offers additional official starter kits that developers commonly use:
- **Jetstream** - Production-ready with 2FA, session management, API tokens, and optional team management
- **Breeze API** - Headless authentication for decoupled frontends (Next.js, Nuxt, etc.)

Without these options, developers must manually install starter kits after site creation, losing the seamless Local experience.

## Proposed Solution

Extend the addon's starter kit system to support:

1. **Laravel Jetstream** with:
   - Livewire stack
   - Inertia stack (Vue)
   - Optional `--teams` flag for team management
   - Optional `--api` flag for Sanctum API support

2. **Laravel Breeze API mode** for headless applications

3. **Extensible architecture** using strategy pattern for future community kit support

## Technical Approach

### Architecture

The implementation uses a strategy pattern with kit-specific installer classes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    STARTER KIT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│  StarterKitInstaller (Interface)                                 │
│  ├── install(site, config): Promise<void>                       │
│  ├── getUIOptions(): KitUIOptions                               │
│  └── validate(site): ValidationResult                           │
├─────────────────────────────────────────────────────────────────┤
│  Implementations:                                                 │
│  ├── NoneInstaller (no-op)                                      │
│  ├── BreezeInstaller (existing logic, refactored)               │
│  └── JetstreamInstaller (new)                                   │
├─────────────────────────────────────────────────────────────────┤
│  UI Flow:                                                         │
│  1. User selects kit → 2. Kit-specific options appear →          │
│  3. Validation runs → 4. Installation executes                   │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: Type System & Constants Updates

**Files to modify:**

1. **`src/common/types.ts`**
   - Extend `StarterKit` type: `'none' | 'breeze' | 'jetstream'`
   - Add `JetstreamStack` type: `'livewire' | 'inertia'`
   - Add `JetstreamOptions` interface with `teams?: boolean` and `api?: boolean`
   - Update `LaravelSiteConfig` to include Jetstream-specific fields

2. **`src/common/constants.ts`**
   - Add Jetstream to `STARTER_KITS` configuration
   - Add `JETSTREAM_STACKS` configuration
   - Update Breeze config to include 'api' stack

**Example types.ts changes:**

```typescript
// types.ts
export type StarterKit = 'none' | 'breeze' | 'jetstream';
export type BreezeStack = 'blade' | 'livewire' | 'react' | 'vue' | 'api';
export type JetstreamStack = 'livewire' | 'inertia';

export interface JetstreamOptions {
  teams?: boolean;
  api?: boolean;
}

export interface LaravelSiteConfig {
  siteType: 'laravel';
  laravelVersion: LaravelVersion;
  phpVersion: string;
  starterKit: StarterKit;
  // Breeze-specific
  breezeStack?: BreezeStack;
  // Jetstream-specific
  jetstreamStack?: JetstreamStack;
  jetstreamOptions?: JetstreamOptions;
  createdAt: string;
}
```

**Example constants.ts additions:**

```typescript
// constants.ts
export const STARTER_KITS = {
  none: {
    label: 'None',
    description: 'Vanilla Laravel installation',
    packages: [],
  },
  breeze: {
    label: 'Laravel Breeze',
    description: 'Simple authentication with Blade and Tailwind CSS',
    packages: ['laravel/breeze'],
    devDependency: true,
    postInstall: ['breeze:install', 'blade'],
  },
  jetstream: {
    label: 'Laravel Jetstream',
    description: 'Full-featured auth with 2FA, sessions, teams, and API tokens',
    packages: ['laravel/jetstream'],
    devDependency: false,
    postInstall: ['jetstream:install', 'livewire'],
  },
} as const;

export const BREEZE_STACKS = {
  blade: { label: 'Blade + Alpine.js', description: 'Traditional server-side rendering' },
  livewire: { label: 'Livewire', description: 'Full-stack with reactive components' },
  react: { label: 'React + Inertia', description: 'React SPA with server-side routing' },
  vue: { label: 'Vue + Inertia', description: 'Vue SPA with server-side routing' },
  api: { label: 'API Only', description: 'Headless backend for separate frontend' },
} as const;

export const JETSTREAM_STACKS = {
  livewire: { label: 'Livewire', description: 'PHP-driven reactive components' },
  inertia: { label: 'Inertia (Vue)', description: 'Vue.js SPA with server-side routing' },
} as const;
```

#### Phase 2: Installer Logic Updates

**Files to modify:**

1. **`src/main/laravel-installer.ts`**
   - Refactor starter kit installation into strategy classes
   - Add `JetstreamInstaller` class
   - Update `BreezeInstaller` to handle API stack (skip npm)
   - Add validation for PHP/Laravel version requirements

**Example laravel-installer.ts structure:**

```typescript
// laravel-installer.ts

interface StarterKitInstallerStrategy {
  install(site: LocalSite, appPath: string, config: any): Promise<void>;
  shouldRunNpm(): boolean;
}

class BreezeInstaller implements StarterKitInstallerStrategy {
  constructor(private stack: BreezeStack, private logger: any) {}

  async install(site: LocalSite, appPath: string): Promise<void> {
    // 1. composer require laravel/breeze --dev
    await composerManager.runForSite(site, [
      'require', 'laravel/breeze', '--dev', '--no-interaction', '--ignore-platform-reqs'
    ], { cwd: appPath });

    // 2. php artisan breeze:install [stack]
    await this.runArtisan(appPath, ['breeze:install', this.stack]);
  }

  shouldRunNpm(): boolean {
    // API stack has no frontend
    return this.stack !== 'api';
  }
}

class JetstreamInstaller implements StarterKitInstallerStrategy {
  constructor(
    private stack: JetstreamStack,
    private options: JetstreamOptions,
    private logger: any
  ) {}

  async install(site: LocalSite, appPath: string): Promise<void> {
    // 1. composer require laravel/jetstream (NOT --dev)
    await composerManager.runForSite(site, [
      'require', 'laravel/jetstream', '--no-interaction', '--ignore-platform-reqs'
    ], { cwd: appPath });

    // 2. php artisan jetstream:install [stack] [--teams] [--api]
    const args = ['jetstream:install', this.stack];
    if (this.options.teams) args.push('--teams');
    if (this.options.api) args.push('--api');

    await this.runArtisan(appPath, args);
  }

  shouldRunNpm(): boolean {
    return true; // Jetstream always has frontend
  }
}
```

#### Phase 3: UI Updates

**Files to modify:**

1. **`src/renderer/components/wizard/LaravelConfigStep.tsx`**
   - Add Jetstream to starter kit selection
   - Add conditional Jetstream stack selector (Livewire/Inertia)
   - Add checkboxes for Teams and API options
   - Update Breeze stacks to include API option

**Example LaravelConfigStep.tsx additions:**

```typescript
// LaravelConfigStep.tsx

interface State {
  laravelVersion: LaravelVersion;
  phpVersion: string;
  starterKit: StarterKit;
  breezeStack: BreezeStack;
  jetstreamStack: JetstreamStack;
  jetstreamTeams: boolean;
  jetstreamApi: boolean;
}

// In render(), add Jetstream options section (conditional):
{starterKit === 'jetstream' && (
  React.createElement('div', { style: { marginBottom: '28px' } },
    // Stack selector (Livewire / Inertia)
    React.createElement('label', { ... }, 'Jetstream Stack'),
    React.createElement('div', { style: { display: 'flex', gap: '12px' } },
      Object.entries(JETSTREAM_STACKS).map(([key, config]) =>
        React.createElement('button', {
          key,
          onClick: () => this.handleJetstreamStackChange(key as JetstreamStack),
          // ... styling
        },
          React.createElement('div', { ... }, config.label),
          React.createElement('div', { ... }, config.description)
        )
      )
    ),

    // Options checkboxes
    React.createElement('div', { style: { marginTop: '16px' } },
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: this.state.jetstreamTeams,
          onChange: (e) => this.setState({ jetstreamTeams: e.target.checked })
        }),
        'Enable team management features'
      ),
      React.createElement('label', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: this.state.jetstreamApi,
          onChange: (e) => this.setState({ jetstreamApi: e.target.checked })
        }),
        'Enable API support (Laravel Sanctum)'
      )
    )
  )
)}
```

#### Phase 4: Validation Updates

**Files to modify:**

1. **`src/common/validation.ts`**
   - Add Zod schemas for Jetstream configuration
   - Add validation for stack/option combinations

**Example validation.ts additions:**

```typescript
// validation.ts

export const JetstreamStackSchema = z.enum(['livewire', 'inertia']);
export const BreezeStackSchema = z.enum(['blade', 'livewire', 'react', 'vue', 'api']);

export const StarterKitConfigSchema = z.discriminatedUnion('kit', [
  z.object({ kit: z.literal('none') }),
  z.object({
    kit: z.literal('breeze'),
    stack: BreezeStackSchema,
  }),
  z.object({
    kit: z.literal('jetstream'),
    stack: JetstreamStackSchema,
    options: z.object({
      teams: z.boolean().optional().default(false),
      api: z.boolean().optional().default(false),
    }).optional(),
  }),
]);
```

## Acceptance Criteria

### Functional Requirements

- [ ] User can select "Jetstream" as starter kit option in wizard
- [ ] User can choose between Livewire and Inertia stacks for Jetstream
- [ ] User can enable/disable Teams feature via checkbox
- [ ] User can enable/disable API (Sanctum) feature via checkbox
- [ ] User can select "API" as Breeze stack option
- [ ] Jetstream installs correctly with all flag combinations
- [ ] Breeze API mode installs without npm errors
- [ ] Progress indicators show correct steps for each kit
- [ ] Error messages are clear when installation fails

### Non-Functional Requirements

- [ ] Installation completes within 5 minutes on typical hardware
- [ ] No breaking changes to existing Breeze installation flow
- [ ] Code follows existing addon patterns (class components, no hooks)
- [ ] Input validation prevents invalid kit/stack combinations

### Quality Gates

- [ ] Unit tests for new installer logic (mocked composer/artisan)
- [ ] All existing tests continue to pass
- [ ] TypeScript compiles without errors
- [ ] Security validation for new IPC payloads

## Dependencies & Prerequisites

### Technical Dependencies
- Laravel 10.x or 11.x (both Breeze and Jetstream support these)
- PHP 8.1+ (Laravel minimum requirement)
- Node.js 18+ (Vite requirement for frontend builds)

### Existing Code Dependencies
- `composerManager` - Already exists for running Composer commands
- `npmManager` - Already exists for running npm commands
- IPC handler infrastructure - Needs no changes

### External Dependencies
- `laravel/jetstream` Composer package
- Jetstream requires `livewire/livewire` or `inertiajs/inertia-laravel` (installed automatically)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Jetstream installation slower than expected | Medium | Low | Set appropriate timeouts, show progress |
| npm build failures on Jetstream | Medium | Medium | Graceful degradation, site still works |
| Version incompatibility between Laravel/Jetstream | Low | High | Check Composer constraints before install |
| UI overflow with additional options | Low | Low | Use collapsible sections if needed |

## Future Considerations

### Extensibility
The strategy pattern architecture allows easy addition of community kits:
- Filament (admin panel)
- Laravel Spark (SaaS starter)
- Wave (open-source SaaS)

### Potential Enhancements
- TypeScript option for Breeze React/Vue (already supported by Breeze)
- SSR option for Inertia stacks
- Custom post-install artisan commands

## References

### Internal References
- Current installer: `src/main/laravel-installer.ts:76` - Main install method
- Starter kit types: `src/common/types.ts:16` - StarterKit type definition
- Constants: `src/common/constants.ts:94` - STARTER_KITS configuration
- Config UI: `src/renderer/components/wizard/LaravelConfigStep.tsx:56`

### External References
- [Laravel Breeze Documentation](https://laravel.com/docs/11.x/starter-kits#laravel-breeze)
- [Laravel Jetstream Documentation](https://jetstream.laravel.com)
- [Jetstream Installation Guide](https://jetstream.laravel.com/installation.html)

### Research Findings Summary
- Jetstream installation: `composer require laravel/jetstream` followed by `php artisan jetstream:install [livewire|inertia] [--teams] [--api]`
- Breeze API mode: `php artisan breeze:install api` - no npm dependencies
- Both kits support Laravel 10.x and 11.x
- All kits require PHP 8.1 minimum

## MVP Implementation Checklist

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/common/types.ts` | Modify | Add Jetstream types |
| `src/common/constants.ts` | Modify | Add Jetstream/Breeze API configs |
| `src/common/validation.ts` | Modify | Add validation schemas |
| `src/main/laravel-installer.ts` | Modify | Refactor to strategy pattern |
| `src/renderer/components/wizard/LaravelConfigStep.tsx` | Modify | Add Jetstream UI |
| `tests/main/laravel-installer.test.ts` | Create | New tests for installers |

### Installation Command Reference

```bash
# Breeze (existing)
composer require laravel/breeze --dev
php artisan breeze:install blade|livewire|react|vue|api

# Jetstream Livewire
composer require laravel/jetstream
php artisan jetstream:install livewire [--teams] [--api]

# Jetstream Inertia
composer require laravel/jetstream
php artisan jetstream:install inertia [--teams] [--api]
```

### UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELECT STARTER KIT                            │
├─────────────────────────────────────────────────────────────────┤
│  ○ None - Vanilla Laravel installation                          │
│  ○ Laravel Breeze - Simple auth (Blade, Livewire, React, Vue)  │
│  ● Laravel Jetstream - Full-featured auth with 2FA, teams      │
├─────────────────────────────────────────────────────────────────┤
│                    JETSTREAM OPTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│  Stack:                                                          │
│  ● Livewire - PHP-driven reactive components                    │
│  ○ Inertia (Vue) - Vue.js SPA                                   │
│                                                                   │
│  Options:                                                         │
│  ☐ Enable team management features                               │
│  ☑ Enable API support (Laravel Sanctum)                         │
├─────────────────────────────────────────────────────────────────┤
│            [Back]                    [Create Laravel Site]       │
└─────────────────────────────────────────────────────────────────┘
```

---

*Plan generated with Claude Code. Review and approve before implementation.*
