# feat: Support Additional Laravel Starter Kits

**Date:** December 9, 2025
**Author:** Claude Code
**Status:** Draft (Revised after review)

## Overview

Add support for Laravel Jetstream and Breeze API mode to the site creation wizard.

## Problem Statement

The addon currently supports Breeze with 4 stacks. Developers also need:

- **Jetstream** - Production-ready auth with 2FA, sessions, teams, API tokens
- **Breeze API** - Headless authentication for decoupled frontends

## Proposed Solution

Extend the existing starter kit installation with simple conditionals. No new classes or abstractions.

**What we're adding:**

1. Jetstream option with Livewire/Inertia stacks and Teams/API checkboxes
2. Breeze API stack option (skips npm build)

## Implementation

### File Changes Summary

| File | Changes |
|------|---------|
| `src/common/types.ts` | Add `'jetstream'` to StarterKit, add JetstreamStack type |
| `src/common/constants.ts` | Add Jetstream config, add 'api' to Breeze stacks |
| `src/common/validation.ts` | Add `jetstream:install` to allowed commands, update schemas |
| `src/main/laravel-installer.ts` | Add `installJetstream()` method, update switch statement |
| `src/renderer/components/wizard/LaravelConfigStep.tsx` | Add Jetstream UI section |

### 1. Types (`src/common/types.ts`)

```typescript
// Add to existing types
export type StarterKit = 'none' | 'breeze' | 'jetstream';
export type BreezeStack = 'blade' | 'livewire' | 'react' | 'vue' | 'api';
export type JetstreamStack = 'livewire' | 'inertia';

// Add to CreateLaravelSiteRequest interface
jetstreamStack?: JetstreamStack;
jetstreamTeams?: boolean;
jetstreamApi?: boolean;
```

### 2. Constants (`src/common/constants.ts`)

```typescript
// Update STARTER_KITS
export const STARTER_KITS = {
  none: {
    label: 'None',
    description: 'Vanilla Laravel installation',
    packages: [],
  },
  breeze: {
    label: 'Laravel Breeze',
    description: 'Simple authentication scaffolding',
    packages: ['laravel/breeze'],
  },
  jetstream: {
    label: 'Laravel Jetstream',
    description: 'Full-featured auth with 2FA, sessions, and teams',
    packages: ['laravel/jetstream'],
  },
} as const;

// Add new constant
export const JETSTREAM_STACKS = {
  livewire: { label: 'Livewire', description: 'PHP-driven reactive components' },
  inertia: { label: 'Inertia (Vue)', description: 'Vue.js SPA with server routing' },
} as const;

// Update BREEZE_STACKS to include API
api: { label: 'API Only', description: 'Headless backend for separate frontend' },
```

### 3. Validation (`src/common/validation.ts`)

**CRITICAL: Add to ALLOWED_ARTISAN_COMMANDS:**

```typescript
export const ALLOWED_ARTISAN_COMMANDS = [
  // ... existing commands
  'breeze:install',
  'jetstream:install',  // <-- ADD THIS
];
```

**Update schemas:**

```typescript
export const StarterKitSchema = z.enum(['none', 'breeze', 'jetstream']);
export const BreezeStackSchema = z.enum(['blade', 'livewire', 'react', 'vue', 'api']);
export const JetstreamStackSchema = z.enum(['livewire', 'inertia']);
```

### 4. Installer (`src/main/laravel-installer.ts`)

Add private methods to existing `LaravelInstaller` class:

```typescript
// In the install() method, replace the starter kit section with:
if (starterKit !== 'none') {
  await this.installStarterKit(site, appPath, options);
}

// Add these private methods:
private async installStarterKit(
  site: LocalSite,
  appPath: string,
  options: LaravelInstallOptions
): Promise<string[]> {
  const { starterKit, breezeStack, jetstreamStack, jetstreamTeams, jetstreamApi } = options;
  const installedPackages: string[] = [];

  switch (starterKit) {
    case 'breeze':
      await this.installBreeze(site, appPath, breezeStack!);
      installedPackages.push('laravel/breeze');
      break;
    case 'jetstream':
      await this.installJetstream(site, appPath, jetstreamStack!, jetstreamTeams, jetstreamApi);
      installedPackages.push('laravel/jetstream');
      break;
  }

  return installedPackages;
}

private async installBreeze(
  site: LocalSite,
  appPath: string,
  stack: BreezeStack
): Promise<void> {
  // Install package
  await composerManager.runForSite(site, [
    'require', 'laravel/breeze', '--dev', '--no-interaction', '--ignore-platform-reqs'
  ], { cwd: appPath });

  // Run artisan install
  await this.runArtisan(appPath, ['breeze:install', stack]);

  // Build frontend (skip for API mode)
  if (stack !== 'api') {
    await this.buildFrontendAssets(appPath);
  } else {
    this.logger.info('[LaravelInstaller] API mode: skipping frontend build');
  }
}

private async installJetstream(
  site: LocalSite,
  appPath: string,
  stack: JetstreamStack,
  teams?: boolean,
  api?: boolean
): Promise<void> {
  // Jetstream version depends on Laravel version
  const laravelVersion = this.currentOptions?.laravelVersion || '11';
  const jetstreamVersion = laravelVersion === '11' ? '^5.0' : '^4.0';

  // Install package (Jetstream is also --dev)
  await composerManager.runForSite(site, [
    'require', `laravel/jetstream:${jetstreamVersion}`, '--dev', '--no-interaction', '--ignore-platform-reqs'
  ], { cwd: appPath });

  // Build artisan command with flags
  const args = ['jetstream:install', stack];
  if (teams) args.push('--teams');
  if (api) args.push('--api');

  await this.runArtisan(appPath, args);

  // Jetstream always has frontend
  await this.buildFrontendAssets(appPath);
}

private async buildFrontendAssets(appPath: string): Promise<void> {
  const packageJsonPath = path.join(appPath, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    this.logger.info('[LaravelInstaller] No package.json, skipping npm');
    return;
  }

  await this.runNpm(appPath, ['install']);
  await this.runNpm(appPath, ['run', 'build']);
  this.logger.info('[LaravelInstaller] Frontend assets built');
}
```

