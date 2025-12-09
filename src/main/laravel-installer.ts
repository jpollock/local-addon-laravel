/**
 * Laravel Installer
 *
 * Handles the installation and configuration of new Laravel projects.
 * Called after Local provisions the site infrastructure.
 *
 * Installation flow:
 * 1. Create Laravel project via Composer
 * 2. Configure .env with Local's database credentials
 * 3. Generate application key
 * 4. Run database migrations
 * 5. Install starter kit (if selected)
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as LocalMain from '@getflywheel/local/main';

import { composerManager } from './composer-manager';
import { npmManager } from './npm-manager';
import { LARAVEL_VERSIONS, CREATION_STAGES } from '../common/constants';
import type {
  LaravelVersion,
  StarterKit,
  BreezeStack,
  JetstreamStack,
  LocalSite,
  CreationProgress,
} from '../common/types';

/**
 * Options for Laravel installation.
 */
export interface LaravelInstallOptions {
  /** Laravel version to install */
  laravelVersion: LaravelVersion;

  /** Starter kit to install */
  starterKit: StarterKit;

  /** Breeze stack (if breeze selected) */
  breezeStack?: BreezeStack;

  /** Jetstream stack (if jetstream selected) */
  jetstreamStack?: JetstreamStack;

  /** Jetstream teams feature */
  jetstreamTeams?: boolean;

  /** Jetstream API feature */
  jetstreamApi?: boolean;

  /** Progress callback */
  onProgress?: (progress: CreationProgress) => void;
}

/**
 * Result of Laravel installation.
 */
export interface LaravelInstallResult {
  success: boolean;
  error?: string;
  laravelVersion?: string;
  installedPackages?: string[];
}

/**
 * LaravelInstaller handles creating and configuring Laravel projects.
 */
export class LaravelInstaller {
  private logger: any;
  private services: any;

  constructor() {
    this.services = LocalMain.getServiceContainer().cradle as any;
    this.logger = this.services.localLogger;
  }

  /**
   * Install Laravel for a site.
   *
   * @param site - The Local site object
   * @param options - Installation options
   */
  async install(site: LocalSite, options: LaravelInstallOptions): Promise<LaravelInstallResult> {
    const { laravelVersion, starterKit, onProgress } = options;

    const sitePath = this.resolveSitePath(site.path);
    const appPath = path.join(sitePath, 'app');

    this.logger.info(`[LaravelInstaller] Starting installation for ${site.name}`);
    this.logger.info(`[LaravelInstaller] Path: ${appPath}`);
    this.logger.info(`[LaravelInstaller] Version: Laravel ${laravelVersion}`);

    try {
      // Step 1: Create Laravel project
      this.reportProgress(onProgress, CREATION_STAGES.INSTALLING_COMPOSER);

      const versionConfig = LARAVEL_VERSIONS[laravelVersion];
      if (!versionConfig) {
        throw new Error(`Unknown Laravel version: ${laravelVersion}`);
      }

      this.reportProgress(onProgress, CREATION_STAGES.CREATING_PROJECT);

      // Clear the app directory if it exists (remove WordPress placeholder)
      if (await fs.pathExists(appPath)) {
        await fs.emptyDir(appPath);
      }

      // Create Laravel project
      const createResult = await composerManager.createProject(
        appPath,
        versionConfig.constraint
      );

      if (!createResult.success) {
        throw new Error(`Composer create-project failed: ${createResult.output}`);
      }

      this.logger.info('[LaravelInstaller] Laravel project created successfully');

      // Disable Composer's runtime PHP version check
      // (Local's PHP 8.3 works fine, but some packages declare 8.4+ requirement)
      await composerManager.runForSite(site, [
        'config',
        'platform-check',
        'false',
      ]);
      this.logger.info('[LaravelInstaller] Disabled Composer platform check');

      // Step 2: Configure .env
      this.reportProgress(onProgress, CREATION_STAGES.CONFIGURING_ENV);

      await this.configureEnvironment(site, appPath);
      this.logger.info('[LaravelInstaller] Environment configured');

      // Step 3: Generate application key
      await this.runArtisan(appPath, ['key:generate', '--force']);
      this.logger.info('[LaravelInstaller] Application key generated');

      // Step 4: Wait for database and run migrations
      this.reportProgress(onProgress, CREATION_STAGES.RUNNING_MIGRATIONS);

      // Wait for database to be ready
      await this.waitForDatabase(site);

      await this.runArtisan(appPath, ['migrate', '--force']);
      this.logger.info('[LaravelInstaller] Migrations completed');

      // Step 5: Install starter kit if selected
      const installedPackages: string[] = [];

      if (starterKit !== 'none') {
        this.logger.info(`[LaravelInstaller] Installing starter kit: ${starterKit}`);

        const packages = await this.installStarterKit(site, appPath, options);
        installedPackages.push(...packages);
      }

      // Step 6: Finalize
      this.reportProgress(onProgress, CREATION_STAGES.FINALIZING);

      // Create storage link
      await this.runArtisan(appPath, ['storage:link']);

      // Set proper permissions on storage and cache
      await this.setPermissions(appPath);

      this.reportProgress(onProgress, CREATION_STAGES.COMPLETE);

      return {
        success: true,
        laravelVersion: laravelVersion,
        installedPackages,
      };
    } catch (error: any) {
      this.logger.error('[LaravelInstaller] Installation failed:', error);

      return {
        success: false,
        error: error.message || 'Unknown error during installation',
      };
    }
  }

