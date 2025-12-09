# AI Agent Context Document

**Last Updated:** December 9, 2024
**Project:** Local Laravel Addon
**Version:** 0.0.1 (pre-release)

This document provides context for AI agents continuing work on this project. It summarizes what has been built, recent changes, known issues, and future work.

---

## Project Summary

**Local Laravel** is an addon for [Local by Flywheel](https://localwp.com/) that enables first-class Laravel development. Users can create and manage Laravel applications with the same ease as WordPress sites.

### Key Value Proposition
- Laravel as a true site type in Local (not a workaround)
- Uses Local's existing PHP, MySQL, and Nginx infrastructure
- Bundled Composer for zero external dependencies
- Full Laravel starter kit support (Breeze with Blade/Livewire/React/Vue)

### Repository
- **GitHub:** https://github.com/jpollock/local-addon-laravel
- **License:** MIT
- **Author:** Flavius Labs / Jeremy Pollock

---

## Current State (December 2024)

### What's Working

| Feature | Status | Notes |
|---------|--------|-------|
| Site Creation Wizard | ✅ Complete | Multi-step wizard with Laravel config |
| Laravel Installation | ✅ Complete | Via bundled Composer |
| PHP 8.1/8.2/8.3 Support | ✅ Complete | Validates version requirements |
| Laravel 10 & 11 Support | ✅ Complete | With appropriate PHP version checks |
| Breeze Starter Kit | ✅ Complete | All stacks (Blade, Livewire, React, Vue) |
| Nginx Configuration | ✅ Complete | Via LaravelService Lightning Service |
| Site Info Panel | ✅ Complete | Shows Laravel version, PHP, starter kit |
| Artisan Commands | ✅ Complete | Secure execution with whitelisted commands |
| .env Management | ✅ Complete | View and edit with backup |
| Log Viewer | ✅ Complete | Tail Laravel logs |
| Queue Management | ✅ Complete | View/retry/delete failed jobs |
| VS Code Integration | ✅ Complete | Open project in VS Code |
| Terminal/Shell | ✅ Complete | Opens at /app directory (respects iTerm preference) |
| Finder/Explorer | ✅ Complete | Open /app in file manager |
| Security Hardening | ✅ Complete | Input validation, path traversal protection |

### Test Coverage
- **122 tests passing**
- Test files: `security.test.ts`, `validation.test.ts`, `constants.test.ts`, `composer-manager.test.ts`
- Coverage for all security utilities and validation schemas

### Recent Changes (This Session)

**Bug Fix: Site Shell Terminal Preference (December 9, 2024)**

The "Site shell" button was hardcoded to use Terminal.app on macOS, ignoring Local's terminal preference setting. Users with iTerm2 set as default experienced errors.

**Changes Made:**

1. **`src/common/security.ts`**
   - Added `MacTerminalApp` type (`'Terminal' | 'iTerm'`)
   - Updated `buildTerminalCommand()` to accept terminal app parameter
   - Changed from `open -a Terminal` to AppleScript for both terminals
   - Proper path escaping for AppleScript (single quotes → `'\''`)

2. **`src/main/index.ts`**
   - Added `getLocalTerminalPreference()` helper function
   - Reads `~/Library/Application Support/Local/settings-default-apps.json`
   - Returns `'iTerm'` or `'Terminal'` based on user preference
   - Updated `OPEN_SITE_SHELL` handler to use preference

3. **`tests/common/security.test.ts`**
   - Added 8 new tests for iTerm2 support
   - Tests for path escaping, spaces in paths, both terminal types

---

## Architecture Overview

### Process Model (Electron)

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL APPLICATION                        │
├─────────────────────────────────────────────────────────────┤
│  MAIN PROCESS (Node.js)           RENDERER PROCESS (Browser)│
│  ├── IPC Handlers                 ├── React Components      │
│  ├── Lifecycle Hooks              ├── Site Creation Wizard  │
│  ├── LaravelService               └── Site Info Panel       │
│  ├── ComposerManager                                         │
│  └── LaravelInstaller                                        │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Main entry, IPC handlers, lifecycle hooks |
| `src/main/laravel-service.ts` | Lightning Service for nginx config |
| `src/main/composer-manager.ts` | Bundled Composer execution |
| `src/main/laravel-installer.ts` | Laravel project installation |
| `src/common/constants.ts` | IPC channels, routes, config values |
| `src/common/validation.ts` | Zod schemas for input validation |
| `src/common/security.ts` | Path validation, command sanitization |
| `src/common/types.ts` | TypeScript interfaces |
| `src/renderer/index.tsx` | Renderer entry, hook registration |
| `src/renderer/components/wizard/` | Site creation wizard steps |
| `src/renderer/components/panel/` | Site info panel components |

### IPC Channels

All channels prefixed with `local-laravel:`:

```typescript
IPC_CHANNELS = {
  CREATE_SITE: 'local-laravel:create-site',
  GET_CREATION_STATUS: 'local-laravel:creation-status',
  IS_LARAVEL_SITE: 'local-laravel:is-laravel',
  GET_LARAVEL_SITES: 'local-laravel:get-laravel-sites',
  GET_LARAVEL_INFO: 'local-laravel:get-info',
  RUN_ARTISAN: 'local-laravel:artisan',
  GET_COMPOSER_VERSION: 'local-laravel:composer-version',
  GET_LARAVEL_LOGS: 'local-laravel:logs',
  GET_ENV: 'local-laravel:env',
  UPDATE_ENV: 'local-laravel:update-env',
  GET_FAILED_JOBS: 'local-laravel:failed-jobs',
  RETRY_JOB: 'local-laravel:retry-job',
  FORGET_JOB: 'local-laravel:forget-job',
  FLUSH_JOBS: 'local-laravel:flush-jobs',
  OPEN_IN_VSCODE: 'local-laravel:open-vscode',
  OPEN_SITE_FOLDER: 'local-laravel:open-folder',
  OPEN_SITE_SHELL: 'local-laravel:open-shell',
  GET_SITE_STATUS: 'local-laravel:site-status',
}
```

---

## Critical Gotchas

### 1. React Hooks DO NOT WORK
Local uses an older React. Use class components only:
```typescript
// ❌ WRONG
const Component = () => { const [x, setX] = useState(); };

// ✅ CORRECT
class Component extends React.Component { state = { x: '' }; }
```

### 2. Site Status Check
```typescript
// ❌ WRONG - site.status is undefined
if (site.status === 'running') { ... }

// ✅ CORRECT
const services = LocalMain.getServiceContainer().cradle;
const status = services.siteProcessManager.getSiteStatus(site);
```

### 3. Database Ready Check
```typescript
const { siteDatabase } = services;
await siteDatabase.waitForDB(site);  // MUST call before queries/migrations
```

### 4. Required package.json Fields
```json
{
  "productName": "Local Laravel",  // REQUIRED - addon won't load without this
  "main": "lib/main.js",
  "renderer": "lib/renderer.js"
}
```

### 5. Main Function Signature
```typescript
// ❌ Never called
export default function() { ... }

// ✅ Called with context
export default function(context: LocalMain.AddonMainContext) { ... }
```

### 6. Local's Terminal Preference
Stored in `~/Library/Application Support/Local/settings-default-apps.json`:
```json
{"defaultTerminal":"iTerm","defaultBrowser":"Default"}
```

---

## Development Workflow

### Commands
```bash
npm install          # Install dependencies
npm run build        # Build (clean + compile + entry points)
npm run watch        # Watch mode
npm test             # Run all tests
npm run test:coverage # Tests with coverage
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run install-addon # Symlink to Local addons folder
```

### Testing in Local
1. Run `npm run build`
2. Run `npm run install-addon` (one-time symlink)
3. Restart Local (Cmd+Q, reopen)
4. Check logs: `~/Library/Logs/Local/local-lightning.log`

### Debug Logging
```typescript
const services = LocalMain.getServiceContainer().cradle;
const { localLogger } = services;
localLogger.info('[LocalLaravel] Message');
localLogger.error('[LocalLaravel] Error:', error);
```

---

## Known Issues / Technical Debt

### Not Yet Addressed
1. **Wizard scroll issue** - ConfigStep content may overflow without scroll (see `plans/` folder for context)
2. **No queue worker UI** - Can view failed jobs but can't start workers
3. **No Tinker terminal** - Would be nice to have interactive REPL

### Resolved
- ✅ Jetstream support added (Dec 9, 2024) - Livewire/Inertia stacks with Teams/API options
- ✅ Breeze API mode added (Dec 9, 2024) - Headless authentication option
- ✅ Terminal preference not respected (fixed Dec 9, 2024)
- ✅ Security hardening for all IPC handlers
- ✅ Input validation with Zod schemas

---

## Future Work / Roadmap

### High Priority (Should Do)
1. **v0.0.1 Release** - Tag and release first version
2. **Scroll fix for wizard** - Ensure all content visible in creation flow
3. **Better error handling** - More user-friendly error messages

### Medium Priority (Nice to Have)
1. **Queue Worker Management** - Start/stop queue workers from UI
2. **Tinker Terminal** - Interactive Laravel REPL
3. **Route Browser** - Visual route list with methods
4. **Database Migrations UI** - Visual migration status

### Low Priority (Future)
1. **Filament Support** - Admin panel integration
2. **Scheduler Integration** - Cron job visualization
3. **Multi-site sync** - Shared Composer cache

---

## File Reference

### Source Structure
```
src/
├── main/
│   ├── index.ts              # Entry, IPC handlers, hooks
│   ├── laravel-service.ts    # Lightning Service (nginx)
│   ├── composer-manager.ts   # Composer execution
│   └── laravel-installer.ts  # Installation logic
├── renderer/
│   ├── index.tsx             # Entry, filter registration
│   └── components/
│       ├── wizard/           # LaravelEntryStep, ConfigStep, BuildingStep
│       └── panel/            # LaravelSitePanel, ArtisanPanel, etc.
└── common/
    ├── constants.ts          # All constants and config
    ├── validation.ts         # Zod schemas
    ├── security.ts           # Security utilities
    └── types.ts              # TypeScript types
```

### Test Structure
```
tests/
├── common/
│   ├── security.test.ts     # 40 tests
│   └── validation.test.ts   # 58 tests
├── main/
│   ├── constants.test.ts    # 17 tests
│   └── composer-manager.test.ts # 7 tests
└── setup.ts                  # Jest setup with mocks
```

### Configuration Files
- `package.json` - NPM config, scripts, dependencies
- `tsconfig.json` - TypeScript config
- `jest.config.js` - Test configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting

---

## Useful Context for AI Agents

### When Modifying IPC Handlers
1. Add validation schema in `src/common/validation.ts`
2. Use `safeValidateInput()` at handler start
3. Use security utilities from `src/common/security.ts`
4. Add corresponding tests

### When Adding UI Components
1. Use class components (no hooks!)
2. Register in `src/renderer/index.tsx`
3. Use `context.React.createElement()` for rendering
4. Props structure varies by hook location

### When Working with Paths
1. Use `getSafeAppPath(site.path)` for Laravel /app directory
2. Use `getSafePathInApp(site.path, ...segments)` for files within /app
3. Always validate with `isPathWithinSite()` for user-provided paths

### When Running Shell Commands
1. Use `spawn()` with `shell: false` when possible
2. Use `buildArtisanArgs()` for artisan commands
3. Use `buildTerminalCommand()` for opening terminals
4. Never concatenate user input into shell strings

### Local's Preference File Locations (macOS)
- Settings: `~/Library/Application Support/Local/settings.json`
- Default Apps: `~/Library/Application Support/Local/settings-default-apps.json`
- Logs: `~/Library/Logs/Local/local-lightning.log`

---

## Contact / Resources

- **Kitchen Sink Reference:** `/Users/jeremy.pollock/development/wpengine/local/addons/local-addon-kitchen-sink`
- **Local Addon Docs:** https://localwp.com/addon-api
- **Laravel Docs:** https://laravel.com/docs

---

*This document should be updated as significant changes are made to the project.*
