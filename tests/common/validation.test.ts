/**
 * Validation Module Tests
 *
 * Comprehensive tests for input validation schemas.
 */

import {
  containsShellMetacharacters,
  SafeStringSchema,
  SiteIdSchema,
  SiteNameSchema,
  SiteDomainSchema,
  LaravelVersionSchema,
  PhpVersionSchema,
  StarterKitSchema,
  BreezeStackSchema,
  CreateSiteRequestSchema,
  ArtisanRequestSchema,
  ArtisanArgumentSchema,
  isAllowedArtisanCommand,
  ALLOWED_ARTISAN_COMMANDS,
  JobIdSchema,
  QueueJobRequestSchema,
  GetLogsRequestSchema,
  GetEnvRequestSchema,
  UpdateEnvRequestSchema,
  isValidEnvContent,
  SiteIdRequestSchema,
  GetCreationStatusRequestSchema,
  validateInput,
  safeValidateInput,
} from '../../src/common/validation';

describe('Validation Module', () => {
  describe('containsShellMetacharacters', () => {
    it('should return false for safe strings', () => {
      expect(containsShellMetacharacters('hello')).toBe(false);
      expect(containsShellMetacharacters('hello-world')).toBe(false);
      expect(containsShellMetacharacters('test_123')).toBe(false);
      expect(containsShellMetacharacters('path/to/file')).toBe(false);
    });

    it('should return true for strings with shell metacharacters', () => {
      expect(containsShellMetacharacters('hello;world')).toBe(true);
      expect(containsShellMetacharacters('test|pipe')).toBe(true);
      expect(containsShellMetacharacters('cmd&bg')).toBe(true);
      expect(containsShellMetacharacters('$(command)')).toBe(true);
      expect(containsShellMetacharacters('`backtick`')).toBe(true);
      expect(containsShellMetacharacters('test\nline')).toBe(true);
      expect(containsShellMetacharacters('test\rreturn')).toBe(true);
    });
  });

  describe('SafeStringSchema', () => {
    it('should accept safe strings', () => {
      const result = SafeStringSchema.safeParse('hello-world_123');
      expect(result.success).toBe(true);
    });

    it('should reject strings with shell metacharacters', () => {
      const result = SafeStringSchema.safeParse('hello;rm -rf');
      expect(result.success).toBe(false);
    });
  });

  describe('SiteIdSchema', () => {
    it('should accept valid site IDs', () => {
      expect(SiteIdSchema.safeParse('abc123').success).toBe(true);
      expect(SiteIdSchema.safeParse('site-id_123').success).toBe(true);
      expect(SiteIdSchema.safeParse('ABC-xyz').success).toBe(true);
    });

    it('should reject empty site IDs', () => {
      expect(SiteIdSchema.safeParse('').success).toBe(false);
    });

    it('should reject site IDs that are too long', () => {
      expect(SiteIdSchema.safeParse('a'.repeat(101)).success).toBe(false);
    });

    it('should reject site IDs with invalid characters', () => {
      expect(SiteIdSchema.safeParse('site/id').success).toBe(false);
      expect(SiteIdSchema.safeParse('site id').success).toBe(false);
      expect(SiteIdSchema.safeParse('site;id').success).toBe(false);
    });
  });

  describe('SiteNameSchema', () => {
    it('should accept valid site names', () => {
      expect(SiteNameSchema.safeParse('My Site').success).toBe(true);
      expect(SiteNameSchema.safeParse('test-site_123').success).toBe(true);
    });

    it('should reject names that are too short', () => {
      expect(SiteNameSchema.safeParse('a').success).toBe(false);
    });

    it('should reject names that are too long', () => {
      expect(SiteNameSchema.safeParse('a'.repeat(51)).success).toBe(false);
    });

    it('should reject names with invalid characters', () => {
      expect(SiteNameSchema.safeParse('site;name').success).toBe(false);
      expect(SiteNameSchema.safeParse('site<script>').success).toBe(false);
    });
  });

  describe('SiteDomainSchema', () => {
    it('should accept valid domains', () => {
      expect(SiteDomainSchema.safeParse('mysite.local').success).toBe(true);
      expect(SiteDomainSchema.safeParse('my-site.local').success).toBe(true);
      expect(SiteDomainSchema.safeParse('my-site-123.local').success).toBe(true);
    });

    it('should reject domains not ending with .local', () => {
      expect(SiteDomainSchema.safeParse('mysite.com').success).toBe(false);
      expect(SiteDomainSchema.safeParse('mysite').success).toBe(false);
    });

    it('should reject domains that are too short', () => {
      expect(SiteDomainSchema.safeParse('ab').success).toBe(false);
    });

    it('should reject domains with invalid characters', () => {
      expect(SiteDomainSchema.safeParse('my_site.local').success).toBe(false);
      expect(SiteDomainSchema.safeParse('MY-SITE.local').success).toBe(false);
    });
  });

  describe('LaravelVersionSchema', () => {
    it('should accept valid Laravel versions', () => {
      expect(LaravelVersionSchema.safeParse('10').success).toBe(true);
      expect(LaravelVersionSchema.safeParse('11').success).toBe(true);
    });

    it('should reject invalid Laravel versions', () => {
      expect(LaravelVersionSchema.safeParse('9').success).toBe(false);
      expect(LaravelVersionSchema.safeParse('12').success).toBe(false);
    });
  });

  describe('PhpVersionSchema', () => {
    it('should accept valid PHP versions', () => {
      expect(PhpVersionSchema.safeParse('8.1').success).toBe(true);
      expect(PhpVersionSchema.safeParse('8.2').success).toBe(true);
      expect(PhpVersionSchema.safeParse('8.3').success).toBe(true);
      expect(PhpVersionSchema.safeParse('8.1.0').success).toBe(true);
    });

    it('should reject invalid PHP versions', () => {
      expect(PhpVersionSchema.safeParse('7.4').success).toBe(false);
      expect(PhpVersionSchema.safeParse('8.0').success).toBe(false);
      expect(PhpVersionSchema.safeParse('php8.1').success).toBe(false);
    });
  });

  describe('StarterKitSchema', () => {
    it('should accept valid starter kits', () => {
      expect(StarterKitSchema.safeParse('none').success).toBe(true);
      expect(StarterKitSchema.safeParse('breeze').success).toBe(true);
    });

    it('should reject invalid starter kits', () => {
      expect(StarterKitSchema.safeParse('jetstream').success).toBe(false);
      expect(StarterKitSchema.safeParse('').success).toBe(false);
    });
  });

  describe('BreezeStackSchema', () => {
    it('should accept valid Breeze stacks', () => {
      expect(BreezeStackSchema.safeParse('blade').success).toBe(true);
      expect(BreezeStackSchema.safeParse('livewire').success).toBe(true);
      expect(BreezeStackSchema.safeParse('react').success).toBe(true);
      expect(BreezeStackSchema.safeParse('vue').success).toBe(true);
    });

    it('should reject invalid Breeze stacks', () => {
      expect(BreezeStackSchema.safeParse('angular').success).toBe(false);
    });
  });

  describe('CreateSiteRequestSchema', () => {
    const validRequest = {
      siteName: 'My Laravel Site',
      siteDomain: 'mysite.local',
      laravelVersion: '11',
      phpVersion: '8.3',
      starterKit: 'none',
    };

    it('should accept valid create site requests', () => {
      expect(CreateSiteRequestSchema.safeParse(validRequest).success).toBe(true);
    });

    it('should accept requests with breeze and breezeStack', () => {
      const withBreeze = {
        ...validRequest,
        starterKit: 'breeze',
        breezeStack: 'blade',
      };
      expect(CreateSiteRequestSchema.safeParse(withBreeze).success).toBe(true);
    });

    it('should reject breeze without breezeStack', () => {
      const breezeNoStack = {
        ...validRequest,
        starterKit: 'breeze',
      };
      expect(CreateSiteRequestSchema.safeParse(breezeNoStack).success).toBe(false);
    });

    it('should accept optional sitePath', () => {
      const withPath = {
        ...validRequest,
        sitePath: '/path/to/site',
      };
      expect(CreateSiteRequestSchema.safeParse(withPath).success).toBe(true);
    });
  });

  describe('isAllowedArtisanCommand', () => {
    it('should allow whitelisted commands', () => {
      expect(isAllowedArtisanCommand(['migrate'])).toBe(true);
      expect(isAllowedArtisanCommand(['migrate:fresh'])).toBe(true);
      expect(isAllowedArtisanCommand(['cache:clear'])).toBe(true);
      expect(isAllowedArtisanCommand(['make:model', 'User'])).toBe(true);
    });

    it('should reject non-whitelisted commands', () => {
      expect(isAllowedArtisanCommand(['serve'])).toBe(false);
      expect(isAllowedArtisanCommand(['inspire'])).toBe(false);
      expect(isAllowedArtisanCommand(['custom:command'])).toBe(false);
    });

    it('should reject empty commands', () => {
      expect(isAllowedArtisanCommand([])).toBe(false);
    });
  });

  describe('ArtisanArgumentSchema', () => {
    it('should accept safe arguments', () => {
      expect(ArtisanArgumentSchema.safeParse('User').success).toBe(true);
      expect(ArtisanArgumentSchema.safeParse('--force').success).toBe(true);
      expect(ArtisanArgumentSchema.safeParse('--seed').success).toBe(true);
    });

    it('should reject arguments that are too long', () => {
      expect(ArtisanArgumentSchema.safeParse('a'.repeat(201)).success).toBe(false);
    });

    it('should reject arguments with shell metacharacters', () => {
      expect(ArtisanArgumentSchema.safeParse('--flag;rm').success).toBe(false);
      expect(ArtisanArgumentSchema.safeParse('$(whoami)').success).toBe(false);
    });
  });

  describe('ArtisanRequestSchema', () => {
    it('should accept valid artisan requests', () => {
      const request = {
        siteId: 'site123',
        command: ['migrate'],
      };
      expect(ArtisanRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should accept commands with arguments', () => {
      const request = {
        siteId: 'site123',
        command: ['make:model', 'User', '--migration'],
      };
      expect(ArtisanRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should reject disallowed commands', () => {
      const request = {
        siteId: 'site123',
        command: ['serve'],
      };
      expect(ArtisanRequestSchema.safeParse(request).success).toBe(false);
    });

    it('should reject too many arguments', () => {
      const request = {
        siteId: 'site123',
        command: Array(21).fill('arg'),
      };
      expect(ArtisanRequestSchema.safeParse(request).success).toBe(false);
    });
  });

  describe('JobIdSchema', () => {
    it('should accept numeric job IDs', () => {
      expect(JobIdSchema.safeParse('1').success).toBe(true);
      expect(JobIdSchema.safeParse('123').success).toBe(true);
    });

    it('should accept "all"', () => {
      expect(JobIdSchema.safeParse('all').success).toBe(true);
    });

    it('should reject non-numeric strings', () => {
      expect(JobIdSchema.safeParse('abc').success).toBe(false);
      expect(JobIdSchema.safeParse('1a').success).toBe(false);
    });
  });

  describe('QueueJobRequestSchema', () => {
    it('should accept valid queue job requests', () => {
      expect(QueueJobRequestSchema.safeParse({ siteId: 'site123', jobId: '1' }).success).toBe(true);
      expect(QueueJobRequestSchema.safeParse({ siteId: 'site123', jobId: 'all' }).success).toBe(true);
    });
  });

  describe('GetLogsRequestSchema', () => {
    it('should accept valid get logs requests', () => {
      expect(GetLogsRequestSchema.safeParse({ siteId: 'site123' }).success).toBe(true);
      expect(GetLogsRequestSchema.safeParse({ siteId: 'site123', lines: 100 }).success).toBe(true);
    });

    it('should reject lines out of range', () => {
      expect(GetLogsRequestSchema.safeParse({ siteId: 'site123', lines: 0 }).success).toBe(false);
      expect(GetLogsRequestSchema.safeParse({ siteId: 'site123', lines: 10001 }).success).toBe(false);
    });
  });

  describe('GetEnvRequestSchema', () => {
    it('should accept valid get env requests', () => {
      expect(GetEnvRequestSchema.safeParse({ siteId: 'site123' }).success).toBe(true);
    });
  });

  describe('isValidEnvContent', () => {
    it('should accept valid env content', () => {
      expect(isValidEnvContent('APP_NAME=Laravel')).toBe(true);
      expect(isValidEnvContent('APP_NAME=Laravel\nAPP_ENV=local')).toBe(true);
      expect(isValidEnvContent('# Comment\nAPP_NAME=Laravel')).toBe(true);
      expect(isValidEnvContent('')).toBe(true);
      expect(isValidEnvContent('   ')).toBe(true);
    });

    it('should reject invalid env content', () => {
      expect(isValidEnvContent('invalid line')).toBe(false);
      expect(isValidEnvContent('1KEY=value')).toBe(false);
    });
  });

  describe('UpdateEnvRequestSchema', () => {
    it('should accept valid update env requests', () => {
      const request = {
        siteId: 'site123',
        content: 'APP_NAME=Laravel\nAPP_ENV=local',
      };
      expect(UpdateEnvRequestSchema.safeParse(request).success).toBe(true);
    });

    it('should reject invalid env content', () => {
      const request = {
        siteId: 'site123',
        content: 'invalid content',
      };
      expect(UpdateEnvRequestSchema.safeParse(request).success).toBe(false);
    });

    it('should reject content that is too large', () => {
      const request = {
        siteId: 'site123',
        content: 'A'.repeat(100001),
      };
      expect(UpdateEnvRequestSchema.safeParse(request).success).toBe(false);
    });
  });

  describe('SiteIdRequestSchema', () => {
    it('should accept valid site ID requests', () => {
      expect(SiteIdRequestSchema.safeParse({ siteId: 'site123' }).success).toBe(true);
    });
  });

  describe('GetCreationStatusRequestSchema', () => {
    it('should accept valid get creation status requests', () => {
      expect(GetCreationStatusRequestSchema.safeParse({ siteId: 'site123' }).success).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('should return parsed data for valid input', () => {
      const result = validateInput(SiteIdSchema, 'site123');
      expect(result).toBe('site123');
    });

    it('should throw for invalid input', () => {
      expect(() => validateInput(SiteIdSchema, '')).toThrow();
    });
  });

  describe('safeValidateInput', () => {
    it('should return success for valid input', () => {
      const result = safeValidateInput(SiteIdSchema, 'site123');
      expect(result.success).toBe(true);
      expect(result.data).toBe('site123');
    });

    it('should return error for invalid input', () => {
      const result = safeValidateInput(SiteIdSchema, '');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ALLOWED_ARTISAN_COMMANDS', () => {
    it('should include common artisan commands', () => {
      expect(ALLOWED_ARTISAN_COMMANDS).toContain('migrate');
      expect(ALLOWED_ARTISAN_COMMANDS).toContain('cache:clear');
      expect(ALLOWED_ARTISAN_COMMANDS).toContain('make:model');
      expect(ALLOWED_ARTISAN_COMMANDS).toContain('route:list');
    });

    it('should not include dangerous commands', () => {
      expect(ALLOWED_ARTISAN_COMMANDS).not.toContain('serve');
      expect(ALLOWED_ARTISAN_COMMANDS).not.toContain('down');
      expect(ALLOWED_ARTISAN_COMMANDS).not.toContain('up');
    });
  });
});
