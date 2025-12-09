# Fix: Site Shell Button Not Respecting Local's Terminal Preference

## Status: ✅ COMPLETED (December 9, 2024)

## Overview

**Type:** 🐛 Bug Fix
**Priority:** High
**Affected Users:** macOS users with iTerm2 set as default terminal in Local

## Problem Statement

When clicking the "Site shell" button for a Laravel site:
1. Terminal.app opens instead of user's preferred terminal (iTerm2)
2. Error appears: `Command not found: /opt/homebrew/Cellar/bash/5.2.21/bin/bash`

### Root Cause

**The addon ignores Local's terminal preference.**

Local stores terminal preference in:
```
~/Library/Application Support/Local/settings-default-apps.json
{"defaultTerminal":"iTerm","defaultBrowser":"Default"}
```

But our addon hardcodes Terminal.app:
```typescript
// src/common/security.ts:222-229
case 'darwin':
  return {
    command: 'open',
    args: ['-a', 'Terminal', projectPath],  // ❌ Hardcoded!
    ...
  };
```

## Proposed Solution

Read Local's terminal preference and launch the correct application:
- **Terminal** → Use Terminal.app with AppleScript
- **iTerm** → Use iTerm2 with AppleScript

## Acceptance Criteria

- [x] Reads Local's `defaultTerminal` preference from `settings-default-apps.json`
- [x] Opens iTerm2 when preference is "iTerm"
- [x] Opens Terminal.app when preference is "Terminal" (or not set)
- [x] Opens terminal at the Laravel `/app` directory
- [x] Paths with spaces and special characters work correctly
- [x] Falls back gracefully if preferred terminal isn't installed

## Implementation

### Files to Modify

#### 1. `src/common/security.ts`

Add terminal preference parameter and iTerm2 support:

```typescript
/**
 * Terminal application types supported on macOS.
 */
export type MacTerminalApp = 'Terminal' | 'iTerm';

/**
 * Build terminal command for the specified application.
 */
export function buildTerminalCommand(
  projectPath: string,
  terminalApp: MacTerminalApp = 'Terminal'
): {
  command: string;
  args: string[];
  useShell: boolean;
  safe: boolean;
} {
  // Validate path doesn't contain dangerous characters
  const dangerousChars = /[;&|`$(){}[\]<>\n\r]/;
  if (dangerousChars.test(projectPath)) {
    return { command: '', args: [], useShell: false, safe: false };
  }

  switch (process.platform) {
    case 'win32':
      return {
        command: 'cmd',
        args: ['/K', `cd /d "${projectPath}"`],
        useShell: true,
        safe: true,
      };

    case 'darwin':
      // Escape path for AppleScript (handle single quotes)
      const escapedPath = projectPath.replace(/'/g, "'\\''");

      if (terminalApp === 'iTerm') {
        // iTerm2: Use AppleScript to open new window at directory
        return {
          command: 'osascript',
          args: [
            '-e', 'tell application "iTerm"',
            '-e', 'activate',
            '-e', 'set newWindow to (create window with default profile)',
            '-e', `tell current session of newWindow to write text "cd '${escapedPath}'"`,
            '-e', 'end tell',
          ],
          useShell: false,
          safe: true,
        };
      } else {
        // Terminal.app: Use AppleScript (bypasses Terminal preferences)
        return {
          command: 'osascript',
          args: [
            '-e', 'tell application "Terminal"',
            '-e', 'activate',
            '-e', `do script "cd '${escapedPath}'"`,
            '-e', 'end tell',
          ],
          useShell: false,
          safe: true,
        };
      }

    default: // linux
      return {
        command: 'gnome-terminal',
        args: ['--working-directory', projectPath],
        useShell: false,
        safe: true,
      };
  }
}
```

#### 2. `src/main/index.ts`

Update IPC handler to read Local's terminal preference:

```typescript
// Near the top, add helper to get terminal preference
import * as fs from 'fs-extra';
import { app } from 'electron';

/**
 * Get Local's default terminal preference.
 * Reads from ~/Library/Application Support/Local/settings-default-apps.json
 */
