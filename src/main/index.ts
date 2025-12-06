/**
 * Local Laravel - Main Process Entry Point
 *
 * This is the main entry point for the addon's main process.
 * It registers hooks, IPC handlers, and the Laravel Lightning Service.
 */

import * as LocalMain from '@getflywheel/local/main';

// Import constants
import { SERVICE_NAME, SERVICE_VERSION } from '../common/constants';

// Service instances map for hook access
export const laravelServiceInstances = new Map<string, any>();

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

  // Register IPC handlers
  registerIpcHandlers(context);

  // Register lifecycle hooks
  registerLifecycleHooks(context);

  // Register Laravel Lightning Service
  // TODO: Implement LaravelService
  // LocalMain.registerLightningService(LaravelService, SERVICE_NAME, SERVICE_VERSION);

  localLogger.info('[LocalLaravel] Addon loaded successfully');
}

/**
 * Register IPC handlers for renderer communication.
 */
function registerIpcHandlers(context: LocalMain.AddonMainContext): void {
  const { ipcMain } = require('electron');
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  // TODO: Implement IPC handlers
  // - CREATE_SITE
  // - GET_LARAVEL_INFO
  // - IS_LARAVEL_SITE
  // - RUN_ARTISAN
  // - RUN_COMPOSER

  localLogger.info('[LocalLaravel] IPC handlers registered');
}

/**
 * Register lifecycle hooks for site events.
 */
function registerLifecycleHooks(context: LocalMain.AddonMainContext): void {
  const { hooks } = context;
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  // Hook: Modify site before creation (mark as Laravel)
  hooks.addFilter(
    'modifyAddSiteObjectBeforeCreation',
    (site: any, newSiteInfo: any) => {
      if (newSiteInfo.customOptions?.siteType === 'laravel') {
        localLogger.info(`[LocalLaravel] Marking site as Laravel: ${site.name}`);
        return {
          ...site,
          customOptions: {
            ...site.customOptions,
            siteType: 'laravel',
            laravelVersion: newSiteInfo.customOptions.laravelVersion,
            starterKit: newSiteInfo.customOptions.starterKit,
            createdAt: new Date().toISOString(),
          },
        };
      }
      return site;
    }
  );

  // Hook: Site started - check if Laravel and configure
  hooks.addAction('siteStarted', async (site: any) => {
    if (site.customOptions?.siteType !== 'laravel') {
      return;
    }

    localLogger.info(`[LocalLaravel] Laravel site started: ${site.name}`);

    // TODO: Verify Laravel installation
    // TODO: Check .env configuration
    // TODO: Start any background services (queue worker, etc.)
  });

  // Hook: Site stopping
  hooks.addAction('siteStopping', async (site: any) => {
    if (site.customOptions?.siteType !== 'laravel') {
      return;
    }

    localLogger.info(`[LocalLaravel] Laravel site stopping: ${site.name}`);

    // TODO: Stop any background services
  });

  localLogger.info('[LocalLaravel] Lifecycle hooks registered');
}
