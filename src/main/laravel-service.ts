/**
 * Laravel Lightning Service
 *
 * This Lightning Service provides Laravel-optimized nginx configuration
 * for sites created through the Local Laravel addon.
 *
 * Key responsibilities:
 * - Provide Laravel-specific nginx configuration templates
 * - Configure proper web root (Laravel's public/ directory)
 * - Set up PHP-FPM integration with Laravel-friendly settings
 * - Handle Laravel's front controller pattern (index.php routing)
 *
 * Design decisions:
 * - Extends LocalMain.LightningService for proper Local integration
 * - Does NOT start a separate process (nginx is managed by Local)
 * - Provides configuration templates that Local compiles at runtime
 * - Uses Object.defineProperty for requiredPorts (TypeScript workaround)
 */

import * as LocalMain from '@getflywheel/local/main';
import * as path from 'path';
import * as os from 'os';

import { SERVICE_NAME, SERVICE_VERSION } from '../common/constants';

/**
 * Map of LaravelService instances by site ID.
 * Used for accessing instances from lifecycle hooks.
 */
export const laravelServiceInstances = new Map<string, LaravelService>();

/**
 * LaravelService provides Laravel-optimized server configuration.
 *
 * This service:
 * 1. Registers itself with Local's Lightning Services system
 * 2. Provides nginx configuration templates from templates/nginx/
 * 3. Sets up proper routing for Laravel's front controller
 * 4. Configures PHP-FPM settings appropriate for Laravel
 *
 * Note: This service doesn't start a separate process. It provides
 * configuration that Local's nginx service uses.
 */
export class LaravelService extends LocalMain.LightningService {
  /**
   * Service identifier used by Local.
   */
  public readonly serviceName = SERVICE_NAME;

  /**
   * Service version.
   */
  public readonly binVersion = SERVICE_VERSION;

  /**
   * Logger instance.
   */
  private logger: any;

  /**
   * Construct a new LaravelService instance.
   *
   * @param context - Local addon context
   * @param serviceManager - Local's service manager
   */
  constructor(context: any, serviceManager: any) {
    super(context, serviceManager);

    // Get logger
    const services = LocalMain.getServiceContainer().cradle as any;
    this.logger = services.localLogger;

    this.logger.info('[LaravelService] Constructor called');
    this.logger.info(`[LaravelService] Site: ${this._site?.name || 'unknown'}`);

    // Track this instance for hook access
    // Delay to allow site binding to complete
    setTimeout(() => {
      if (this._site?.id) {
        laravelServiceInstances.set(this._site.id, this);
        this.logger.info(
          `[LaravelService] Registered instance for site ${this._site.name} (${this._site.id})`
        );
      }
    }, 100);

    // Define requiredPorts using Object.defineProperty
    // TypeScript workaround - regular property definitions don't work
    // The service doesn't need its own port, but Local requires this
    Object.defineProperty(this, 'requiredPorts', {
      get: () => ({}), // No additional ports needed
      configurable: true,
    });

    // Define configTemplatePath using Object.defineProperty
    // Path to nginx configuration templates
    Object.defineProperty(this, 'configTemplatePath', {
      get: () => path.join(__dirname, '..', '..', 'templates', 'nginx'),
      configurable: true,
    });

    // Define configVariables using Object.defineProperty
    // Configuration variables passed to Handlebars templates
    Object.defineProperty(this, 'configVariables', {
      get: () => {
        if (!this._site) {
          return {};
        }

        const sitePath = this.resolveSitePath();

        return {
          // Absolute path to site directory
          absoluteSitePath: sitePath,

          // Laravel's public directory (web root)
          webRoot: path.join(sitePath, 'app', 'public'),

          // PHP-FPM socket path
          phpSocket: this.getPhpSocketPath(),

          // Site port (from Local's port allocation)
          port: this.getSitePort(),

          // Laravel environment
          laravelEnv: 'local',

          // Enable debug mode
          laravelDebug: 'true',
        };
      },
      configurable: true,
    });
  }

