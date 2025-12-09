/**
 * Local Laravel - Input Validation Schemas
 *
 * Zod schemas for validating all IPC handler inputs.
 * Security-first approach: validate everything before processing.
 */

import { z } from 'zod';

/**
 * Allowed artisan commands (whitelist approach for security).
 * Only these base commands are allowed to prevent arbitrary command execution.
 */
export const ALLOWED_ARTISAN_COMMANDS = [
  // Database
  'migrate',
  'migrate:fresh',
  'migrate:rollback',
  'migrate:status',
  'migrate:reset',
  'db:seed',
  'db:wipe',

  // Cache
  'cache:clear',
  'cache:forget',
  'config:clear',
  'config:cache',
  'route:clear',
  'route:cache',
  'view:clear',
  'view:cache',
  'event:clear',
  'event:cache',
  'optimize',
  'optimize:clear',

  // Queue
  'queue:failed',
  'queue:retry',
  'queue:forget',
  'queue:flush',
  'queue:work',
  'queue:listen',
  'queue:restart',

  // Application
  'key:generate',
  'storage:link',
  'schedule:run',
  'schedule:list',

  // Make commands (safe - only create files)
  'make:model',
  'make:controller',
  'make:migration',
  'make:seeder',
  'make:factory',
  'make:middleware',
  'make:request',
  'make:resource',
  'make:rule',
  'make:policy',
  'make:observer',
  'make:event',
  'make:listener',
  'make:job',
  'make:mail',
  'make:notification',
  'make:provider',
  'make:command',
  'make:channel',
  'make:exception',
  'make:cast',
  'make:component',
  'make:test',

  // Info commands
  'route:list',
  'about',
  'list',
  'help',
  'env',

  // Breeze
  'breeze:install',

  // Jetstream
  'jetstream:install',

  // Tinker (read-only exploration)
  'tinker',
] as const;

/**
 * Dangerous shell metacharacters that could enable command injection.
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>\\!"'\n\r]/;

/**
 * Validate that a string doesn't contain shell metacharacters.
 */
export function containsShellMetacharacters(value: string): boolean {
  return SHELL_METACHARACTERS.test(value);
}

/**
 * Safe string that doesn't contain shell metacharacters.
 * Used internally by validation schemas.
 */
export const SafeStringSchema = z.string().refine(
  (val) => !containsShellMetacharacters(val),
  { message: 'String contains disallowed characters' }
);

/**
 * Site ID validation - must be a valid Local site ID format.
 */
export const SiteIdSchema = z.string()
  .min(1, 'Site ID is required')
  .max(100, 'Site ID too long')
  .regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid site ID format');

/**
 * Site name validation.
 */
export const SiteNameSchema = z.string()
  .min(2, 'Site name must be at least 2 characters')
  .max(50, 'Site name must be at most 50 characters')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Site name contains invalid characters');

/**
 * Site domain validation.
 */
export const SiteDomainSchema = z.string()
  .min(3, 'Domain must be at least 3 characters')
  .max(100, 'Domain too long')
  .regex(/^[a-z0-9][a-z0-9-]*\.local$/, 'Invalid domain format (must end with .local)');

/**
 * Laravel version validation.
 */
export const LaravelVersionSchema = z.enum(['10', '11']);

/**
 * PHP version validation.
 */
export const PhpVersionSchema = z.string()
  .regex(/^8\.[1-3](\.\d+)?$/, 'Invalid PHP version (must be 8.1, 8.2, or 8.3)');

/**
 * Starter kit validation.
 */
export const StarterKitSchema = z.enum(['none', 'breeze', 'jetstream']);

/**
 * Breeze stack validation.
 */
export const BreezeStackSchema = z.enum(['blade', 'livewire', 'react', 'vue', 'api']);

/**
 * Jetstream stack validation.
 */
export const JetstreamStackSchema = z.enum(['livewire', 'inertia']);

/**
 * MySQL version validation.
 */
export const MysqlVersionSchema = z.string()
  .regex(/^mysql-\d+\.\d+\.\d+$/, 'Invalid MySQL version format')
  .optional();

/**
 * Create site request validation.
 */
