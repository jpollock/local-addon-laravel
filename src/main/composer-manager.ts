/**
 * Composer Manager
 *
 * Handles all Composer operations for Laravel projects.
 * Uses the bundled composer.phar and Local's PHP runtime.
 *
 * Design decisions:
 * - Bundle composer.phar with the addon (~3MB) for reliability
 * - Use Local's PHP binary to ensure compatibility
 * - Provide async execution with proper error handling
 * - Support all common Composer operations
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import { exec, ExecOptions } from 'child_process';
import { promisify } from 'util';
import * as LocalMain from '@getflywheel/local/main';
import * as os from 'os';

import type { ComposerResult, LocalSite } from '../common/types';

const execAsync = promisify(exec);

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
   * Build the Composer command with PHP path.
   */
  private buildCommand(phpPath: string, args: string[]): string {
    // Escape paths for shell
    const escapedPhp = this.escapePath(phpPath);
    const escapedComposer = this.escapePath(this.composerPath);

    return `${escapedPhp} ${escapedComposer} ${args.join(' ')}`;
  }

  /**
   * Escape a path for shell execution.
   */
  private escapePath(filePath: string): string {
    // Handle spaces and special characters
    if (process.platform === 'win32') {
      return `"${filePath}"`;
    }
    return filePath.replace(/ /g, '\\ ');
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
   * Run a Composer command.
   *
   * @param args - Command arguments (e.g., ['install', '--no-dev'])
   * @param options - Execution options
   * @returns Command result with output and exit code
   */
  async run(args: string[], options: ComposerRunOptions): Promise<ComposerResult> {
    const startTime = Date.now();

    // Use system PHP for simple commands, or site PHP for project commands
    const phpPath = process.execPath; // Electron's Node can run PHP via child_process

    // For actual PHP execution, we need a real PHP binary
    // Use 'php' from PATH as fallback
    const command = `php ${this.escapePath(this.composerPath)} ${args.join(' ')}`;

    const execOptions: ExecOptions = {
      cwd: options.cwd,
      timeout: options.timeout || 5 * 60 * 1000, // 5 minutes default
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
      env: {
        ...process.env,
        ...this.getDefaultEnv(),
        ...options.env,
      },
    };

    if (!options.quiet) {
      this.logger.info('[ComposerManager] Running:', command);
      this.logger.info('[ComposerManager] In directory:', options.cwd);
    }

    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      const output = stdout + (stderr ? `\n${stderr}` : '');

      if (!options.quiet) {
        this.logger.info('[ComposerManager] Command completed in', duration, 'ms');
      }

      return {
        success: true,
        output: output.trim(),
        exitCode: 0,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.logger.error('[ComposerManager] Command failed:', error.message);

      return {
        success: false,
        output: error.stdout + (error.stderr ? `\n${error.stderr}` : '') || error.message,
        exitCode: error.code || 1,
        duration,
      };
    }
  }

  /**
   * Run a Composer command for a specific site.
   *
   * Uses the site's configured PHP version.
   */
  async runForSite(
    site: LocalSite,
    args: string[],
    options?: Partial<ComposerRunOptions>
  ): Promise<ComposerResult> {
    const phpPath = this.getPhpPathFromSite(site) || 'php';
    const command = `${this.escapePath(phpPath)} ${this.escapePath(this.composerPath)} ${args.join(' ')}`;

    const startTime = Date.now();
    const cwd = options?.cwd || path.join(this.resolveSitePath(site), 'app');

    const execOptions: ExecOptions = {
      cwd,
      timeout: options?.timeout || 5 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ...this.getDefaultEnv(),
        ...options?.env,
      },
    };

    this.logger.info('[ComposerManager] Running for site:', site.name);
    this.logger.info('[ComposerManager] Command:', command);

    try {
      const { stdout, stderr } = await execAsync(command, execOptions);
      const duration = Date.now() - startTime;

      return {
        success: true,
        output: (stdout + (stderr ? `\n${stderr}` : '')).trim(),
        exitCode: 0,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        output: error.stdout + (error.stderr ? `\n${error.stderr}` : '') || error.message,
        exitCode: error.code || 1,
        duration,
      };
    }
  }

  /**
   * Create a new Laravel project.
   *
   * @param projectPath - Directory to create the project in
   * @param laravelConstraint - Composer version constraint (e.g., 'laravel/laravel:^11.0')
   */
  async createProject(
    projectPath: string,
    laravelConstraint: string = 'laravel/laravel'
  ): Promise<ComposerResult> {
    // Ensure parent directory exists
    await fs.ensureDir(path.dirname(projectPath));

    // Create project - quote path to handle spaces (e.g., "Local Sites")
    const quotedPath = `"${projectPath}"`;

    return this.run(
      [
        'create-project',
        '--prefer-dist',
        '--no-interaction',
        '--ignore-platform-reqs',  // Use Local's PHP version, not system PHP
        laravelConstraint,
        quotedPath,
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

  /**
   * Resolve site path (handle ~ prefix).
   */
  private resolveSitePath(site: LocalSite): string {
    if (site.path.startsWith('~')) {
      return site.path.replace('~', os.homedir());
    }
    return site.path;
  }
}

// Export singleton instance for convenience
export const composerManager = new ComposerManager();