  /**
   * Configure Laravel's .env file with Local's database credentials.
   */
  private async configureEnvironment(site: LocalSite, appPath: string): Promise<void> {
    const envPath = path.join(appPath, '.env');
    const envExamplePath = path.join(appPath, '.env.example');

    // Start with .env.example if .env doesn't exist
    if (!(await fs.pathExists(envPath)) && (await fs.pathExists(envExamplePath))) {
      await fs.copy(envExamplePath, envPath);
    }

    let envContent = await fs.readFile(envPath, 'utf8');

    // Update environment variables
    // Note: escapeEnvValue quotes values with spaces (e.g., socket paths on macOS)
    const socketPath = this.getMysqlSocketPath(site);
    this.logger.info(`[LaravelInstaller] MySQL socket path: ${socketPath}`);

    const updates: Record<string, string> = {
      APP_NAME: this.escapeEnvValue(site.name),
      APP_ENV: 'local',
      APP_DEBUG: 'true',
      APP_URL: `http://${site.domain}`,

      DB_CONNECTION: 'mysql',
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_DATABASE: site.mysql.database,
      DB_USERNAME: site.mysql.user,
      DB_PASSWORD: this.escapeEnvValue(site.mysql.password),

      // Add socket path for Local's MySQL (quoted for spaces in path)
      DB_SOCKET: this.escapeEnvValue(socketPath),
    };

    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');

      if (regex.test(envContent)) {
        // Update existing key
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        // Add new key
        envContent += `\n${key}=${value}`;
      }
    }

