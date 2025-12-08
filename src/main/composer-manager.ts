/**
 * Composer Manager (SECURED)
 *
 * Handles all Composer operations for Laravel projects.
 * Uses the bundled composer.phar and Local's PHP runtime.
 *
 * Security measures:
 * - Uses spawn with shell: false instead of exec (no shell injection)
 * - Validates all paths using security utilities
 * - Uses array arguments instead of string commands
 *
 * Design decisions:
 * - Bundle composer.phar with the addon (~3MB) for reliability
 * - Use Local's PHP binary to ensure compatibility
 * - Provide async execution with proper error handling
 * - Support all common Composer operations
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { spawn, SpawnOptions } from 'child_process';
import * as LocalMain from '@getflywheel/local/main';
import * as os from 'os';

import type { ComposerResult, LocalSite } from '../common/types';
import { resolveSitePath, isPathWithinSite } from '../common/security';
import { containsShellMetacharacters } from '../common/validation';

/**
 * Environment variables for Composer execution.
 */
interface ComposerEnv {
  COMPOSER_HOME?: string;
  COMPOSER_CACHE_DIR?: string;
  COMPOSER_NO_INTERACTION?: string;
  PATH?: string;
  HOME?: string;
}

/**
 * Options for running Composer commands.
 */
interface ComposerRunOptions {
  /** Working directory */
  cwd: string;
  /** Timeout in milliseconds (default: 5 minutes) */
  timeout?: number;
  /** Additional environment variables */
  env?: ComposerEnv;
  /** Suppress output (for quiet operations) */
  quiet?: boolean;
}

/**
 * ComposerManager handles all Composer operations.
 *
 * @example
 * ```typescript
 * const composer = new ComposerManager();
 *
 * // Create a new Laravel project
 * await composer.createProject('laravel/laravel', '/path/to/project');
 *
 * // Install dependencies
 * await composer.install('/path/to/project');
 *
 * // Require a package
 * await composer.require('/path/to/project', 'laravel/breeze', '--dev');
 * ```
 */
export class ComposerManager {
  private composerPath: string;
  private logger: any;

  constructor() {
    // Bundled composer.phar location
    this.composerPath = path.join(__dirname, '..', '..', 'vendor', 'composer.phar');

    // Get logger from service container
    const services = LocalMain.getServiceContainer().cradle as any;
    this.logger = services.localLogger;
  }

  /**
   * Get the path to the bundled composer.phar.
   */
  getComposerPath(): string {
    return this.composerPath;
  }

