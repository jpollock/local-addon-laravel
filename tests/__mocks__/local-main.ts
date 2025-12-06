/**
 * Mock for @getflywheel/local/main
 */

export const getServiceContainer = jest.fn().mockReturnValue({
  cradle: {
    localLogger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    siteData: {
      getSite: jest.fn(),
      getSites: jest.fn().mockReturnValue([]),
      updateSite: jest.fn(),
      addSite: jest.fn(),
    },
    siteProcessManager: {
      getSiteStatus: jest.fn().mockReturnValue('stopped'),
      startSite: jest.fn(),
      stopSite: jest.fn(),
    },
    siteDatabase: {
      waitForDB: jest.fn().mockResolvedValue(undefined),
      runQuery: jest.fn(),
    },
    userData: {
      get: jest.fn().mockReturnValue({}),
      set: jest.fn(),
    },
    ports: {
      getAvailablePort: jest.fn().mockResolvedValue(8000),
    },
    addSite: {
      addSite: jest.fn(),
    },
  },
});

export class LightningService {
  _site: any;
  port: number | null = null;
  serviceName = 'mock-service';
  binVersion = '1.0.0';
}

export const LightningServicePlatform = {
  Darwin: 'darwin',
  Win32: 'win32',
  Linux: 'linux',
};

export const registerLightningService = jest.fn();
export const addIpcAsyncListener = jest.fn();

export interface AddonMainContext {
  hooks: {
    addAction: jest.Mock;
    addFilter: jest.Mock;
  };
  electron: any;
}