  /**
   * Called before the service starts.
   * Can be used for setup tasks.
   */
  public async preprovision(): Promise<void> {
    this.logger.info('[LaravelService] Preprovision called');

    if (!this._site) {
      this.logger.warn('[LaravelService] No site available for preprovision');
      return;
    }

    // Check if this is a Laravel site
    if (this._site.customOptions?.siteType !== 'laravel') {
      this.logger.info('[LaravelService] Not a Laravel site, skipping preprovision');
      return;
    }

    this.logger.info(`[LaravelService] Preprovisioning for ${this._site.name}`);

    // Verify Laravel installation exists
    const laravelPath = path.join(this.resolveSitePath(), 'app');
    const artisanPath = path.join(laravelPath, 'artisan');

    const fs = require('fs-extra');
    if (await fs.pathExists(artisanPath)) {
      this.logger.info('[LaravelService] Laravel installation verified');
    } else {
      this.logger.warn('[LaravelService] Laravel artisan not found - installation may be pending');
    }
  }

  /**
   * Start the service.
   *
   * For LaravelService, we don't start a separate process.
   * The nginx configuration is provided via configTemplatePath.
   *
   * Return an empty array to indicate no processes to start.
   */
  public start(): any[] {
    this.logger.info('[LaravelService] Start called');

    if (!this._site) {
      this.logger.warn('[LaravelService] No site available');
      return [];
    }

    // Verify this is a Laravel site
    if (this._site.customOptions?.siteType !== 'laravel') {
      this.logger.info('[LaravelService] Not a Laravel site');
      return [];
    }

    this.logger.info(`[LaravelService] Configuring for ${this._site.name}`);

    // No processes to start - nginx handles serving
    // The configuration templates provide Laravel-optimized settings
    return [];
  }

  /**
   * Stop the service.
   */
  public async stop(): Promise<void> {
    this.logger.info('[LaravelService] Stop called');

    if (this._site?.id) {
      laravelServiceInstances.delete(this._site.id);
      this.logger.info(`[LaravelService] Removed instance for site ${this._site.id}`);
    }
  }

  /**
   * Get service information for display in UI.
   */
  public getServiceInfo(): Record<string, any> {
    return {
      serviceName: this.serviceName,
      version: this.binVersion,
      siteType: 'laravel',
      configured: this._site?.customOptions?.siteType === 'laravel',
      laravelVersion: this._site?.customOptions?.laravelVersion || 'unknown',
    };
  }

  /**
   * Resolve site path, handling ~ prefix.
   */
  private resolveSitePath(): string {
    if (!this._site) {
      return '';
    }

    const sitePath = this._site.path;
    if (sitePath.startsWith('~')) {
      return sitePath.replace('~', os.homedir());
    }
    return sitePath;
  }

  /**
   * Get the PHP-FPM socket path for this site.
   */
  private getPhpSocketPath(): string {
    if (!this._site) {
      return '';
    }

    // Local stores PHP-FPM sockets in the run data directory
    const runDataPath = this._site.paths?.runData;
    if (runDataPath) {
      const resolvedPath = runDataPath.startsWith('~')
        ? runDataPath.replace('~', os.homedir())
        : runDataPath;
      return path.join(resolvedPath, 'php', 'php-fpm.sock');
    }

    // Fallback to standard Local structure
    const localConfigPath = path.join(os.homedir(), '.config', 'Local');
    return path.join(localConfigPath, 'run', this._site.id, 'php', 'php-fpm.sock');
  }

  /**
   * Get the allocated port for this site.
   */
  private getSitePort(): number {
    if (!this._site?.services?.nginx?.ports?.HTTP?.[0]) {
      return 80; // Fallback
    }
    return this._site.services.nginx.ports.HTTP[0];
  }
}

/**
 * Register the Laravel service with Local.
 *
 * This should be called from the main addon entry point.
 */
export function registerLaravelService(): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  localLogger.info('[LaravelService] Registering service...');

  try {
    LocalMain.registerLightningService(LaravelService, SERVICE_NAME, SERVICE_VERSION);
    localLogger.info('[LaravelService] Service registered successfully');
  } catch (error) {
    localLogger.error('[LaravelService] Failed to register service:', error);
  }
}
