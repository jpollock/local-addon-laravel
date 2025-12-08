# Contributing to Local Laravel

Thank you for your interest in contributing to Local Laravel! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## Getting Started

### Prerequisites

- Node.js >= 18
- Local >= 9.0.0
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jpollock/local-addon-laravel.git
   cd local-addon-laravel
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the addon**
   ```bash
   npm run build
   ```

4. **Link to Local**
   ```bash
   npm run install-addon
   ```

5. **Restart Local** to load the addon

### Development Workflow

```bash
# Watch mode - rebuilds on changes
npm run watch

# After changes, restart Local to see updates
# (Hot reload is not supported for addons)
```

## Code Style

We use ESLint and Prettier for code formatting. Please ensure your code passes all checks before submitting.

```bash
# Lint code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check

# Type check
npm run type-check
```

### Key Style Points

- **TypeScript** - All code must be TypeScript with strict mode
- **Class Components** - React components must be class-based (Local doesn't support hooks)
- **No `any`** - Avoid `any` types; use proper typing or `unknown`
- **Validate Inputs** - Use Zod schemas for IPC handler inputs
- **Error Handling** - Always catch and handle errors appropriately

## Testing

We maintain 70% code coverage threshold. Please write tests for new features.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── __mocks__/          # Mock implementations
│   ├── local.ts        # @getflywheel/local mock
│   └── local-main.ts   # @getflywheel/local/main mock
├── main/               # Main process tests
├── renderer/           # Renderer process tests
└── setup.ts            # Jest setup
```

## Architecture

### Process Separation

Local addons run in Electron with strict process separation:

- **Main Process** (`src/main/`) - Node.js with system access
  - IPC handlers
  - File operations
  - Service management

- **Renderer Process** (`src/renderer/`) - Browser environment
  - React components (class-based only!)
  - UI hooks
  - IPC calls to main

- **Common** (`src/common/`) - Shared code
  - Constants
  - Types
  - Validation schemas

### Key Patterns

1. **IPC Communication**
   ```typescript
   // Main: Register handler
   ipcMain.handle('channel', async (event, data) => {
     const validated = Schema.parse(data);
     return { success: true, data: result };
   });

   // Renderer: Call handler
   const result = await electron.ipcRenderer.invoke('channel', data);
   ```

2. **Error Handling**
   ```typescript
   try {
     // operation
     return { success: true, data: result };
   } catch (error: unknown) {
     const message = error instanceof Error ? error.message : String(error);
     return { success: false, error: message };
   }
   ```

3. **Input Validation**
   ```typescript
   import { z } from 'zod';

   const InputSchema = z.object({
     siteId: z.string().min(1),
     command: z.string().min(1),
   });
   ```

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bugfix
   ```

2. **Make your changes**
   - Write code following our style guide
   - Add tests for new functionality
   - Update documentation if needed

3. **Ensure quality**
   ```bash
   npm run lint
   npm run type-check
   npm test
   npm run build
   ```

4. **Commit with conventional format**
   ```
   feat: add new feature description
   fix: resolve bug description
   docs: update documentation
   chore: maintenance task
   test: add or update tests
   ```

5. **Push and create PR**
   ```bash
   git push origin your-branch
   ```

6. **PR Description**
   - Describe what changed and why
   - Reference related issues
   - Include testing steps

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance, dependencies
- `test:` - Test additions/changes
- `refactor:` - Code refactoring

Examples:
```
feat: add Jetstream starter kit support
fix: resolve database connection timeout
docs: update installation instructions
chore: upgrade TypeScript to 5.3
test: add tests for artisan command handler
```

## Reporting Issues

### Bug Reports

Include:
- Local version
- OS and version
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative approaches considered

## Questions?

- Open a [Discussion](https://github.com/jpollock/local-addon-laravel/discussions)
- Check existing [Issues](https://github.com/jpollock/local-addon-laravel/issues)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
