/**
 * Local Laravel - Security Utilities
 *
 * Security utilities for path validation, command sanitization,
 * and log sanitization.
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Resolve a site path, expanding ~ to home directory.
 */
export function resolveSitePath(sitePath: string): string {
  if (sitePath.startsWith('~')) {
    return path.join(os.homedir(), sitePath.slice(1));
  }
  return path.resolve(sitePath);
}

/**
 * Check if a file path is within a site's directory.
 * Prevents path traversal attacks.
 */
export function isPathWithinSite(sitePath: string, targetPath: string): boolean {
  const resolvedSite = path.resolve(resolveSitePath(sitePath));
  const resolvedTarget = path.resolve(targetPath);

  // Ensure target starts with site path + separator
  // This prevents attacks like /site/app/../../../etc/passwd
  return resolvedTarget.startsWith(resolvedSite + path.sep) ||
         resolvedTarget === resolvedSite;
}

/**
 * Get the Laravel app path for a site, with validation.
 */
export function getSafeAppPath(sitePath: string): string {
  const resolved = resolveSitePath(sitePath);
  const appPath = path.join(resolved, 'app');

  // Validate the resulting path is still within the site
  if (!isPathWithinSite(resolved, appPath)) {
    throw new Error('Invalid site path: path traversal detected');
  }

  return appPath;
}

/**
 * Get a safe path within the Laravel app directory.
 */
export function getSafePathInApp(sitePath: string, ...segments: string[]): string {
  const appPath = getSafeAppPath(sitePath);
  const targetPath = path.join(appPath, ...segments);

  // Validate the resulting path is still within the app directory
  if (!isPathWithinSite(appPath, targetPath)) {
    throw new Error('Invalid path: path traversal detected');
  }

  return targetPath;
}

/**
 * Sensitive keys that should be redacted in logs.
 */
const SENSITIVE_KEYS = [
  'password',
  'secret',
  'key',
  'token',
  'credential',
  'auth',
  'api_key',
  'apikey',
  'private',
  'mail_password',
  'aws_secret',
  'db_password',
  'database_password',
  'redis_password',
  'session_secret',
  'app_key',
  'encryption_key',
];

/**
 * Check if a key name is sensitive.
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
}

/**
 * Sanitize an object for logging by redacting sensitive values.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Escape a path for safe use in shell commands.
 * Uses proper escaping for the current platform.
 *
 * IMPORTANT: Prefer using spawn/execFile with array arguments instead of
 * shell commands whenever possible. This function is a fallback for cases
 * where shell commands are unavoidable.
 */
export function escapePathForShell(filePath: string): string {
  if (process.platform === 'win32') {
    // Windows: use double quotes, escape internal double quotes
    return `"${filePath.replace(/"/g, '""')}"`;
  }

  // Unix: escape all special characters
  // eslint-disable-next-line no-useless-escape
  return filePath.replace(/(["\s'$`\\!#&*()[\]{}|;<>?~])/g, '\\$1');
}

/**
 * Build safe artisan command arguments for spawn.
 * Returns an array suitable for use with spawn(php, args).
 */
export function buildArtisanArgs(command: string[]): string[] {
  // The command array has already been validated by the schema
  // Just prepend 'artisan' for the spawn call
  return ['artisan', ...command];
}

/**
 * Validate and build a safe shell command for VS Code.
 * Returns the command and whether it's safe to execute.
 */
export function buildVSCodeCommand(projectPath: string): {
  command: string;
  args: string[];
  safe: boolean;
} {
  // Validate path doesn't contain shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>\n\r]/;
  if (dangerousChars.test(projectPath)) {
    return { command: '', args: [], safe: false };
  }

  switch (process.platform) {
    case 'win32':
      return {
        command: 'code',
        args: ['-n', projectPath],
        safe: true,
      };
    case 'darwin':
      return {
        command: 'open',
        args: ['-n', '-b', 'com.microsoft.VSCode', '--args', projectPath],
        safe: true,
      };
    default: // linux
      return {
        command: 'code',
        args: ['-n', projectPath],
        safe: true,
      };
  }
}

/**
 * Terminal application types supported on macOS.
 * Corresponds to Local's defaultTerminal preference values.
 */
export type MacTerminalApp = 'Terminal' | 'iTerm';

/**
 * Validate and build a safe shell command for opening terminal.
 * Returns the command, args, and whether it's safe to execute.
 *
 * @param projectPath - The directory to open in terminal
 * @param terminalApp - macOS terminal app preference (default: 'Terminal')
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
      // Windows: use cmd with /K to keep window open
      return {
        command: 'cmd',
        args: ['/K', `cd /d "${projectPath}"`],
        useShell: true, // Required for cmd /K
        safe: true,
      };

    case 'darwin': {
      // macOS: use AppleScript to control terminal apps
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
        // Terminal.app: Use AppleScript to open new window at directory
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
    }

    default: // linux
      // Linux: try gnome-terminal first
      return {
        command: 'gnome-terminal',
        args: ['--working-directory', projectPath],
        useShell: false,
        safe: true,
      };
  }
}

/**
 * Create a secure IPC handler wrapper that validates input.
 */
export function createSecureHandler<T, R>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { message: string } } },
  handler: (data: T) => Promise<R>
): (data: unknown) => Promise<R | { success: false; error: string }> {
  return async (data: unknown) => {
    const validation = schema.safeParse(data);

    if (!validation.success) {
      return {
        success: false,
        error: validation.error?.message || 'Validation failed',
      };
    }

    return handler(validation.data as T);
  };
}
