/**
 * Security Module Tests
 *
 * Comprehensive tests for security utilities.
 */

import * as path from 'path';
import * as os from 'os';

import {
  resolveSitePath,
  isPathWithinSite,
  getSafeAppPath,
  getSafePathInApp,
  sanitizeForLogging,
  escapePathForShell,
  buildArtisanArgs,
  buildVSCodeCommand,
  buildTerminalCommand,
  createSecureHandler,
} from '../../src/common/security';

describe('Security Module', () => {
  describe('resolveSitePath', () => {
    it('should expand tilde to home directory', () => {
      const result = resolveSitePath('~/Sites/mysite');
      expect(result).toBe(path.join(os.homedir(), 'Sites/mysite'));
    });

    it('should resolve relative paths', () => {
      const result = resolveSitePath('./mysite');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should keep absolute paths as is', () => {
      const absolutePath = '/Users/test/Sites/mysite';
      const result = resolveSitePath(absolutePath);
      expect(result).toBe(absolutePath);
    });
  });

  describe('isPathWithinSite', () => {
    const sitePath = '/Users/test/Local Sites/mysite';

    it('should return true for paths within site', () => {
      expect(isPathWithinSite(sitePath, '/Users/test/Local Sites/mysite/app')).toBe(true);
      expect(isPathWithinSite(sitePath, '/Users/test/Local Sites/mysite/app/public')).toBe(true);
    });

    it('should return true for the site path itself', () => {
      expect(isPathWithinSite(sitePath, sitePath)).toBe(true);
    });

    it('should return false for paths outside site', () => {
      expect(isPathWithinSite(sitePath, '/Users/test/Local Sites/othersite')).toBe(false);
      expect(isPathWithinSite(sitePath, '/etc/passwd')).toBe(false);
    });

    it('should prevent path traversal attacks', () => {
      expect(isPathWithinSite(sitePath, '/Users/test/Local Sites/mysite/../othersite')).toBe(false);
      expect(isPathWithinSite(sitePath, '/Users/test/Local Sites/mysite/app/../../..')).toBe(false);
    });
  });

  describe('getSafeAppPath', () => {
    it('should return the app path for a site', () => {
      const sitePath = '/Users/test/Local Sites/mysite';
      const result = getSafeAppPath(sitePath);
      expect(result).toBe(path.join(sitePath, 'app'));
    });

    it('should handle tilde paths', () => {
      const sitePath = '~/Local Sites/mysite';
      const result = getSafeAppPath(sitePath);
      expect(result).toBe(path.join(os.homedir(), 'Local Sites/mysite', 'app'));
    });
  });

  describe('getSafePathInApp', () => {
    const sitePath = '/Users/test/Local Sites/mysite';

    it('should return path within app directory', () => {
      const result = getSafePathInApp(sitePath, 'storage', 'logs');
      expect(result).toBe(path.join(sitePath, 'app', 'storage', 'logs'));
    });

    it('should throw for path traversal attempts', () => {
      expect(() => getSafePathInApp(sitePath, '..', '..', 'etc')).toThrow('path traversal');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should return null/undefined as is', () => {
      expect(sanitizeForLogging(null)).toBe(null);
      expect(sanitizeForLogging(undefined)).toBe(undefined);
    });

    it('should return strings as is', () => {
      expect(sanitizeForLogging('hello')).toBe('hello');
    });

    it('should sanitize arrays', () => {
      const input = [{ password: 'secret' }, 'normal'];
      const result = sanitizeForLogging(input) as unknown[];
      expect(result[0]).toEqual({ password: '[REDACTED]' });
      expect(result[1]).toBe('normal');
    });

    it('should redact sensitive keys', () => {
      const input = {
        username: 'admin',
        password: 'secret123',
        api_key: 'key123',
        app_key: 'appkey',
        token: 'tokenvalue',
      };
      const result = sanitizeForLogging(input) as Record<string, unknown>;

      expect(result.username).toBe('admin');
      expect(result.password).toBe('[REDACTED]');
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.app_key).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const input = {
        config: {
          database_password: 'dbpass',
          host: 'localhost',
        },
      };
      const result = sanitizeForLogging(input) as Record<string, Record<string, unknown>>;

      expect(result.config.database_password).toBe('[REDACTED]');
      expect(result.config.host).toBe('localhost');
    });

    it('should return primitive types as is', () => {
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(true)).toBe(true);
    });
  });

  describe('escapePathForShell', () => {
    it('should escape special characters on Unix', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = escapePathForShell('/path/with spaces/file');
      expect(result).toContain('\\ ');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should use double quotes on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = escapePathForShell('C:\\path\\file');
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('buildArtisanArgs', () => {
    it('should prepend artisan to command', () => {
      const result = buildArtisanArgs(['migrate']);
      expect(result).toEqual(['artisan', 'migrate']);
    });

    it('should preserve command arguments', () => {
      const result = buildArtisanArgs(['make:model', 'User', '--migration']);
      expect(result).toEqual(['artisan', 'make:model', 'User', '--migration']);
    });
  });

  describe('buildVSCodeCommand', () => {
    it('should return safe for valid paths', () => {
      const result = buildVSCodeCommand('/path/to/project');
      expect(result.safe).toBe(true);
      expect(result.command).toBeTruthy();
    });

    it('should return unsafe for paths with shell metacharacters', () => {
      const result = buildVSCodeCommand('/path;rm -rf');
      expect(result.safe).toBe(false);
      expect(result.command).toBe('');
    });

    it('should handle macOS platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = buildVSCodeCommand('/path/to/project');
      expect(result.command).toBe('open');
      expect(result.args).toContain('com.microsoft.VSCode');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Windows platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = buildVSCodeCommand('/path/to/project');
      expect(result.command).toBe('code');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Linux platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = buildVSCodeCommand('/path/to/project');
      expect(result.command).toBe('code');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('buildTerminalCommand', () => {
    it('should return safe for valid paths', () => {
      const result = buildTerminalCommand('/path/to/project');
      expect(result.safe).toBe(true);
      expect(result.command).toBeTruthy();
    });

    it('should return unsafe for paths with shell metacharacters', () => {
      const result = buildTerminalCommand('/path$(whoami)');
      expect(result.safe).toBe(false);
    });

    it('should handle macOS platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const result = buildTerminalCommand('/path/to/project');
      expect(result.command).toBe('open');
      expect(result.args).toContain('Terminal');
      expect(result.useShell).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Windows platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const result = buildTerminalCommand('/path/to/project');
      expect(result.command).toBe('cmd');
      expect(result.useShell).toBe(true);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Linux platform', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      const result = buildTerminalCommand('/path/to/project');
      expect(result.command).toBe('gnome-terminal');
      expect(result.useShell).toBe(false);

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('createSecureHandler', () => {
    const mockSchema = {
      safeParse: (data: unknown) => {
        if (typeof data === 'string' && data.length > 0) {
          return { success: true, data };
        }
        return { success: false, error: { message: 'Validation failed' } };
      },
    };

    it('should call handler for valid input', async () => {
      const handler = jest.fn().mockResolvedValue({ success: true });
      const secureHandler = createSecureHandler(mockSchema, handler);

      const result = await secureHandler('valid-input');

      expect(handler).toHaveBeenCalledWith('valid-input');
      expect(result).toEqual({ success: true });
    });

    it('should return error for invalid input', async () => {
      const handler = jest.fn();
      const secureHandler = createSecureHandler(mockSchema, handler);

      const result = await secureHandler('');

      expect(handler).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
      });
    });
  });
});
