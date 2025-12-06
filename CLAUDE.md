# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Local Laravel** is an addon for Local (by Flywheel) that enables first-class Laravel development. It allows users to create and manage Laravel applications with the same ease as WordPress sites, leveraging Local's existing PHP, MySQL, and Nginx infrastructure.

### Key Goals

1. **First-class Laravel experience** - Laravel as a true site type, not a hack
2. **Minimal moving parts** - Use Local's existing services, no extra downloads
3. **Laravel developer expectations** - Follow Laravel conventions and patterns
4. **Production quality** - Built for public open-source release

## Architecture Overview

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL APPLICATION                             │
├─────────────────────────────────────────────────────────────────┤
│  Site Creation Flow:                                             │
│  1. User selects "Laravel Project" in CreateSite wizard         │
│  2. Addon registers via CreateSite:RadioOptions filter          │
│  3. Custom wizard steps collect Laravel configuration           │
│  4. Site provisioned with skipWPInstall: true                   │
│  5. LaravelService provides nginx config templates              │
│  6. Composer installs Laravel in site directory                 │
│  7. .env configured with Local's database credentials           │
├─────────────────────────────────────────────────────────────────┤
│  Infrastructure (Leveraged from Local):                          │
│  ├── PHP-FPM (Local's bundled PHP 8.x)                          │
│  ├── MySQL (Local's database service)                           │
│  ├── Nginx (Custom Laravel config via LaravelService)           │
│  └── Composer (Bundled with addon)                              │
└─────────────────────────────────────────────────────────────────┘
```

### Process Separation (Electron)

Local addons run in an Electron environment with strict process separation:

- **Main Process** (`src/main/`) - Node.js environment with system access
  - IPC handlers for renderer communication
  - Lifecycle hooks for Local events
  - LaravelService Lightning Service
  - Composer/Artisan execution
  - File system operations

- **Renderer Process** (`src/renderer/`) - Browser environment with UI
  - React components (CLASS-BASED ONLY, no hooks!)
  - Site creation wizard steps
  - Laravel site info panel
  - Artisan command UI

- **Common** (`src/common/`) - Shared types and constants

## Development Commands

```bash
# Install dependencies
npm install

# Build the addon
npm run build

# Watch mode for development
npm run watch

# Run tests
npm test
npm run test:coverage

# Type checking
npm run typecheck

# Lint
npm run lint

# Install addon in Local (creates symlink)
npm run install-addon

# Download/update bundled Composer
npm run download-composer
```

## Critical Gotchas (MUST READ)

### 1. React Hooks DO NOT WORK

Local uses an older React version without hooks support.

```typescript
// ❌ WRONG - This crashes
const MyComponent = () => {
  const [state, setState] = useState();
  return <div>{state}</div>;
};

// ✅ CORRECT - Class components only
class MyComponent extends React.Component {
  state = { value: '' };
  render() {
    return <div>{this.state.value}</div>;
  }
}
```

### 2. Site Status Check

```typescript
// ❌ WRONG - site.status is UNDEFINED
if (site.status === 'running') { ... }

// ✅ CORRECT - Use siteProcessManager
const services = LocalMain.getServiceContainer().cradle;
const status = services.siteProcessManager.getSiteStatus(site);
if (status === 'running') { ... }
```

### 3. package.json MUST Include productName

Without `productName`, the addon won't load:

```json
{
  "name": "@flavius/local-laravel",
  "productName": "Local Laravel"  // REQUIRED!
}
```

### 4. Main Function MUST Accept Context Parameter

```typescript
// ❌ WRONG - Never called
export default function() { ... }

// ✅ CORRECT - Called with context
export default function(context: LocalMain.AddonMainContext) { ... }
```

### 5. CreateSite Flow Name Prefix

Custom site creation flows MUST use `create-site/` prefix:

```typescript
// ✅ Correct
const FLOW_NAME = 'create-site/laravel';

// ❌ Wrong - won't work
const FLOW_NAME = 'laravel';
```

### 6. Database Ready Check

Always wait for database before running queries or migrations:

```typescript
const { siteDatabase } = services;
await siteDatabase.waitForDB(site);  // MUST call this first
// Now safe to run migrations
```

## Key Implementation Patterns

### Site Type Identification

Laravel sites are identified via `customOptions`:

```typescript
// Check if site is Laravel
const isLaravel = site.customOptions?.siteType === 'laravel';

// Store Laravel config
site.customOptions = {
  siteType: 'laravel',
  laravelVersion: '11.*',
  phpVersion: '8.3',
  starterKit: 'breeze'
};
```

### Lightning Service for Nginx Config

The `LaravelService` extends `LocalMain.LightningService` to provide Laravel-specific nginx configuration:

```typescript
class LaravelService extends LocalMain.LightningService {
  public readonly serviceName = 'laravel';
  public readonly binVersion = '1.0.0';

  // Nginx templates in templates/nginx/
  public get configTemplatePath() {
    return path.join(__dirname, '..', '..', 'templates', 'nginx');
  }
}
```

### Composer Execution

Composer is bundled with the addon and executed using Local's PHP:

```typescript
class ComposerManager {
  async run(args: string[], cwd: string): Promise<ExecResult> {
    const composerPhar = path.join(__dirname, '..', 'vendor', 'composer.phar');
    const phpPath = this.getLocalPhpPath(site);

    return execPromise(`${phpPath} ${composerPhar} ${args.join(' ')}`, {
      cwd,
      env: this.getComposerEnv()
    });
  }
}
```

### Artisan Command Execution

```typescript
async runArtisan(site: Site, command: string[]): Promise<ArtisanResult> {
  const phpPath = this.getLocalPhpPath(site);
  const artisanPath = path.join(site.paths.app, 'artisan');

  const result = await execPromise(
    `${phpPath} ${artisanPath} ${command.join(' ')}`,
    { cwd: site.paths.app, env: this.getLaravelEnv(site) }
  );

  return {
    success: result.exitCode === 0,
    output: result.stdout + result.stderr,
    exitCode: result.exitCode
  };
}
```

### Site Creation Hooks

```typescript
// Register custom site creation flow
hooks.addFilter('CreateSite:RadioOptions', (options) => ({
  ...options,
  [FLOW_NAME]: {
    label: 'Laravel Project',
    description: 'Create a new Laravel application'
  }
}));

// Provide wizard steps
hooks.addFilter('CreateSite:Steps', function(steps) {
  if (this.selectedCreateSiteFlow === FLOW_NAME) {
    return laravelSteps;
  }
  return steps;
});

// Mark site as Laravel before creation
hooks.addFilter('modifyAddSiteObjectBeforeCreation', (site, newSiteInfo) => {
  if (newSiteInfo.customOptions?.siteType === 'laravel') {
    return {
      ...site,
      customOptions: { ...site.customOptions, siteType: 'laravel' }
    };
  }
  return site;
});
```

## File Structure

```
local-addon-laravel/
├── src/
│   ├── main/
│   │   ├── index.ts              # Main entry, hook registration
│   │   ├── ipc-handlers.ts       # IPC communication
│   │   ├── laravel-service.ts    # Lightning Service for nginx
│   │   ├── composer-manager.ts   # Composer execution
│   │   ├── laravel-installer.ts  # Project installation logic
│   │   ├── artisan-runner.ts     # Artisan command execution
│   │   └── env-configurator.ts   # .env file management
│   │
│   ├── renderer/
│   │   ├── index.tsx             # Renderer entry, filters
│   │   └── components/
│   │       ├── wizard/           # Site creation wizard steps
│   │       │   ├── LaravelEntryStep.tsx
│   │       │   ├── LaravelConfigStep.tsx
│   │       │   └── LaravelBuildingStep.tsx
│   │       └── panel/            # Site info panel components
│   │           ├── LaravelSitePanel.tsx
│   │           └── ArtisanCommandPanel.tsx
│   │
│   └── common/
│       ├── constants.ts          # IPC channels, routes, config
│       └── types.ts              # TypeScript interfaces
│
├── templates/
│   └── nginx/
│       └── laravel.conf.hbs      # Laravel nginx config template
│
├── vendor/
│   └── composer.phar             # Bundled Composer (~2MB)
│
└── tests/
    ├── main/                     # Main process tests
    └── renderer/                 # Renderer tests
```

## IPC Communication

All IPC channels are prefixed with `local-laravel:`:

```typescript
export const IPC_CHANNELS = {
  // Site creation
  CREATE_SITE: 'local-laravel:create-site',
  GET_CREATION_STATUS: 'local-laravel:creation-status',

  // Site info
  GET_LARAVEL_INFO: 'local-laravel:get-info',
  IS_LARAVEL_SITE: 'local-laravel:is-laravel',

  // Artisan
  RUN_ARTISAN: 'local-laravel:artisan',
  GET_ARTISAN_HISTORY: 'local-laravel:artisan-history',

  // Composer
  RUN_COMPOSER: 'local-laravel:composer',
} as const;
```

## Laravel-Specific Considerations

### Environment Variables

Laravel requires specific environment variables. The addon configures:

```env
APP_NAME=SiteName
APP_ENV=local
APP_DEBUG=true
APP_URL=http://sitename.local

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=local
DB_USERNAME=root
DB_PASSWORD=root

# Local's MySQL uses sockets
DB_SOCKET=/path/to/mysql.sock
```

### Nginx Configuration

Laravel requires specific nginx rules for routing:

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

The web root must be Laravel's `public/` directory, not the app root.

### PHP Requirements

- Laravel 11.x requires PHP 8.2+
- Laravel 10.x requires PHP 8.1+

The addon validates PHP version before installation.

## Testing Strategy

### Unit Tests

Test individual components in isolation:

```typescript
// tests/main/composer-manager.test.ts
describe('ComposerManager', () => {
  it('should detect composer.phar location', () => {
    const manager = new ComposerManager();
    expect(manager.getComposerPath()).toContain('composer.phar');
  });
});
```

### Integration Tests

Test interactions between components:

```typescript
// tests/integration/site-creation.test.ts
describe('Laravel Site Creation', () => {
  it('should create .env with correct database credentials', async () => {
    // Test full site creation flow
  });
});
```

## Security Considerations

1. **Command Injection** - Always sanitize user input before shell execution
2. **Path Traversal** - Validate all file paths
3. **Credential Exposure** - Never log database passwords
4. **Composer Security** - Use bundled composer.phar, not system composer

## Troubleshooting

### Common Issues

1. **Addon not loading** - Check `productName` in package.json
2. **Site creation fails** - Check PHP version compatibility
3. **Database errors** - Ensure `waitForDB()` called before migrations
4. **Nginx 502** - Check PHP-FPM socket path in nginx config

### Debug Logging

```typescript
const { localLogger } = LocalMain.getServiceContainer().cradle;
localLogger.info('[LocalLaravel] Debug message');
localLogger.error('[LocalLaravel] Error:', error);
```

Logs appear in: `~/Library/Logs/Local/local-lightning.log` (macOS)

## Future Roadmap

### Phase 2: Developer Experience
- Artisan command panel
- Log viewer
- .env editor

### Phase 3: Starter Kits
- Laravel Breeze integration
- Jetstream support
- Filament support

### Phase 4: Advanced Features
- Queue worker management
- Scheduler integration
- Tinker terminal
- Route browser

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.
