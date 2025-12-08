/**
 * Local Laravel - Constants
 *
 * Central location for all constants used throughout the addon.
 * Following Laravel's convention of clear, descriptive naming.
 */

/**
 * IPC Channels for main/renderer communication.
 * All channels prefixed with 'local-laravel:' for namespacing.
 */
export const IPC_CHANNELS = {
  // Site creation
  CREATE_SITE: 'local-laravel:create-site',
  GET_CREATION_STATUS: 'local-laravel:creation-status',

  // Site information
  GET_LARAVEL_INFO: 'local-laravel:get-info',
  IS_LARAVEL_SITE: 'local-laravel:is-laravel',
  GET_LARAVEL_SITES: 'local-laravel:get-sites',
  GET_SITE_STATUS: 'local-laravel:get-site-status',

  // Artisan commands
  RUN_ARTISAN: 'local-laravel:artisan',
  GET_ARTISAN_HISTORY: 'local-laravel:artisan-history',

  // Composer operations
  RUN_COMPOSER: 'local-laravel:composer',
  GET_COMPOSER_VERSION: 'local-laravel:composer-version',

  // Environment management
  GET_ENV: 'local-laravel:get-env',
  UPDATE_ENV: 'local-laravel:update-env',

  // Log viewer
  GET_LARAVEL_LOGS: 'local-laravel:get-logs',

  // Queue operations
  GET_FAILED_JOBS: 'local-laravel:queue-failed',
  RETRY_JOB: 'local-laravel:queue-retry',
  FORGET_JOB: 'local-laravel:queue-forget',
  FLUSH_JOBS: 'local-laravel:queue-flush',

  // Editor integration
  OPEN_IN_VSCODE: 'local-laravel:open-vscode',
  OPEN_SITE_FOLDER: 'local-laravel:open-folder',
  OPEN_SITE_SHELL: 'local-laravel:open-shell',
} as const;

/**
 * Site creation flow identifier.
 * Must include 'create-site/' prefix for Local to recognize it.
 */
export const FLOW_NAME = 'create-site/laravel';

/**
 * Route paths for the site creation wizard.
 * Must be under /main/create-site/ for Local's routing.
 */
export const ROUTES = {
  BASE: '/main/create-site/laravel',
  ENTRY: '/main/create-site/laravel',
  CONFIG: '/main/create-site/laravel/config',
  BUILDING: '/main/create-site/laravel/building',
} as const;

/**
 * Supported Laravel versions.
 * Maps to Composer version constraints.
 */
export const LARAVEL_VERSIONS = {
  '11': {
    constraint: 'laravel/laravel:^11.0',
    label: 'Laravel 11.x',
    minPhp: '8.2',
    description: 'Latest stable release with PHP 8.2+ features',
  },
  '10': {
    constraint: 'laravel/laravel:^10.0',
    label: 'Laravel 10.x',
    minPhp: '8.1',
    description: 'LTS release with broad PHP compatibility',
  },
} as const;

/**
 * Default Laravel version for new projects.
 */
export const DEFAULT_LARAVEL_VERSION = '11';

/**
 * Supported starter kits.
 */
export const STARTER_KITS = {
  none: {
    label: 'None',
    description: 'Vanilla Laravel installation',
    packages: [],
  },
  breeze: {
    label: 'Laravel Breeze',
    description: 'Simple authentication with Blade and Tailwind CSS',
    packages: ['laravel/breeze'],
    postInstall: ['breeze:install', 'blade'],
  },
  // Future: jetstream, filament, etc.
} as const;

/**
 * Default starter kit selection.
 */
export const DEFAULT_STARTER_KIT = 'none';

/**
 * Quick artisan commands shown in the UI.
 */
export const QUICK_ARTISAN_COMMANDS = [
  {
    command: 'migrate',
    label: 'Migrate',
    description: 'Run database migrations',
    icon: 'database',
  },
  {
    command: 'migrate:fresh --seed',
    label: 'Fresh + Seed',
    description: 'Drop all tables and re-run migrations with seeders',
    icon: 'refresh',
    dangerous: true,
  },
  {
    command: 'cache:clear',
    label: 'Clear Cache',
    description: 'Clear application cache',
    icon: 'trash',
  },
  {
    command: 'config:clear',
    label: 'Clear Config',
    description: 'Clear configuration cache',
    icon: 'settings',
  },
  {
    command: 'route:list',
    label: 'Routes',
    description: 'List all registered routes',
    icon: 'list',
  },
  {
    command: 'optimize',
    label: 'Optimize',
    description: 'Cache config, routes, and views',
    icon: 'zap',
  },
] as const;

/**
 * Site custom options key for identifying Laravel sites.
 */
export const SITE_TYPE_KEY = 'siteType';
export const SITE_TYPE_VALUE = 'laravel';

/**
 * Service name for the Laravel Lightning Service.
 */
export const SERVICE_NAME = 'laravel';
export const SERVICE_VERSION = '1.0.0';

/**
 * Default database configuration.
 * Matches Local's default MySQL setup.
 */
export const DEFAULT_DB_CONFIG = {
  connection: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'local',
  username: 'root',
  password: 'root',
} as const;

/**
 * Progress stages for site creation.
 */
export const CREATION_STAGES = {
  INITIALIZING: { progress: 0, message: 'Initializing...' },
  PROVISIONING: { progress: 15, message: 'Provisioning infrastructure...' },
  INSTALLING_COMPOSER: { progress: 30, message: 'Running Composer...' },
  CREATING_PROJECT: { progress: 45, message: 'Creating Laravel project...' },
  CONFIGURING_ENV: { progress: 70, message: 'Configuring environment...' },
  RUNNING_MIGRATIONS: { progress: 85, message: 'Running migrations...' },
  FINALIZING: { progress: 95, message: 'Finalizing setup...' },
  COMPLETE: { progress: 100, message: 'Complete!' },
} as const;
