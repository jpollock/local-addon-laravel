/**
 * Local Laravel - Main Process Entry Point
 *
 * This is the main entry point for the addon's main process.
 * It registers hooks, IPC handlers, and the Laravel Lightning Service.
 */

import * as LocalMain from '@getflywheel/local/main';
import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as os from 'os';

// Import modules
import {
  IPC_CHANNELS,
  SERVICE_NAME,
  SERVICE_VERSION,
  SITE_TYPE_KEY,
  SITE_TYPE_VALUE,
  LARAVEL_VERSIONS,
} from '../common/constants';
import { registerLaravelService, laravelServiceInstances } from './laravel-service';
import { composerManager } from './composer-manager';
import { laravelInstaller } from './laravel-installer';
import type {
  CreateLaravelSiteRequest,
  ArtisanRequest,
  LaravelVersion,
} from '../common/types';

/**
 * Map of pending Laravel installations.
 * Key: site name (before site ID is assigned)
 * Value: Installation configuration
 */
const pendingInstallations = new Map<string, CreateLaravelSiteRequest>();

/**
 * Map of creation progress by site ID.
 * Used for polling progress from renderer.
 */
const creationProgress = new Map<string, {
  progress: number;
  stage: string;
  message: string;
  error?: string;
}>();

/**
 * Main addon entry function.
 *
 * Called by Local when the addon is loaded.
 * The context parameter is REQUIRED - without it, this function won't be called.
 */
export default function (context: LocalMain.AddonMainContext): void {
  const { hooks } = context;
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  localLogger.info('[LocalLaravel] Addon loading...');

  // Register Laravel Lightning Service
  registerLaravelService();

  // Register IPC handlers
  registerIpcHandlers(context);

  // Register lifecycle hooks
  registerLifecycleHooks(context);

  localLogger.info('[LocalLaravel] Addon loaded successfully');
}

/**
 * Register IPC handlers for renderer communication.
 */
