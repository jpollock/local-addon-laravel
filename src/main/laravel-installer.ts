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
import { LARAVEL_VERSIONS, STARTER_KITS, CREATION_STAGES } from '../common/constants';
import type {
  LaravelVersion,
  StarterKit,
  BreezeStack,
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
    const { laravelVersion, starterKit, breezeStack, onProgress } = options;

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
        const kitConfig = STARTER_KITS[starterKit];

        this.logger.info(`[LaravelInstaller] Installing starter kit: ${starterKit}`);

        for (const pkg of kitConfig.packages) {
          const requireResult = await composerManager.runForSite(site, [
            'require',
            pkg,
            '--no-interaction',
          ], { cwd: appPath });

          if (requireResult.success) {
            installedPackages.push(pkg);
          }
        }

        // Run post-install commands for the kit
        if (kitConfig.postInstall && kitConfig.postInstall.length > 0) {
          const breezeArgs: string[] = [...kitConfig.postInstall];

          // Add stack option for Breeze
          if (starterKit === 'breeze' && breezeStack) {
            breezeArgs[1] = breezeStack as string;
          }

          await this.runArtisan(appPath, breezeArgs);
          this.logger.info(`[LaravelInstaller] Starter kit ${starterKit} installed`);

          // Run npm install and build if frontend assets exist
          const packageJsonPath = path.join(appPath, 'package.json');
          if (await fs.pathExists(packageJsonPath)) {
            await this.runNpm(appPath, ['install']);
            await this.runNpm(appPath, ['run', 'build']);
            this.logger.info('[LaravelInstaller] Frontend assets built');
          }
        }
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
      DB_PASSWORD: site.mysql.password,

      // Add socket path for Local's MySQL
      DB_SOCKET: this.getMysqlSocketPath(site),
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

    if (runDataPath) {
      const resolvedPath = runDataPath.startsWith('~')
        ? runDataPath.replace('~', os.homedir())
        : runDataPath;
      return path.join(resolvedPath, 'mysql', 'mysqld.sock');
    }

    // Fallback
    return path.join(os.homedir(), '.config', 'Local', 'run', site.id, 'mysql', 'mysqld.sock');
  }

  /**
   * Run an artisan command.
   */
  private async runArtisan(appPath: string, args: string[]): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const command = `php artisan ${args.join(' ')}`;

    this.logger.info(`[LaravelInstaller] Running: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: appPath,
        timeout: 60000, // 1 minute timeout
        env: {
          ...process.env,
          PATH: process.env.PATH,
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
   * Run an npm command.
   */
  private async runNpm(appPath: string, args: string[]): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const command = `npm ${args.join(' ')}`;

    this.logger.info(`[LaravelInstaller] Running: ${command}`);

    try {
      await execAsync(command, {
        cwd: appPath,
        timeout: 5 * 60 * 1000, // 5 minute timeout for npm
        env: {
          ...process.env,
          PATH: process.env.PATH,
        },
      });
    } catch (error: any) {
      this.logger.warn(`[LaravelInstaller] npm command failed (non-critical): ${error.message}`);
      // Don't throw - npm failures shouldn't block installation
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
