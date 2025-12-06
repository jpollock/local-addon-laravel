/**
 * Local Laravel - Type Definitions
 *
 * TypeScript interfaces and types for the addon.
 * Following Laravel's convention of clear, expressive naming.
 */

/**
 * Laravel version identifiers.
 */
export type LaravelVersion = '11' | '10';

/**
 * Starter kit identifiers.
 */
export type StarterKit = 'none' | 'breeze';

/**
 * Breeze stack options (when breeze is selected).
 */
export type BreezeStack = 'blade' | 'livewire' | 'react' | 'vue';

/**
 * Configuration for a Laravel site stored in customOptions.
 */
export interface LaravelSiteConfig {
  /** Site type identifier */
  siteType: 'laravel';

  /** Laravel version (e.g., '11', '10') */
  laravelVersion: LaravelVersion;

  /** PHP version used */
  phpVersion: string;

  /** Starter kit installed */
  starterKit: StarterKit;

  /** Breeze stack (if breeze selected) */
  breezeStack?: BreezeStack;

  /** Timestamp when site was created */
  createdAt: string;
}

/**
 * Request to create a new Laravel site.
 */
export interface CreateLaravelSiteRequest {
  /** Site name (display name) */
  siteName: string;

  /** Site domain (e.g., 'mysite.local') */
  siteDomain: string;

  /** Site path (optional, defaults to ~/Local Sites/{siteName}) */
  sitePath?: string;

  /** Laravel version to install */
  laravelVersion: LaravelVersion;

  /** PHP version to use */
  phpVersion: string;

  /** Starter kit to install */
  starterKit: StarterKit;

  /** Breeze stack (required if starterKit is 'breeze') */
  breezeStack?: BreezeStack;

  /** MySQL version to use */
  mysqlVersion?: string;
}

/**
 * Response from site creation.
 */
export interface CreateLaravelSiteResponse {
  success: boolean;
  siteId?: string;
  error?: string;
}

/**
 * Information about a Laravel site.
 */
export interface LaravelSiteInfo {
  /** Detected Laravel version */
  version: string;

  /** PHP version running the site */
  phpVersion: string;

  /** APP_ENV value */
  environment: string;

  /** APP_DEBUG value */
  debug: boolean;

  /** Installed starter kit */
  starterKit: StarterKit;

  /** Whether queue worker is configured */
  hasQueue: boolean;

  /** Whether scheduler is configured */
  hasScheduler: boolean;

  /** Key packages installed */
  packages: string[];
}

/**
 * Request to run an artisan command.
 */
export interface ArtisanRequest {
  /** Site ID */
  siteId: string;

  /** Command and arguments (e.g., ['migrate', '--force']) */
  command: string[];

  /** Working directory override (optional) */
  cwd?: string;
}

/**
 * Result of an artisan command execution.
 */
export interface ArtisanResult {
  /** Whether command succeeded (exit code 0) */
  success: boolean;

  /** Combined stdout and stderr output */
  output: string;

  /** Process exit code */
  exitCode: number;

  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Request to run a composer command.
 */
export interface ComposerRequest {
  /** Site ID */
  siteId: string;

  /** Command and arguments (e.g., ['require', 'laravel/sanctum']) */
  command: string[];
}

/**
 * Result of a composer command execution.
 */
export interface ComposerResult {
  /** Whether command succeeded */
  success: boolean;

  /** Command output */
  output: string;

  /** Process exit code */
  exitCode: number;

  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Environment variable entry.
 */
export interface EnvVariable {
  key: string;
  value: string;
  /** Whether this is a sensitive value (password, key, etc.) */
  sensitive?: boolean;
}

/**
 * Site creation progress update.
 */
export interface CreationProgress {
  /** Progress percentage (0-100) */
  progress: number;

  /** Current stage identifier */
  stage: string;

  /** Human-readable status message */
  message: string;

  /** Error message if failed */
  error?: string;
}

/**
 * Artisan command history entry.
 */
export interface ArtisanHistoryEntry {
  /** Unique entry ID */
  id: string;

  /** Site ID */
  siteId: string;

  /** Command that was run */
  command: string;

  /** Command output */
  output: string;

  /** Exit code */
  exitCode: number;

  /** Timestamp when command was run */
  timestamp: string;

  /** Duration in milliseconds */
  duration: number;
}

/**
 * Wizard step definition for site creation.
 */
export interface WizardStep {
  /** Unique step key */
  key: string;

  /** Route path */
  path: string;

  /** Display name */
  name: string;

  /** React component to render */
  component: React.ComponentType<WizardStepProps>;
}

/**
 * Props passed to wizard step components.
 */
export interface WizardStepProps {
  /** Current site settings being built */
  siteSettings: Partial<CreateLaravelSiteRequest>;

  /** Update site settings */
  updateSiteSettings: (settings: Partial<CreateLaravelSiteRequest>) => void;

  /** Navigate to another route */
  history: {
    push: (path: string) => void;
    goBack: () => void;
  };

  /** Current location */
  location: {
    pathname: string;
  };
}

/**
 * Props for the Laravel site info panel.
 */
export interface LaravelPanelProps {
  /** The site object */
  site: LocalSite;

  /** Site status ('running', 'stopped', etc.) */
  siteStatus: string;
}

/**
 * Local site object (simplified from Local's types).
 */
export interface LocalSite {
  id: string;
  name: string;
  domain: string;
  path: string;
  paths: {
    app: string;
    webRoot: string;
    sql: string;
    conf: string;
    logs: string;
    runData: string;
  };
  services: Record<string, LocalService>;
  mysql: {
    database: string;
    user: string;
    password: string;
  };
  customOptions?: Record<string, unknown>;
}

/**
 * Local service definition.
 */
export interface LocalService {
  name: string;
  version: string;
  role: string;
  ports?: Record<string, number[]>;
}

/**
 * IPC response wrapper.
 */
export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Request to get Laravel logs.
 */
export interface GetLogsRequest {
  /** Site ID */
  siteId: string;

  /** Number of lines to fetch (default: 100) */
  lines?: number;
}

/**
 * Response from get Laravel logs.
 */
export interface GetLogsResponse {
  success: boolean;
  logs?: string;
  error?: string;
}

/**
 * Request to get .env file.
 */
export interface GetEnvRequest {
  /** Site ID */
  siteId: string;
}

/**
 * Response from get .env file.
 */
export interface GetEnvResponse {
  success: boolean;
  variables?: EnvVariable[];
  raw?: string;
  error?: string;
}

/**
 * Request to update .env file.
 */
export interface UpdateEnvRequest {
  /** Site ID */
  siteId: string;

  /** New .env content */
  content: string;
}

/**
 * Response from update .env file.
 */
export interface UpdateEnvResponse {
  success: boolean;
  error?: string;
}
