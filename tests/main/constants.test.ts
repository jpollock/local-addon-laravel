/**
 * Constants Tests
 *
 * Verify that constants are properly defined and consistent.
 */

import {
  IPC_CHANNELS,
  FLOW_NAME,
  ROUTES,
  LARAVEL_VERSIONS,
  DEFAULT_LARAVEL_VERSION,
  STARTER_KITS,
  DEFAULT_STARTER_KIT,
  SITE_TYPE_KEY,
  SITE_TYPE_VALUE,
  SERVICE_NAME,
} from '../../src/common/constants';

describe('Constants', () => {
  describe('IPC_CHANNELS', () => {
    it('should have all channels prefixed with local-laravel:', () => {
      Object.values(IPC_CHANNELS).forEach((channel) => {
        expect(channel).toMatch(/^local-laravel:/);
      });
    });

    it('should have unique channel names', () => {
      const channels = Object.values(IPC_CHANNELS);
      const uniqueChannels = new Set(channels);
      expect(uniqueChannels.size).toBe(channels.length);
    });
  });

  describe('FLOW_NAME', () => {
    it('should have create-site/ prefix', () => {
      expect(FLOW_NAME).toMatch(/^create-site\//);
    });

    it('should be create-site/laravel', () => {
      expect(FLOW_NAME).toBe('create-site/laravel');
    });
  });

  describe('ROUTES', () => {
    it('should have all routes under /main/create-site/', () => {
      Object.values(ROUTES).forEach((route) => {
        expect(route).toMatch(/^\/main\/create-site\//);
      });
    });

    it('should have BASE equal to ENTRY', () => {
      expect(ROUTES.BASE).toBe(ROUTES.ENTRY);
    });
  });

  describe('LARAVEL_VERSIONS', () => {
    it('should have version 11 and 10', () => {
      expect(LARAVEL_VERSIONS['11']).toBeDefined();
      expect(LARAVEL_VERSIONS['10']).toBeDefined();
    });

    it('should have valid composer constraints', () => {
      expect(LARAVEL_VERSIONS['11'].constraint).toContain('laravel/laravel');
      expect(LARAVEL_VERSIONS['10'].constraint).toContain('laravel/laravel');
    });

    it('should have minimum PHP versions', () => {
      expect(LARAVEL_VERSIONS['11'].minPhp).toBe('8.2');
      expect(LARAVEL_VERSIONS['10'].minPhp).toBe('8.1');
    });
  });

  describe('DEFAULT_LARAVEL_VERSION', () => {
    it('should be a valid Laravel version', () => {
      expect(LARAVEL_VERSIONS[DEFAULT_LARAVEL_VERSION]).toBeDefined();
    });

    it('should default to Laravel 11', () => {
      expect(DEFAULT_LARAVEL_VERSION).toBe('11');
    });
  });

  describe('STARTER_KITS', () => {
    it('should have none and breeze options', () => {
      expect(STARTER_KITS.none).toBeDefined();
      expect(STARTER_KITS.breeze).toBeDefined();
    });

    it('should have labels for all kits', () => {
      Object.values(STARTER_KITS).forEach((kit) => {
        expect(kit.label).toBeDefined();
        expect(kit.description).toBeDefined();
      });
    });
  });

  describe('DEFAULT_STARTER_KIT', () => {
    it('should be a valid starter kit', () => {
      expect(STARTER_KITS[DEFAULT_STARTER_KIT]).toBeDefined();
    });

    it('should default to none', () => {
      expect(DEFAULT_STARTER_KIT).toBe('none');
    });
  });

  describe('Site Type', () => {
    it('should have correct site type identifiers', () => {
      expect(SITE_TYPE_KEY).toBe('siteType');
      expect(SITE_TYPE_VALUE).toBe('laravel');
    });
  });

  describe('SERVICE_NAME', () => {
    it('should be laravel', () => {
      expect(SERVICE_NAME).toBe('laravel');
    });
  });
});
