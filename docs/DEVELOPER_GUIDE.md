# Developer Guide

## Architecture Overview

Local Laravel is a Local addon that provides first-class Laravel development environment support. It integrates with Local's site creation flow, manages Laravel-specific configuration, and provides a UI for running Artisan commands.

### Process Separation

Local addons run in Electron with strict process separation:

- **Main Process** (`src/main/`) - Node.js with system access
  - Site provisioning and configuration
  - Composer/Artisan command execution
  - File system operations
  - IPC handlers for renderer communication

- **Renderer Process** (`src/renderer/`) - Browser environment with UI
  - Laravel panel component (class-based React)
  - Site creation UI integration
  - Artisan command interface

- **Common** (`src/common/`) - Shared types and constants

## Development Setup

### Prerequisites

- Node.js >= 18
- Local >= 9.0.0
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/jpollock/local-addon-laravel.git
cd local-addon-laravel

# Install dependencies
npm install

# Build the addon
npm run build

# Install symlink to Local
npm run install-addon

# Restart Local to load the addon
```

### Development Workflow

```bash
# Watch mode - rebuilds on file changes
npm run watch

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

## Project Structure

```
local-addon-laravel/
├── src/
│   ├── main/
│   │   ├── index.ts           # Main process entry point
│   │   ├── ipc-handlers.ts    # IPC communication handlers
│   │   ├── site-provisioner.ts # Laravel site creation logic
│   │   ├── artisan-runner.ts  # Artisan command execution
│   │   ├── composer-manager.ts # Composer operations
│   │   └── npm-manager.ts     # npm operations for starter kits
│   ├── renderer/
│   │   ├── index.tsx          # Renderer entry point
│   │   └── components/
│   │       └── LaravelPanel.tsx # Main UI component
│   └── common/
│       ├── types.ts           # TypeScript type definitions
│       └── constants.ts       # Shared constants
├── templates/
│   └── nginx/                 # Nginx configuration templates
├── tests/                     # Test files
├── docs/                      # Documentation
├── lib/                       # Build output (gitignored)
└── package.json
```

## Key Concepts

### IPC Communication

Main and renderer processes communicate via Electron IPC:

```typescript
// Main process (ipc-handlers.ts)
ipcMain.handle('local-laravel:run-artisan', async (event, siteId, command) => {
  // Execute artisan command
  return { success: true, output: result };
});

// Renderer process (LaravelPanel.tsx)
const result = await electron.ipcRenderer.invoke(
  'local-laravel:run-artisan',
  siteId,
  'migrate'
);
```

### Site Provisioning Flow

1. **User creates site** - Selects "Laravel Project" in Local's site creation
2. **Infrastructure provisioned** - Local sets up PHP-FPM, MySQL, Nginx
3. **Laravel installed** - Addon runs `composer create-project laravel/laravel`
4. **Environment configured** - `.env` file written with DB credentials
5. **Initial setup** - Application key generated, migrations run
6. **Starter kit (optional)** - Breeze installed if selected

### Hooks Used

The addon uses Local's hook system:

- `SiteInfoOverview` - Adds Laravel panel to site overview
- `siteProvisioned` - Configures Laravel after site creation
- `siteStarted` - Ensures Laravel is properly configured on start

### React Components

**Important**: Local uses an older React version. Use class components only:

```tsx
// ✅ Correct - Class component
class LaravelPanel extends React.Component<Props, State> {
  state = { output: '' };

  render() {
    return <div>{this.state.output}</div>;
  }
}

// ❌ Wrong - Hooks don't work
const LaravelPanel = () => {
  const [output, setOutput] = useState(''); // This crashes!
  return <div>{output}</div>;
};
```

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## Testing

### Running Tests

```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

### Writing Tests

Tests use Jest with mocked Local APIs:

```typescript
// tests/main/artisan-runner.test.ts
import { runArtisanCommand } from '../../src/main/artisan-runner';

describe('ArtisanRunner', () => {
  it('should run migrate command', async () => {
    const result = await runArtisanCommand(mockSite, 'migrate');
    expect(result.success).toBe(true);
  });
});
```

### Mock Files

Local API mocks are in `tests/__mocks__/`:
- `local.ts` - Core Local module mock
- `local-main.ts` - Main process specific mocks

## Building for Release

```bash
# Run all quality checks
npm run lint
npm run type-check
npm run test:coverage
npm run build

# Validate release requirements
npm run validate-release

# Create distributable package
npm pack
```

## Code Style

- TypeScript strict mode enabled
- ESLint with Prettier integration
- Class components for React (no hooks)
- Conventional commit messages

## Debugging

### Local Logs

Check Local's logs for addon errors:
- macOS: `~/Library/Logs/Local/local-lightning.log`
- Linux: `~/.config/Local/logs/local-lightning.log`
- Windows: `%APPDATA%\Local\logs\local-lightning.log`

### Laravel Logs

Application logs: `~/Local Sites/{site}/app/storage/logs/laravel.log`

### Developer Tools

In Local, open DevTools: `View > Toggle Developer Tools`