### 5. UI (`src/renderer/components/wizard/LaravelConfigStep.tsx`)

**Update State interface:**

```typescript
interface State {
  laravelVersion: LaravelVersion;
  phpVersion: string;
  starterKit: StarterKit;
  breezeStack: BreezeStack;
  jetstreamStack: JetstreamStack;
  jetstreamTeams: boolean;
  jetstreamApi: boolean;
}
```

**Add handler methods:**

```typescript
handleJetstreamStackChange = (stack: JetstreamStack): void => {
  this.setState({ jetstreamStack: stack });
};
```

**Add Jetstream section to render() after Breeze stack selector:**

```typescript
// Jetstream Stack Selection (conditional)
starterKit === 'jetstream' &&
  React.createElement(
    'div',
    { style: { marginBottom: '28px' } },
    // Stack selector
    React.createElement('label', { /* styles */ }, 'Jetstream Stack'),
    React.createElement(
      'div',
      { style: { display: 'flex', gap: '12px' } },
      Object.entries(JETSTREAM_STACKS).map(([key, config]) =>
        React.createElement('button', {
          key,
          onClick: () => this.handleJetstreamStackChange(key as JetstreamStack),
          style: { /* button styles matching existing pattern */ },
        },
          React.createElement('div', { /* label styles */ }, config.label),
          React.createElement('div', { /* description styles */ }, config.description)
        )
      )
    ),
    // Checkboxes for Teams and API
    React.createElement(
      'div',
      { style: { marginTop: '16px' } },
      React.createElement(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: this.state.jetstreamTeams,
          onChange: (e) => this.setState({ jetstreamTeams: e.target.checked }),
        }),
        'Enable team management features'
      ),
      React.createElement(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' } },
        React.createElement('input', {
          type: 'checkbox',
          checked: this.state.jetstreamApi,
          onChange: (e) => this.setState({ jetstreamApi: e.target.checked }),
        }),
        'Enable API support (Laravel Sanctum)'
      )
    )
  ),
```

**Update handleContinue to pass Jetstream options:**

```typescript
handleContinue = (): void => {
  const { starterKit, breezeStack, jetstreamStack, jetstreamTeams, jetstreamApi } = this.state;

  this.props.updateSiteSettings({
    laravelVersion: this.state.laravelVersion,
    phpVersion: this.state.phpVersion,
    starterKit,
    breezeStack: starterKit === 'breeze' ? breezeStack : undefined,
    jetstreamStack: starterKit === 'jetstream' ? jetstreamStack : undefined,
    jetstreamTeams: starterKit === 'jetstream' ? jetstreamTeams : undefined,
    jetstreamApi: starterKit === 'jetstream' ? jetstreamApi : undefined,
  });

  this.props.history.push(ROUTES.BUILDING);
};
```

## Acceptance Criteria

- [ ] User can select "Jetstream" as starter kit
- [ ] User can choose Livewire or Inertia stack for Jetstream
- [ ] User can toggle Teams and API features via checkboxes
- [ ] User can select "API" as Breeze stack (skips npm)
- [ ] Jetstream installs correctly with correct version for Laravel 10/11
- [ ] All existing Breeze flows continue to work
- [ ] `jetstream:install` is in allowed artisan commands

## Key Implementation Notes

1. **No strategy pattern** - Just add methods to existing `LaravelInstaller` class
2. **Jetstream IS a dev dependency** - Use `--dev` flag like Breeze
3. **Version pinning** - Jetstream 5.x for Laravel 11, 4.x for Laravel 10
4. **Artisan whitelist** - MUST add `jetstream:install` or installation fails
5. **API mode skips npm** - Check stack before running frontend build

## Installation Commands

```bash
# Breeze (existing, unchanged)
composer require laravel/breeze --dev
php artisan breeze:install blade|livewire|react|vue|api

# Jetstream (new)
composer require laravel/jetstream:^5.0 --dev  # Laravel 11
composer require laravel/jetstream:^4.0 --dev  # Laravel 10
php artisan jetstream:install livewire|inertia [--teams] [--api]
```

## References

- Current installer: `src/main/laravel-installer.ts:76`
- Starter kit types: `src/common/types.ts:16`
- Constants: `src/common/constants.ts:94`
- Config UI: `src/renderer/components/wizard/LaravelConfigStep.tsx:56`
- [Jetstream Installation](https://jetstream.laravel.com/installation.html)

---

*Revised based on DHH, Kieran, and Simplicity reviewer feedback. Strategy pattern removed in favor of simple methods.*