  /**
   * Check if Composer is available and working.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const exists = await fs.pathExists(this.composerPath);
      if (!exists) {
        this.logger.warn('[ComposerManager] composer.phar not found at:', this.composerPath);
        return false;
      }

      // Verify it's executable by checking version
      const result = await this.run(['--version'], { cwd: os.tmpdir(), quiet: true });
      return result.success;
    } catch (error) {
      this.logger.error('[ComposerManager] Error checking availability:', error);
      return false;
    }
  }

  /**
   * Get Composer version information.
   */
  async getVersion(): Promise<string | null> {
    try {
      const result = await this.run(['--version'], { cwd: os.tmpdir(), quiet: true });
      if (result.success) {
        // Parse version from output like "Composer version 2.8.x ..."
        const match = result.output.match(/Composer version ([\d.]+)/);
        return match ? match[1] : result.output.trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the PHP binary path for a site.
   *
   * Uses Local's bundled PHP for the site's configured PHP version.
   */
  getPhpPath(site: LocalSite): string {
    // Get the PHP service configuration
    const phpService = Object.values(site.services).find(
      (service) => service.role === 'php'
    );

    if (!phpService) {
      throw new Error('No PHP service found for site');
    }

    // Construct path to Local's bundled PHP
    // Local stores PHP binaries in the lightning-services directory
    const platform = process.platform;
    const phpVersion = phpService.version;

    // Local's PHP binary path structure varies by platform
    // This is a simplified version - actual path depends on Local's installation
    const localPath = process.env.LOCAL_PATH || '/Applications/Local.app';

    if (platform === 'darwin') {
      return path.join(
        localPath,
        'Contents/Resources/extraResources/lightning-services',
        `php-${phpVersion}`,
        'bin/darwin/bin/php'
      );
    } else if (platform === 'win32') {
      return path.join(
        localPath,
        'resources/extraResources/lightning-services',
        `php-${phpVersion}`,
        'bin/win64/php.exe'
      );
    } else {
      // Linux
      return path.join(
        localPath,
        'resources/extraResources/lightning-services',
        `php-${phpVersion}`,
        'bin/linux/bin/php'
      );
    }
  }

  /**
   * Get PHP path from site's run data (more reliable method).
   *
   * Local stores the actual PHP binary path in the site's service configuration.
   */
  getPhpPathFromSite(site: LocalSite): string | null {
    const phpService = Object.values(site.services).find(
      (service) => service.role === 'php'
    ) as any;

    // Check if bin path is available in service config
    if (phpService?.bin?.php) {
      return phpService.bin.php;
    }

    return null;
  }

  /**
   * Build the Composer command arguments for spawn.
   * Returns array of arguments: [composerPath, ...args]
   *
   * SECURITY: Uses array arguments, not string interpolation.
   */
  private buildArgs(args: string[]): string[] {
    return [this.composerPath, ...args];
  }

  /**
   * Validate arguments don't contain shell metacharacters.
   *
   * SECURITY: Prevents command injection via arguments.
   */
  private validateArgs(args: string[]): boolean {
    for (const arg of args) {
      // Allow paths with spaces but reject shell metacharacters
      if (containsShellMetacharacters(arg)) {
        this.logger.error('[ComposerManager] Dangerous characters in argument:', arg);
        return false;
      }
    }
    return true;
  }

  /**
   * Get default environment variables for Composer.
   */
  private getDefaultEnv(): ComposerEnv {
    const homeDir = os.homedir();

    return {
      COMPOSER_HOME: path.join(homeDir, '.composer'),
      COMPOSER_CACHE_DIR: path.join(homeDir, '.composer', 'cache'),
      COMPOSER_NO_INTERACTION: '1',
      PATH: process.env.PATH,
      HOME: homeDir,
    };
  }

  /**
   * Run a Composer command (SECURED).
   *
   * SECURITY: Uses spawn with shell: false and array arguments.
   *
   * @param args - Command arguments (e.g., ['install', '--no-dev'])
   * @param options - Execution options
   * @returns Command result with output and exit code
   */
  async run(args: string[], options: ComposerRunOptions): Promise<ComposerResult> {
    const startTime = Date.now();

    // Validate arguments don't contain injection characters
    if (!this.validateArgs(args)) {
      return {
        success: false,
        output: 'Invalid arguments: contains dangerous characters',
        exitCode: 1,
        duration: Date.now() - startTime,
      };
    }

    // Build array of arguments for spawn (no shell interpolation)
    const spawnArgs = this.buildArgs(args);

    const spawnOptions: SpawnOptions = {
      cwd: options.cwd,
      shell: false, // CRITICAL: Don't use shell to prevent injection
      env: {
        ...process.env,
        ...this.getDefaultEnv(),
        ...options.env,
      },
    };

    if (!options.quiet) {
      this.logger.info('[ComposerManager] Running: php', spawnArgs.join(' '));
      this.logger.info('[ComposerManager] In directory:', options.cwd);
    }

    return new Promise((resolve) => {
      const child = spawn('php', spawnArgs, spawnOptions);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          output: 'Command timed out',
          exitCode: 124,
          duration,
        });
      }, options.timeout || 5 * 60 * 1000);

      child.on('close', (code: number | null) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        const output = stdout + (stderr ? `\n${stderr}` : '');

        if (!options.quiet) {
          this.logger.info('[ComposerManager] Command completed in', duration, 'ms');
        }

        resolve({
          success: code === 0,
          output: output.trim(),
          exitCode: code || 0,
          duration,
        });
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        this.logger.error('[ComposerManager] Command failed:', error.message);

        resolve({
          success: false,
          output: error.message,
          exitCode: 1,
          duration,
        });
      });
    });
  }

  /**
   * Run a Composer command for a specific site (SECURED).
   *
   * SECURITY: Uses spawn with shell: false and validates paths.
   * Uses the site's configured PHP version.
   */
  async runForSite(
    site: LocalSite,
    args: string[],
    options?: Partial<ComposerRunOptions>
  ): Promise<ComposerResult> {
    const startTime = Date.now();

    // Validate arguments don't contain injection characters
    if (!this.validateArgs(args)) {
      return {
        success: false,
        output: 'Invalid arguments: contains dangerous characters',
        exitCode: 1,
        duration: Date.now() - startTime,
      };
    }

    const phpPath = this.getPhpPathFromSite(site) || 'php';
    const spawnArgs = this.buildArgs(args);

    // Resolve site path securely
    const sitePath = resolveSitePath(site.path);
    const cwd = options?.cwd || path.join(sitePath, 'app');

    // Validate cwd is within site directory
    if (!isPathWithinSite(sitePath, cwd)) {
      return {
        success: false,
        output: 'Invalid working directory: security violation',
        exitCode: 1,
        duration: Date.now() - startTime,
      };
    }

    const spawnOptions: SpawnOptions = {
      cwd,
      shell: false, // CRITICAL: Don't use shell to prevent injection
      env: {
        ...process.env,
        ...this.getDefaultEnv(),
        ...options?.env,
      },
    };

    this.logger.info('[ComposerManager] Running for site:', site.name);
    this.logger.info('[ComposerManager] PHP:', phpPath);
    this.logger.info('[ComposerManager] Args:', spawnArgs.join(' '));

    return new Promise((resolve) => {
      const child = spawn(phpPath, spawnArgs, spawnOptions);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          output: 'Command timed out',
          exitCode: 124,
          duration,
        });
      }, options?.timeout || 5 * 60 * 1000);

      child.on('close', (code: number | null) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        resolve({
          success: code === 0,
          output: (stdout + (stderr ? `\n${stderr}` : '')).trim(),
          exitCode: code || 0,
          duration,
        });
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        resolve({
          success: false,
          output: error.message,
          exitCode: 1,
          duration,
        });
      });
    });
  }

  /**
   * Create a new Laravel project (SECURED).
   *
   * SECURITY: Validates project path and constraint.
   *
   * @param projectPath - Directory to create the project in
   * @param laravelConstraint - Composer version constraint (e.g., 'laravel/laravel:^11.0')
   */
  async createProject(
    projectPath: string,
    laravelConstraint: string = 'laravel/laravel'
  ): Promise<ComposerResult> {
    // Validate path doesn't contain dangerous characters
    if (containsShellMetacharacters(projectPath)) {
      return {
        success: false,
        output: 'Invalid project path: contains dangerous characters',
        exitCode: 1,
        duration: 0,
      };
    }

    // Validate constraint doesn't contain injection characters
    if (containsShellMetacharacters(laravelConstraint)) {
      return {
        success: false,
        output: 'Invalid package constraint: contains dangerous characters',
        exitCode: 1,
        duration: 0,
      };
    }

    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(projectPath));

    // Create project - pass path directly (no shell quoting needed with spawn)
    return this.run(
      [
        'create-project',
        '--prefer-dist',
        '--no-interaction',
        '--ignore-platform-reqs',  // Use Local's PHP version, not system PHP
        laravelConstraint,
        projectPath,  // spawn handles spaces correctly
      ],
      { cwd: path.dirname(projectPath) }
    );
  }

  /**
   * Install dependencies from composer.json.
   */
  async install(projectPath: string, dev: boolean = true): Promise<ComposerResult> {
    const args = ['install', '--no-interaction'];

    if (!dev) {
      args.push('--no-dev');
    }

    return this.run(args, { cwd: projectPath });
  }

  /**
   * Update dependencies.
   */
  async update(projectPath: string): Promise<ComposerResult> {
    return this.run(['update', '--no-interaction'], { cwd: projectPath });
  }

  /**
   * Require a new package.
   */
  async require(
    projectPath: string,
    packageName: string,
    isDev: boolean = false
  ): Promise<ComposerResult> {
    const args = ['require', '--no-interaction', packageName];

    if (isDev) {
      args.push('--dev');
    }

    return this.run(args, { cwd: projectPath });
  }

  /**
   * Remove a package.
   */
  async remove(projectPath: string, packageName: string): Promise<ComposerResult> {
    return this.run(['remove', '--no-interaction', packageName], { cwd: projectPath });
  }

  /**
   * Dump autoloader.
   */
  async dumpAutoload(projectPath: string, optimize: boolean = false): Promise<ComposerResult> {
    const args = ['dump-autoload'];

    if (optimize) {
      args.push('--optimize');
    }

    return this.run(args, { cwd: projectPath });
  }

}

// Export singleton instance for convenience
export const composerManager = new ComposerManager();