function registerIpcHandlers(context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger, siteData, siteProcessManager, siteDatabase } = services;

  // Handler: Create Laravel site
  ipcMain.handle(IPC_CHANNELS.CREATE_SITE, async (_event, data: CreateLaravelSiteRequest) => {
    localLogger.info('[LocalLaravel] CREATE_SITE request received');
    localLogger.info('[LocalLaravel] Site name:', data.siteName);

    try {
      // Validate request
      if (!data.siteName || !data.siteDomain) {
        throw new Error('Site name and domain are required');
      }

      // Validate Laravel version
      const laravelVersion = data.laravelVersion || '11';
      const versionConfig = LARAVEL_VERSIONS[laravelVersion as LaravelVersion];
      if (!versionConfig) {
        throw new Error(`Invalid Laravel version: ${laravelVersion}`);
      }

      // Validate PHP version requirement
      const phpVersion = data.phpVersion || '8.3';
      const minPhp = parseFloat(versionConfig.minPhp);
      const selectedPhp = parseFloat(phpVersion);
      if (selectedPhp < minPhp) {
        throw new Error(
          `Laravel ${laravelVersion} requires PHP ${versionConfig.minPhp}+, but ${phpVersion} was selected`
        );
      }

      // Store pending installation config
      pendingInstallations.set(data.siteName, data);

      // Create site using Local's addSite service
      const addSiteService = services.addSite;

      const newSiteInfo = {
        siteName: data.siteName,
        siteDomain: data.siteDomain,
        sitePath: data.sitePath || path.join(os.homedir(), 'Local Sites', data.siteName),
        phpVersion: phpVersion,
        database: data.mysqlVersion || 'mysql-8.0.16',
        webServer: 'nginx',
        skipWPInstall: true, // Don't install WordPress!
        customOptions: {
          [SITE_TYPE_KEY]: SITE_TYPE_VALUE,
          laravelVersion: laravelVersion,
          starterKit: data.starterKit || 'none',
          breezeStack: data.breezeStack,
          createdAt: new Date().toISOString(),
        },
      };

      localLogger.info('[LocalLaravel] Creating site with options:', JSON.stringify(newSiteInfo, null, 2));

      // Create the site
      localLogger.info('[LocalLaravel] Calling addSiteService.addSite...');
      const site = await addSiteService.addSite({
        newSiteInfo,
        wpCredentials: {}, // Not used for Laravel
        goToSite: false,
        installWP: false,
      });

      localLogger.info(`[LocalLaravel] Site created: ${site.id}`);
      localLogger.info(`[LocalLaravel] Site customOptions after creation: ${JSON.stringify(site.customOptions)}`);

      // Initialize progress tracking
      creationProgress.set(site.id, {
        progress: 15,
        stage: 'PROVISIONING',
        message: 'Site infrastructure provisioned...',
      });

      // Update pending installation with site ID
      const installConfig = pendingInstallations.get(data.siteName);
      if (installConfig) {
        pendingInstallations.delete(data.siteName);
        pendingInstallations.set(site.id, installConfig);
      }

      return {
        success: true,
        siteId: site.id,
      };
    } catch (error: any) {
      localLogger.error('[LocalLaravel] CREATE_SITE failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to create site',
      };
    }
  });

  // Handler: Check if site is Laravel
  ipcMain.handle(IPC_CHANNELS.IS_LARAVEL_SITE, async (_event, siteId: string) => {
    try {
      const site = siteData.getSite(siteId);
      return {
        success: true,
        isLaravel: site?.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Handler: Get Laravel site info
  ipcMain.handle(IPC_CHANNELS.GET_LARAVEL_INFO, async (_event, siteId: string) => {
    try {
      const site = siteData.getSite(siteId);
      if (!site || site.customOptions?.[SITE_TYPE_KEY] !== SITE_TYPE_VALUE) {
        return { success: false, error: 'Not a Laravel site' };
      }

      return {
        success: true,
        data: {
          laravelVersion: site.customOptions.laravelVersion,
          starterKit: site.customOptions.starterKit,
          createdAt: site.customOptions.createdAt,
          phpVersion: (Object.values(site.services).find((s: any) => s.role === 'php') as any)?.version,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Handler: Run artisan command
  ipcMain.handle(IPC_CHANNELS.RUN_ARTISAN, async (_event, data: ArtisanRequest) => {
    const startTime = Date.now();

    try {
      const site = siteData.getSite(data.siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      // Check site is running
      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        throw new Error('Site must be running to execute artisan commands');
      }

      const sitePath = site.path.startsWith('~')
        ? site.path.replace('~', os.homedir())
        : site.path;
      const appPath = path.join(sitePath, 'app');

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const command = `php artisan ${data.command.join(' ')}`;

      localLogger.info('[LocalLaravel] Running artisan:', command);

      const { stdout, stderr } = await execAsync(command, {
        cwd: appPath,
        timeout: 120000, // 2 minute timeout
        env: {
          ...process.env,
          PATH: process.env.PATH,
        },
      });

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: {
          success: true,
          output: stdout + (stderr ? `\n${stderr}` : ''),
          exitCode: 0,
          duration,
        },
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        data: {
          success: false,
          output: error.stdout || error.message,
          exitCode: error.code || 1,
          duration,
        },
      };
    }
  });

  // Handler: Get Composer version
  ipcMain.handle(IPC_CHANNELS.GET_COMPOSER_VERSION, async () => {
    try {
      const version = await composerManager.getVersion();
      return { success: true, version };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Handler: Get creation status
  ipcMain.handle(IPC_CHANNELS.GET_CREATION_STATUS, async (_event, data: { siteId: string }) => {
    try {
      const progress = creationProgress.get(data.siteId);
      if (!progress) {
        return { progress: 0, stage: 'initializing', message: 'Initializing...' };
      }
      return progress;
    } catch (error: any) {
      return { progress: 0, stage: 'error', message: error.message, error: error.message };
    }
  });

  localLogger.info('[LocalLaravel] IPC handlers registered');
}

/**
 * Register lifecycle hooks for site events.
 */
function registerLifecycleHooks(context: LocalMain.AddonMainContext): void {
  const { hooks } = context;
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger, siteData } = services;

  // Hook: Inject Laravel service into site configuration
  hooks.addFilter('defaultSiteServices', (siteServices: any, siteSettings: any) => {
    localLogger.info('[LocalLaravel] defaultSiteServices filter called');
    localLogger.info(`[LocalLaravel] siteSettings.customOptions: ${JSON.stringify(siteSettings?.customOptions)}`);

    // Check if this is a Laravel site creation
    if (siteSettings.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE) {
      localLogger.info('[LocalLaravel] Injecting Laravel service into site config');

      return {
        ...siteServices,
        [SERVICE_NAME]: {
          name: SERVICE_NAME,
          version: SERVICE_VERSION,
          role: 'other',
        },
      };
    }

    return siteServices;
  });

  // Hook: Modify site before creation (mark as Laravel)
  hooks.addFilter('modifyAddSiteObjectBeforeCreation', (site: any, newSiteInfo: any) => {
    localLogger.info('[LocalLaravel] modifyAddSiteObjectBeforeCreation filter called');
    localLogger.info(`[LocalLaravel] newSiteInfo.customOptions: ${JSON.stringify(newSiteInfo?.customOptions)}`);
    localLogger.info(`[LocalLaravel] site.customOptions before: ${JSON.stringify(site?.customOptions)}`);

    if (newSiteInfo.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE) {
      localLogger.info(`[LocalLaravel] Marking site as Laravel: ${site.name}`);

      const updatedSite = {
        ...site,
        customOptions: {
          ...site.customOptions,
          ...newSiteInfo.customOptions,
        },
      };

      localLogger.info(`[LocalLaravel] site.customOptions after: ${JSON.stringify(updatedSite.customOptions)}`);
      return updatedSite;
    }
    return site;
  });

  // Hook: Site added - install Laravel
  hooks.addAction('siteAdded', async (site: any) => {
    localLogger.info('[LocalLaravel] siteAdded hook triggered');
    localLogger.info(`[LocalLaravel] site.name: ${site?.name}`);
    localLogger.info(`[LocalLaravel] site.id: ${site?.id}`);
    localLogger.info(`[LocalLaravel] site.customOptions: ${JSON.stringify(site?.customOptions)}`);

    if (site.customOptions?.[SITE_TYPE_KEY] !== SITE_TYPE_VALUE) {
      localLogger.info('[LocalLaravel] Not a Laravel site, skipping installation');
      return;
    }

    localLogger.info(`[LocalLaravel] Site added, installing Laravel: ${site.name}`);

    // Get installation config
    const installConfig = pendingInstallations.get(site.id) ||
      pendingInstallations.get(site.name);

    if (!installConfig) {
      localLogger.warn('[LocalLaravel] No installation config found, using defaults');
    }

    const options = {
      laravelVersion: (installConfig?.laravelVersion || site.customOptions.laravelVersion || '11') as LaravelVersion,
      starterKit: installConfig?.starterKit || site.customOptions.starterKit || 'none',
      breezeStack: installConfig?.breezeStack || site.customOptions.breezeStack,
      onProgress: (progress: any) => {
        // Broadcast progress to all windows
        broadcastProgress(site.id, progress);
      },
    };

    try {
      const result = await laravelInstaller.install(site, options);

      if (result.success) {
        localLogger.info(`[LocalLaravel] Laravel installed successfully for ${site.name}`);
        broadcastProgress(site.id, { progress: 100, stage: 'complete', message: 'Installation complete!' });
      } else {
        localLogger.error(`[LocalLaravel] Laravel installation failed: ${result.error}`);
        broadcastProgress(site.id, { progress: -1, stage: 'error', message: result.error || 'Installation failed' });
      }
    } catch (error: any) {
      localLogger.error('[LocalLaravel] Installation error:', error);
      broadcastProgress(site.id, { progress: -1, stage: 'error', message: error.message });
    }

    // Clean up pending installation
    pendingInstallations.delete(site.id);
    pendingInstallations.delete(site.name);
  });

  // Hook: Site started
  hooks.addAction('siteStarted', async (site: any) => {
    if (site.customOptions?.[SITE_TYPE_KEY] !== SITE_TYPE_VALUE) {
      return;
    }

    localLogger.info(`[LocalLaravel] Laravel site started: ${site.name}`);
  });

  // Hook: Site stopping
  hooks.addAction('siteStopping', async (site: any) => {
    if (site.customOptions?.[SITE_TYPE_KEY] !== SITE_TYPE_VALUE) {
      return;
    }

    localLogger.info(`[LocalLaravel] Laravel site stopping: ${site.name}`);
  });

  localLogger.info('[LocalLaravel] Lifecycle hooks registered');
}

/**
 * Broadcast progress to all renderer windows and store for polling.
 */
function broadcastProgress(siteId: string, progress: any): void {
  // Store progress for polling
  creationProgress.set(siteId, {
    progress: progress.progress,
    stage: progress.stage,
    message: progress.message,
    error: progress.error,
  });

  // Broadcast to all windows
  const windows = BrowserWindow.getAllWindows();

  for (const window of windows) {
    if (!window.isDestroyed()) {
      window.webContents.send('local-laravel:progress', {
        siteId,
        ...progress,
      });
    }
  }

  // Clean up completed/errored progress after a delay
  if (progress.progress >= 100 || progress.error) {
    setTimeout(() => {
      creationProgress.delete(siteId);
    }, 30000); // Keep for 30 seconds after completion
  }
}