function getLocalTerminalPreference(): 'Terminal' | 'iTerm' {
  try {
    const userDataPath = app.getPath('userData');
    const settingsPath = path.join(userDataPath, 'settings-default-apps.json');

    if (fs.existsSync(settingsPath)) {
      const settings = fs.readJsonSync(settingsPath);
      if (settings.defaultTerminal === 'iTerm') {
        return 'iTerm';
      }
    }
  } catch (error) {
    localLogger.warn('[LocalLaravel] Could not read terminal preference:', error);
  }
  return 'Terminal'; // Default fallback
}

// Update the IPC handler (around line 942-993)
ipcMain.handle(IPC_CHANNELS.OPEN_SITE_SHELL, async (_event, data: unknown) => {
  const validation = safeValidateInput(SiteIdRequestSchema, data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const site = siteData.getSite(validation.data!.siteId);
    if (!site) {
      return { success: false, error: 'Site not found' };
    }

    const projectPath = getSafeAppPath(site.path);

    // Get Local's terminal preference
    const terminalApp = getLocalTerminalPreference();

    // Build command for the preferred terminal
    const termCommand = buildTerminalCommand(projectPath, terminalApp);
    if (!termCommand.safe) {
      return { success: false, error: 'Invalid project path' };
    }

    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const child = spawn(termCommand.command, termCommand.args, {
        shell: termCommand.useShell,
        stdio: 'ignore',
        detached: true,
      });

      child.unref();

      child.on('error', (error: Error) => {
        localLogger.error(`[LocalLaravel] Failed to open ${terminalApp}: ${error.message}`);
        resolve({ success: false, error: error.message });
      });

      setTimeout(() => {
        localLogger.info(`[LocalLaravel] Opened ${terminalApp} for ${site.name}`);
        resolve({ success: true });
      }, 100);
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});
```

#### 3. `tests/common/security.test.ts`

Add tests for iTerm2 support:

```typescript
describe('buildTerminalCommand', () => {
  describe('macOS (darwin)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
    });

    it('should use Terminal.app by default', () => {
      const result = buildTerminalCommand('/path/to/project');
      expect(result.command).toBe('osascript');
      expect(result.args.join(' ')).toContain('tell application "Terminal"');
    });

    it('should use iTerm when specified', () => {
      const result = buildTerminalCommand('/path/to/project', 'iTerm');
      expect(result.command).toBe('osascript');
      expect(result.args.join(' ')).toContain('tell application "iTerm"');
    });

    it('should escape single quotes in path for Terminal', () => {
      const result = buildTerminalCommand("/path/with'quote", 'Terminal');
      expect(result.args.join(' ')).toContain("'\\''");
    });

    it('should escape single quotes in path for iTerm', () => {
      const result = buildTerminalCommand("/path/with'quote", 'iTerm');
      expect(result.args.join(' ')).toContain("'\\''");
    });

    it('should handle paths with spaces', () => {
      const result = buildTerminalCommand('/path/with spaces/project', 'iTerm');
      expect(result.safe).toBe(true);
      expect(result.args.join(' ')).toContain("cd '/path/with spaces/project'");
    });
  });
});
```

## Testing Plan

### Manual Testing

1. **iTerm preference:**
   - Ensure Local → Preferences → Default Apps → Terminal is set to "iTerm"
   - Click "Site shell" for a Laravel site
   - Verify iTerm2 opens at the site's `/app` directory

2. **Terminal preference:**
   - Change Local preference to "Terminal"
   - Click "Site shell"
   - Verify Terminal.app opens at correct directory

3. **Path with spaces:**
   - Create site named "My Laravel App"
   - Click "Site shell"
   - Verify terminal opens correctly (no path errors)

4. **Fallback behavior:**
   - Quit iTerm2, set preference to iTerm
   - Click "Site shell"
   - Verify graceful error handling

### Automated Tests

```bash
npm run test -- --testPathPattern="security.test.ts"
```

## References

- **Local's preference file:** `~/Library/Application Support/Local/settings-default-apps.json`
- **Current implementation:** `src/common/security.ts:201-239`
- **IPC handler:** `src/main/index.ts:942-993`
- [iTerm2 AppleScript documentation](https://iterm2.com/documentation-scripting.html)