    await fs.writeFile(envPath, envContent.trim() + '\n');
  }

  /**
   * Get MySQL socket path for a site.
   */
  private getMysqlSocketPath(site: LocalSite): string {
    const runDataPath = site.paths?.runData;

    // Check if runDataPath is a real path (not an unresolved template variable)
    if (runDataPath && !runDataPath.includes('%%')) {
      const resolvedPath = runDataPath.startsWith('~')
        ? runDataPath.replace('~', os.homedir())
        : runDataPath;
      return path.join(resolvedPath, 'mysql', 'mysqld.sock');
    }

    // Platform-specific fallback paths
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/Local/run/{siteId}/mysql/mysqld.sock
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Local',
        'run',
        site.id,
        'mysql',
        'mysqld.sock'
      );
    } else if (platform === 'win32') {
      // Windows: %APPDATA%/Local/run/{siteId}/mysql/mysqld.sock
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'Local', 'run', site.id, 'mysql', 'mysqld.sock');
    } else {
      // Linux: ~/.config/Local/run/{siteId}/mysql/mysqld.sock
      return path.join(os.homedir(), '.config', 'Local', 'run', site.id, 'mysql', 'mysqld.sock');
    }
  }

  /**
   * Run an artisan command.
   *
   * Prepends node wrapper to PATH so that artisan commands that run npm
   * (like breeze:install) use Electron's Node.js instead of system Node.
   */
  private async runArtisan(appPath: string, args: string[]): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Get node wrapper directory and prepend to PATH
    const wrapperDir = await npmManager.ensureNodeWrapper();
    const newPath = `${wrapperDir}${path.delimiter}${process.env.PATH || ''}`;

    const command = `php artisan ${args.join(' ')}`;

    this.logger.info(`[LaravelInstaller] Running: ${command}`);
    this.logger.info(`[LaravelInstaller] Node wrapper PATH: ${wrapperDir}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: appPath,
        timeout: 120000, // 2 minute timeout for commands that run npm
        env: {
          ...process.env,
          PATH: newPath,
        },
      });

      if (stdout) {
        this.logger.info(`[LaravelInstaller] Artisan output: ${stdout.trim()}`);
      }
      if (stderr) {
        this.logger.warn(`[LaravelInstaller] Artisan stderr: ${stderr.trim()}`);
      }
    } catch (error: any) {
      this.logger.error(`[LaravelInstaller] Artisan command failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run an npm command using NpmManager.
   *
   * Uses smart npm detection:
   * 1. Tries system npm first (user's installed version)
   * 2. Falls back to bundled npm with Electron as Node.js
   */
  private async runNpm(appPath: string, args: string[]): Promise<void> {
    this.logger.info(`[LaravelInstaller] Running: npm ${args.join(' ')}`);

    try {
      await npmManager.runCommand(args, {
        cwd: appPath,
        onProgress: (output) => {
          // Log npm output for debugging
          if (output.trim()) {
            this.logger.info(`[LaravelInstaller] npm: ${output.trim()}`);
          }
        },
      });
      this.logger.info(`[LaravelInstaller] npm ${args[0]} completed`);
    } catch (error: any) {
      this.logger.warn(`[LaravelInstaller] npm command failed (non-critical): ${error.message}`);
      // Don't throw - npm failures shouldn't block installation
      // Laravel will still work, just without compiled frontend assets
    }
  }

  /**
   * Wait for database to be ready.
   */
  private async waitForDatabase(site: LocalSite): Promise<void> {
    const { siteDatabase } = this.services;

    this.logger.info('[LaravelInstaller] Waiting for database...');

    try {
      await siteDatabase.waitForDB(site);
      this.logger.info('[LaravelInstaller] Database ready');
    } catch (error) {
      this.logger.warn('[LaravelInstaller] Database wait timeout, proceeding anyway');
    }
  }

  /**
   * Set proper permissions on Laravel directories.
   */
  private async setPermissions(appPath: string): Promise<void> {
    const dirsToChmod = ['storage', 'bootstrap/cache'];

    for (const dir of dirsToChmod) {
      const dirPath = path.join(appPath, dir);

      if (await fs.pathExists(dirPath)) {
        try {
          // Make writable
          await fs.chmod(dirPath, 0o775);
        } catch (error) {
          this.logger.warn(`[LaravelInstaller] Could not set permissions on ${dir}`);
        }
      }
    }
  }

  /**
   * Install the selected starter kit.
   */
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
        await this.installJetstream(site, appPath, options.laravelVersion, jetstreamStack!, jetstreamTeams, jetstreamApi);
        installedPackages.push('laravel/jetstream');
        break;
    }

    return installedPackages;
  }

  /**
   * Install Laravel Breeze starter kit.
   */
  private async installBreeze(
    site: LocalSite,
    appPath: string,
    stack: BreezeStack
  ): Promise<void> {
    // Install Breeze package (dev dependency)
    await composerManager.runForSite(site, [
      'require',
      'laravel/breeze',
      '--dev',
      '--no-interaction',
      '--ignore-platform-reqs',
    ], { cwd: appPath });

    // Run breeze:install with the selected stack
    await this.runArtisan(appPath, ['breeze:install', stack]);
    this.logger.info(`[LaravelInstaller] Breeze ${stack} stack installed`);

    // Build frontend assets (skip for API mode - no frontend)
    if (stack !== 'api') {
      await this.buildFrontendAssets(appPath);
    } else {
      this.logger.info('[LaravelInstaller] API mode: skipping frontend build');
    }
  }

  /**
   * Install Laravel Jetstream starter kit.
   */
  private async installJetstream(
    site: LocalSite,
    appPath: string,
    laravelVersion: LaravelVersion,
    stack: JetstreamStack,
    teams?: boolean,
    api?: boolean
  ): Promise<void> {
    // Jetstream version depends on Laravel version
    // Jetstream 5.x for Laravel 11, 4.x for Laravel 10
    const jetstreamVersion = laravelVersion === '11' ? '^5.0' : '^4.0';

    // Install Jetstream package (dev dependency)
    await composerManager.runForSite(site, [
      'require',
      `laravel/jetstream:${jetstreamVersion}`,
      '--dev',
      '--no-interaction',
      '--ignore-platform-reqs',
    ], { cwd: appPath });

    // Build artisan command with optional flags
    const args = ['jetstream:install', stack];
    if (teams) args.push('--teams');
    if (api) args.push('--api');

    await this.runArtisan(appPath, args);
    this.logger.info(`[LaravelInstaller] Jetstream ${stack} stack installed (teams: ${!!teams}, api: ${!!api})`);

    // Jetstream always has frontend assets
    await this.buildFrontendAssets(appPath);
  }

  /**
   * Build frontend assets with npm.
   */
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

  /**
   * Escape a value for .env file.
   */
  private escapeEnvValue(value: string): string {
    // If value contains spaces or special characters, quote it
    if (/[\s"'#]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  /**
   * Resolve site path (handle ~ prefix).
   */
  private resolveSitePath(sitePath: string): string {
    if (sitePath.startsWith('~')) {
      return sitePath.replace('~', os.homedir());
    }
    return sitePath;
  }

  /**
   * Report progress to callback.
   */
  private reportProgress(
    callback: ((progress: CreationProgress) => void) | undefined,
    stage: { progress: number; message: string }
  ): void {
    if (callback) {
      callback({
        progress: stage.progress,
        stage: Object.keys(CREATION_STAGES).find(
          (key) => CREATION_STAGES[key as keyof typeof CREATION_STAGES] === stage
        ) || 'unknown',
        message: stage.message,
      });
    }
  }
}

// Export singleton instance
export const laravelInstaller = new LaravelInstaller();