export const CreateSiteRequestSchema = z.object({
  siteName: SiteNameSchema,
  siteDomain: SiteDomainSchema,
  sitePath: z.string().max(500).optional(),
  laravelVersion: LaravelVersionSchema,
  phpVersion: PhpVersionSchema,
  starterKit: StarterKitSchema,
  breezeStack: BreezeStackSchema.optional(),
  jetstreamStack: JetstreamStackSchema.optional(),
  jetstreamTeams: z.boolean().optional(),
  jetstreamApi: z.boolean().optional(),
  mysqlVersion: MysqlVersionSchema,
}).refine(
  (data) => data.starterKit !== 'breeze' || data.breezeStack !== undefined,
  { message: 'Breeze stack is required when starter kit is breeze', path: ['breezeStack'] }
).refine(
  (data) => data.starterKit !== 'jetstream' || data.jetstreamStack !== undefined,
  { message: 'Jetstream stack is required when starter kit is jetstream', path: ['jetstreamStack'] }
);

/**
 * Artisan command argument validation.
 * Each argument must be safe and not contain shell metacharacters.
 */
export const ArtisanArgumentSchema = z.string()
  .max(200, 'Argument too long')
  .refine(
    (val) => !containsShellMetacharacters(val),
    { message: 'Argument contains disallowed characters' }
  );

/**
 * Validate that an artisan command is allowed.
 */
export function isAllowedArtisanCommand(command: string[]): boolean {
  if (command.length === 0) return false;

  const baseCommand = command[0];

  // Check if base command is in whitelist
  return ALLOWED_ARTISAN_COMMANDS.some((allowed) => {
    // Exact match or command starts with allowed prefix (for subcommands like migrate:fresh)
    return baseCommand === allowed || baseCommand.startsWith(allowed + ':');
  });
}

/**
 * Artisan request validation.
 */
export const ArtisanRequestSchema = z.object({
  siteId: SiteIdSchema,
  command: z.array(ArtisanArgumentSchema)
    .min(1, 'Command is required')
    .max(20, 'Too many arguments')
    .refine(
      (cmd) => isAllowedArtisanCommand(cmd),
      { message: 'This artisan command is not allowed for security reasons' }
    ),
  cwd: z.string().max(500).optional(),
});

/**
 * Queue job ID validation - must be numeric or 'all'.
 */
export const JobIdSchema = z.string()
  .refine(
    (val) => val === 'all' || /^\d+$/.test(val),
    { message: 'Job ID must be numeric or "all"' }
  );

/**
 * Queue job request validation.
 */
export const QueueJobRequestSchema = z.object({
  siteId: SiteIdSchema,
  jobId: JobIdSchema,
});

/**
 * Get logs request validation.
 */
export const GetLogsRequestSchema = z.object({
  siteId: SiteIdSchema,
  lines: z.number().min(1).max(10000).optional(),
});

/**
 * Get env request validation.
 */
export const GetEnvRequestSchema = z.object({
  siteId: SiteIdSchema,
});

/**
 * Update env request validation.
 */
export const UpdateEnvRequestSchema = z.object({
  siteId: SiteIdSchema,
  content: z.string()
    .max(100000, 'Content too large')
    .refine(
      (val) => isValidEnvContent(val),
      { message: 'Invalid .env file format' }
    ),
});

/**
 * Validate .env file content format.
 */
export function isValidEnvContent(content: string): boolean {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Allow empty lines
    if (!trimmed) continue;

    // Allow comments
    if (trimmed.startsWith('#')) continue;

    // Must be KEY=VALUE format
    // Key: starts with letter or underscore, contains only letters, numbers, underscores
    // Value: anything after =
    if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(trimmed)) {
      return false;
    }
  }

  return true;
}

/**
 * Simple site ID request validation.
 */
export const SiteIdRequestSchema = z.object({
  siteId: SiteIdSchema,
});

/**
 * Get creation status request validation.
 */
export const GetCreationStatusRequestSchema = z.object({
  siteId: SiteIdSchema,
});

/**
 * Validate and parse input, returning typed result or throwing.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate input, returning result object.
 */
export function safeValidateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  error?: string;
} {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: result.error.errors.map((e) => e.message).join(', '),
  };
}
