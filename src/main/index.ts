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
import * as fs from 'fs-extra';

// Import modules
import {
  IPC_CHANNELS,
  SERVICE_NAME,
  SERVICE_VERSION,
  SITE_TYPE_KEY,
  SITE_TYPE_VALUE,
  LARAVEL_VERSIONS,
} from '../common/constants';
import { registerLaravelService } from './laravel-service';
import { composerManager } from './composer-manager';
import { laravelInstaller } from './laravel-installer';
import type {
  CreateLaravelSiteRequest,
  LaravelVersion,
  StarterKit,
  EnvVariable,
  FailedJob,
} from '../common/types';
import {
  CreateSiteRequestSchema,
  ArtisanRequestSchema,
  QueueJobRequestSchema,
  GetLogsRequestSchema,
  GetEnvRequestSchema,
  UpdateEnvRequestSchema,
  SiteIdRequestSchema,
  GetCreationStatusRequestSchema,
  safeValidateInput,
} from '../common/validation';
import {
  resolveSitePath,
  getSafeAppPath,
  getSafePathInApp,
  isPathWithinSite,
  sanitizeForLogging,
  buildArtisanArgs,
  buildVSCodeCommand,
  buildTerminalCommand,
} from '../common/security';

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
function registerIpcHandlers(_context: LocalMain.AddonMainContext): void {
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger, siteData, siteProcessManager } = services;

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

      localLogger.info('[LocalLaravel] Creating site with options:', JSON.stringify(sanitizeForLogging(newSiteInfo), null, 2));

      // Create the site
      localLogger.info('[LocalLaravel] Calling addSiteService.addSite...');
      const site = await addSiteService.addSite({
        newSiteInfo,
        wpCredentials: {}, // Not used for Laravel
        goToSite: false,
        installWP: false,
      });

      localLogger.info(`[LocalLaravel] Site created: ${site.id}`);
      localLogger.info(`[LocalLaravel] Site customOptions after creation: ${JSON.stringify(sanitizeForLogging(site.customOptions))}`);

      // Manually set customOptions on the site since filters don't seem to work
      const customOptions = {
        [SITE_TYPE_KEY]: SITE_TYPE_VALUE,
        laravelVersion: laravelVersion,
        starterKit: data.starterKit || 'none',
        breezeStack: data.breezeStack,
        createdAt: new Date().toISOString(),
      };

      localLogger.info(`[LocalLaravel] Updating site with customOptions: ${JSON.stringify(sanitizeForLogging(customOptions))}`);

      // Update the site with customOptions
      site.customOptions = customOptions;
      await siteData.updateSite(site.id, { customOptions });

      localLogger.info(`[LocalLaravel] Site customOptions after update: ${JSON.stringify(sanitizeForLogging(site.customOptions))}`);

      // Initialize progress tracking
      creationProgress.set(site.id, {
        progress: 15,
        stage: 'PROVISIONING',
        message: 'Site infrastructure provisioned...',
      });

      // Store installation config for the siteAdded hook won't work, so install directly
      localLogger.info(`[LocalLaravel] Starting Laravel installation directly...`);

      // Start Laravel installation
      const installOptions = {
        laravelVersion: laravelVersion as LaravelVersion,
        starterKit: (data.starterKit || 'none') as StarterKit,
        breezeStack: data.breezeStack,
        onProgress: (progress: any) => {
          broadcastProgress(site.id, progress);
        },
      };

      // Run installation asynchronously (don't await - let it run in background)
      laravelInstaller.install(site, installOptions).then((result) => {
        if (result.success) {
          localLogger.info(`[LocalLaravel] Laravel installed successfully for ${site.name}`);
          broadcastProgress(site.id, { progress: 100, stage: 'COMPLETE', message: 'Installation complete!' });
        } else {
          localLogger.error(`[LocalLaravel] Laravel installation failed: ${result.error}`);
          broadcastProgress(site.id, { progress: -1, stage: 'error', message: result.error || 'Installation failed', error: result.error });
        }
      }).catch((error: any) => {
        localLogger.error('[LocalLaravel] Installation error:', error);
        broadcastProgress(site.id, { progress: -1, stage: 'error', message: error.message, error: error.message });
      });

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

  // Handler: Get all Laravel site IDs (for batch checking, e.g., sidebar badges)
  ipcMain.handle(IPC_CHANNELS.GET_LARAVEL_SITES, async () => {
    try {
      const sites = siteData.getSites();
      const laravelSiteIds = Object.keys(sites).filter(
        (siteId) => sites[siteId]?.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE
      );
      return { success: true, siteIds: laravelSiteIds };
    } catch (error: any) {
      return { success: false, error: error.message, siteIds: [] };
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

  // Handler: Run artisan command (SECURED)
  ipcMain.handle(IPC_CHANNELS.RUN_ARTISAN, async (_event, data: unknown) => {
    const startTime = Date.now();

    // Validate input with Zod schema
    const validation = safeValidateInput(ArtisanRequestSchema, data);
    if (!validation.success) {
      return {
        success: false,
        data: {
          success: false,
          output: `Validation error: ${validation.error}`,
          exitCode: 1,
          duration: Date.now() - startTime,
        },
      };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        throw new Error('Site not found');
      }

      // Check site is running
      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        throw new Error('Site must be running to execute artisan commands');
      }

      // Use secure path resolution
      const appPath = getSafeAppPath(site.path);

      // Use spawn with array arguments (no shell injection possible)
      const { spawn } = require('child_process');

      // Build safe artisan arguments
      const args = buildArtisanArgs(validatedData.command);

      localLogger.info('[LocalLaravel] Running artisan (secure):', args.join(' '));

      return new Promise((resolve) => {
        const child = spawn('php', args, {
          cwd: appPath,
          shell: false, // CRITICAL: Don't use shell to prevent injection
          env: {
            ...process.env,
            PATH: process.env.PATH,
          },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        // Set timeout
        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          const duration = Date.now() - startTime;
          resolve({
            success: false,
            data: {
              success: false,
              output: 'Command timed out after 2 minutes',
              exitCode: 124,
              duration,
            },
          });
        }, 120000);

        child.on('close', (code: number) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;

          resolve({
            success: code === 0,
            data: {
              success: code === 0,
              output: stdout + (stderr ? `\n${stderr}` : ''),
              exitCode: code || 0,
              duration,
            },
          });
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;

          resolve({
            success: false,
            data: {
              success: false,
              output: error.message,
              exitCode: 1,
              duration,
            },
          });
        });
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        data: {
          success: false,
          output: error.message,
          exitCode: 1,
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

  // Handler: Get site status (running/stopped)
  ipcMain.handle(IPC_CHANNELS.GET_SITE_STATUS, async (_event, data: { siteId: string }) => {
    try {
      const site = siteData.getSite(data.siteId);
      if (!site) {
        return { success: false, status: 'unknown', error: 'Site not found' };
      }

      const status = siteProcessManager.getSiteStatus(site);
      return { success: true, status: status || 'stopped' };
    } catch (error: any) {
      return { success: false, status: 'unknown', error: error.message };
    }
  });

  // Handler: Get Laravel logs (SECURED)
  ipcMain.handle(IPC_CHANNELS.GET_LARAVEL_LOGS, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(GetLogsRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution with traversal protection
      const logPath = getSafePathInApp(site.path, 'storage', 'logs', 'laravel.log');

      // Check if log file exists
      if (!await fs.pathExists(logPath)) {
        return { success: true, logs: '(No log file found. Run your application to generate logs.)' };
      }

      // Read the log file
      const content = await fs.readFile(logPath, 'utf-8');

      // Get last N lines (default 100)
      const lines = content.split('\n');
      const numLines = validatedData.lines || 100;
      const lastLines = lines.slice(-numLines).join('\n');

      return { success: true, logs: lastLines };
    } catch (error: any) {
      localLogger.error('[LocalLaravel] GET_LARAVEL_LOGS error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Get .env file (SECURED)
  ipcMain.handle(IPC_CHANNELS.GET_ENV, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(GetEnvRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution
      const envPath = getSafePathInApp(site.path, '.env');

      // Check if .env file exists
      if (!await fs.pathExists(envPath)) {
        return { success: false, error: '.env file not found' };
      }

      // Read the .env file
      const content = await fs.readFile(envPath, 'utf-8');

      // Parse into key-value pairs
      const variables: EnvVariable[] = content.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#') && line.includes('='))
        .map(line => {
          const eqIndex = line.indexOf('=');
          const key = line.substring(0, eqIndex).trim();
          let value = line.substring(eqIndex + 1).trim();

          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          // Mark sensitive keys
          const sensitiveKeys = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'MAIL_PASSWORD', 'AWS_SECRET'];
          const sensitive = sensitiveKeys.some(sk => key.toUpperCase().includes(sk));

          return { key, value, sensitive };
        });

      return { success: true, variables, raw: content };
    } catch (error: any) {
      localLogger.error('[LocalLaravel] GET_ENV error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Update .env file (SECURED)
  ipcMain.handle(IPC_CHANNELS.UPDATE_ENV, async (_event, data: unknown) => {
    // Validate input including .env content format
    const validation = safeValidateInput(UpdateEnvRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution
      const envPath = getSafePathInApp(site.path, '.env');
      const backupPath = getSafePathInApp(site.path, '.env.backup');

      // Validate paths are within the site directory
      if (!isPathWithinSite(site.path, envPath) || !isPathWithinSite(site.path, backupPath)) {
        return { success: false, error: 'Invalid path: security violation' };
      }

      // Backup existing .env file
      if (await fs.pathExists(envPath)) {
        await fs.copy(envPath, backupPath);
      }

      // Write new content (already validated by schema)
      await fs.writeFile(envPath, validatedData.content, 'utf-8');

      localLogger.info(`[LocalLaravel] Updated .env file for site ${site.name}`);
      return { success: true };
    } catch (error: any) {
      localLogger.error('[LocalLaravel] UPDATE_ENV error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Get failed jobs (SECURED)
  ipcMain.handle(IPC_CHANNELS.GET_FAILED_JOBS, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(SiteIdRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Check site is running
      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        return { success: false, error: 'Site must be running to view queue' };
      }

      // Use secure path resolution
      const appPath = getSafeAppPath(site.path);

      // Use spawn instead of exec (no shell injection possible)
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn('php', ['artisan', 'queue:failed'], {
          cwd: appPath,
          shell: false,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ success: false, error: 'Command timed out' });
        }, 30000);

        child.on('close', (code: number) => {
          clearTimeout(timeout);

          if (stdout.includes('No failed jobs') || stderr.includes('No failed jobs')) {
            resolve({ success: true, jobs: [] });
            return;
          }

          if (code === 0) {
            const jobs = parseQueueFailedOutput(stdout);
            resolve({ success: true, jobs });
          } else {
            resolve({ success: false, error: stderr || 'Command failed' });
          }
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] GET_FAILED_JOBS error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Retry a failed job (SECURED)
  ipcMain.handle(IPC_CHANNELS.RETRY_JOB, async (_event, data: unknown) => {
    // Validate input - jobId must be numeric or 'all'
    const validation = safeValidateInput(QueueJobRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        return { success: false, error: 'Site must be running' };
      }

      const appPath = getSafeAppPath(site.path);

      // Use spawn with validated jobId (no injection possible)
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn('php', ['artisan', 'queue:retry', validatedData.jobId], {
          cwd: appPath,
          shell: false,
        });

        let stderr = '';

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ success: false, error: 'Command timed out' });
        }, 30000);

        child.on('close', (code: number) => {
          clearTimeout(timeout);

          if (code === 0) {
            localLogger.info(`[LocalLaravel] Retried job(s): ${validatedData.jobId}`);
            resolve({ success: true, message: `Job ${validatedData.jobId} pushed back to queue` });
          } else {
            resolve({ success: false, error: stderr || 'Command failed' });
          }
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] RETRY_JOB error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Forget (delete) a failed job (SECURED)
  ipcMain.handle(IPC_CHANNELS.FORGET_JOB, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(QueueJobRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        return { success: false, error: 'Site must be running' };
      }

      const appPath = getSafeAppPath(site.path);

      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn('php', ['artisan', 'queue:forget', validatedData.jobId], {
          cwd: appPath,
          shell: false,
        });

        let stderr = '';

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ success: false, error: 'Command timed out' });
        }, 30000);

        child.on('close', (code: number) => {
          clearTimeout(timeout);

          if (code === 0) {
            localLogger.info(`[LocalLaravel] Deleted failed job: ${validatedData.jobId}`);
            resolve({ success: true, message: 'Job deleted' });
          } else {
            resolve({ success: false, error: stderr || 'Command failed' });
          }
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] FORGET_JOB error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Flush all failed jobs (SECURED)
  ipcMain.handle(IPC_CHANNELS.FLUSH_JOBS, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(SiteIdRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      const status = siteProcessManager.getSiteStatus(site);
      if (status !== 'running') {
        return { success: false, error: 'Site must be running' };
      }

      const appPath = getSafeAppPath(site.path);

      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn('php', ['artisan', 'queue:flush'], {
          cwd: appPath,
          shell: false,
        });

        let stderr = '';

        child.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          child.kill('SIGTERM');
          resolve({ success: false, error: 'Command timed out' });
        }, 30000);

        child.on('close', (code: number) => {
          clearTimeout(timeout);

          if (code === 0) {
            localLogger.info(`[LocalLaravel] Flushed all failed jobs for ${site.name}`);
            resolve({ success: true, message: 'All failed jobs deleted' });
          } else {
            resolve({ success: false, error: stderr || 'Command failed' });
          }
        });

        child.on('error', (error: Error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] FLUSH_JOBS error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Handler: Open site in VS Code (SECURED - opens /app instead of /app/public)
  ipcMain.handle(IPC_CHANNELS.OPEN_IN_VSCODE, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(SiteIdRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution
      const projectPath = getSafeAppPath(site.path);

      // Build secure VS Code command
      const vsCommand = buildVSCodeCommand(projectPath);
      if (!vsCommand.safe) {
        return { success: false, error: 'Invalid project path' };
      }

      // Use spawn with shell: false (no injection possible)
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn(vsCommand.command, vsCommand.args, {
          shell: false, // CRITICAL: Don't use shell
          stdio: 'ignore',
          detached: true,
        });

        child.unref(); // Don't wait for VS Code to exit

        child.on('error', (error: Error) => {
          localLogger.error(`[LocalLaravel] Failed to open VS Code: ${error.message}`);
          resolve({ success: false, error: error.message });
        });

        // Give it a moment to start, then return success
        setTimeout(() => {
          localLogger.info(`[LocalLaravel] Opened VS Code for ${site.name} at ${projectPath}`);
          resolve({ success: true });
        }, 100);
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] OPEN_IN_VSCODE error:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler: Open site folder in Finder/Explorer (SECURED - opens /app instead of site root)
  ipcMain.handle(IPC_CHANNELS.OPEN_SITE_FOLDER, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(SiteIdRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution with traversal protection
      const projectPath = getSafeAppPath(site.path);

      // Verify path is within site directory
      if (!isPathWithinSite(site.path, projectPath)) {
        return { success: false, error: 'Invalid path: security violation' };
      }

      // Use Electron's shell.openPath (safer than exec)
      const { shell } = require('electron');
      const result = await shell.openPath(projectPath);

      // shell.openPath returns empty string on success, error message otherwise
      if (result) {
        localLogger.error(`[LocalLaravel] Failed to open folder: ${result}`);
        return { success: false, error: result };
      }

      localLogger.info(`[LocalLaravel] Opened folder for ${site.name} at ${projectPath}`);
      return { success: true };
    } catch (error: any) {
      localLogger.error('[LocalLaravel] OPEN_SITE_FOLDER error:', error);
      return { success: false, error: error.message };
    }
  });

  // Handler: Open site shell/terminal (SECURED - opens in /app instead of app/public)
  ipcMain.handle(IPC_CHANNELS.OPEN_SITE_SHELL, async (_event, data: unknown) => {
    // Validate input
    const validation = safeValidateInput(SiteIdRequestSchema, data);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const validatedData = validation.data!;

    try {
      const site = siteData.getSite(validatedData.siteId);
      if (!site) {
        return { success: false, error: 'Site not found' };
      }

      // Use secure path resolution with traversal protection
      const projectPath = getSafeAppPath(site.path);

      // Build secure terminal command
      const termCommand = buildTerminalCommand(projectPath);
      if (!termCommand.safe) {
        return { success: false, error: 'Invalid project path' };
      }

      // Use spawn instead of exec
      const { spawn } = require('child_process');

      return new Promise((resolve) => {
        const child = spawn(termCommand.command, termCommand.args, {
          shell: termCommand.useShell, // Only use shell when platform requires it
          stdio: 'ignore',
          detached: true,
        });

        child.unref(); // Don't wait for terminal to exit

        child.on('error', (error: Error) => {
          localLogger.error(`[LocalLaravel] Failed to open terminal: ${error.message}`);
          resolve({ success: false, error: error.message });
        });

        // Give it a moment to start, then return success
        setTimeout(() => {
          localLogger.info(`[LocalLaravel] Opened terminal for ${site.name} at ${projectPath}`);
          resolve({ success: true });
        }, 100);
      });
    } catch (error: any) {
      localLogger.error('[LocalLaravel] OPEN_SITE_SHELL error:', error);
      return { success: false, error: error.message };
    }
  });

  localLogger.info('[LocalLaravel] IPC handlers registered');
}

/**
 * Parse the output of `php artisan queue:failed` command.
 *
 * Output format:
 * +----+------------+---------+---------------------+
 * | ID | Connection | Queue   | Failed At           |
 * +----+------------+---------+---------------------+
 * | 5  | database   | default | 2024-01-15 10:23:45 |
 * +----+------------+---------+---------------------+
 */
function parseQueueFailedOutput(output: string): FailedJob[] {
  const jobs: FailedJob[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Skip separator lines and header line
    if (line.startsWith('+') || line.includes('| ID |') || !line.trim()) {
      continue;
    }

    // Parse data rows: | ID | Connection | Queue | Failed At |
    if (line.startsWith('|')) {
      const parts = line.split('|').map(p => p.trim()).filter(p => p);

      if (parts.length >= 4) {
        jobs.push({
          id: parts[0],
          connection: parts[1],
          queue: parts[2],
          failedAt: parts[3],
        });
      }
    }
  }

  return jobs;
}

/**
 * Register lifecycle hooks for site events.
 */
function registerLifecycleHooks(context: LocalMain.AddonMainContext): void {
  const { hooks } = context;
  const services = LocalMain.getServiceContainer().cradle as any;
  const { localLogger } = services;

  // Hook: Inject Laravel service into site configuration
  hooks.addFilter('defaultSiteServices', (siteServices: any, siteSettings: any) => {
    localLogger.info('[LocalLaravel] defaultSiteServices filter called');
    localLogger.info(`[LocalLaravel] siteSettings.customOptions: ${JSON.stringify(sanitizeForLogging(siteSettings?.customOptions))}`);

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
    localLogger.info(`[LocalLaravel] newSiteInfo.customOptions: ${JSON.stringify(sanitizeForLogging(newSiteInfo?.customOptions))}`);
    localLogger.info(`[LocalLaravel] site.customOptions before: ${JSON.stringify(sanitizeForLogging(site?.customOptions))}`);

    if (newSiteInfo.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE) {
      localLogger.info(`[LocalLaravel] Marking site as Laravel: ${site.name}`);

      const updatedSite = {
        ...site,
        customOptions: {
          ...site.customOptions,
          ...newSiteInfo.customOptions,
        },
      };

      localLogger.info(`[LocalLaravel] site.customOptions after: ${JSON.stringify(sanitizeForLogging(updatedSite.customOptions))}`);
      return updatedSite;
    }
    return site;
  });

  // Hook: Site added - install Laravel
  hooks.addAction('siteAdded', async (site: any) => {
    localLogger.info('[LocalLaravel] siteAdded hook triggered');
    localLogger.info(`[LocalLaravel] site.name: ${site?.name}`);
    localLogger.info(`[LocalLaravel] site.id: ${site?.id}`);
    localLogger.info(`[LocalLaravel] site.customOptions: ${JSON.stringify(sanitizeForLogging(site?.customOptions))}`);

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
