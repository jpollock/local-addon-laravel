/**
 * NpmManager - Smart npm detection and execution
 *
 * Provides hybrid npm support:
 * 1. Tries to use system npm when available (user's preferred version)
 * 2. Falls back to bundled npm when system npm not found (guaranteed to work)
 *
 * Based on the pattern from local-addon-node-orchestrator.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as LocalMain from '@getflywheel/local/main';

const execAsync = promisify(exec);

export type NpmType = 'system' | 'bundled';

export interface NpmInfo {
  type: NpmType;
  path: string;
  version?: string;
}

export interface NpmOptions {
  cwd: string;
  onProgress?: (output: string) => void;
  env?: Record<string, string>;
}

export class NpmManager {
  private cachedNpmInfo?: NpmInfo;
  private cachedNpmPath?: string;
  private nodeWrapperDir: string | null = null;
  private logger: any;

  constructor() {
    const services = LocalMain.getServiceContainer().cradle as any;
    this.logger = services.localLogger;
  }

  /**
   * Resolve the full path to system npm executable
   */
  private async resolveSystemNpmPath(): Promise<string | null> {
    try {
      const command = process.platform === 'win32' ? 'where npm' : 'which npm';
      const { stdout } = await execAsync(command, { encoding: 'utf-8', timeout: 3000 });
      const npmPath = stdout.trim().split('\n')[0];

      if (npmPath && fs.existsSync(npmPath)) {
        return npmPath;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect if system npm is available with a compatible Node version (>= 18)
   */
  private async detectSystemNpm(): Promise<boolean> {
    const npmPath = await this.resolveSystemNpmPath();

    if (!npmPath) {
      this.logger.info('[NpmManager] System npm not found in PATH');
      return false;
    }

    // Check Node version that this npm uses
    const nodeVersion = await this.getNodeVersion(npmPath);
    if (!nodeVersion) {
      this.logger.info('[NpmManager] Could not determine Node version for system npm');
      return false;
    }

    // Parse major version (e.g., "v16.15.0" -> 16)
    const majorVersion = parseInt(nodeVersion.replace(/^v/, '').split('.')[0], 10);

    if (majorVersion < 18) {
      this.logger.info(`[NpmManager] System Node v${majorVersion} is too old (requires >= 18), using bundled npm`);
      return false;
    }

    // Node >= 18, verify npm works
    return new Promise((resolve) => {
      const child = spawn(npmPath, ['--version'], {
        shell: false,
        timeout: 3000,
        stdio: 'pipe'
      });

      let version = '';
      child.stdout?.on('data', (data) => {
        version = data.toString().trim();
      });

      child.on('exit', (code) => {
        if (code === 0) {
          this.cachedNpmPath = npmPath;
          this.logger.info(`[NpmManager] Found system npm v${version} with Node ${nodeVersion} at ${npmPath}`);
          resolve(true);
        } else {
          resolve(false);
        }
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Get the Node version that a given npm uses
   */
  private async getNodeVersion(npmPath: string): Promise<string | null> {
    return new Promise((resolve) => {
      // Get the directory of npm, then check for node in same location
      const npmDir = path.dirname(npmPath);
      const nodePath = path.join(npmDir, 'node');

      // Try node in same directory as npm first
      let nodeCmd = fs.existsSync(nodePath) ? nodePath : 'node';

      const child = spawn(nodeCmd, ['--version'], {
        shell: false,
        timeout: 3000,
        stdio: 'pipe'
      });

      let version = '';
      child.stdout?.on('data', (data) => {
        version = data.toString().trim();
      });

      child.on('exit', (code) => {
        if (code === 0 && version) {
          resolve(version);
        } else {
          resolve(null);
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Get path to bundled npm-cli.js
   */
  private getBundledNpmPath(): string | null {
    // Find addon root by looking for package.json
    let currentDir = __dirname;
    const maxDepth = 10;
    let depth = 0;

    while (currentDir !== path.dirname(currentDir) && depth < maxDepth) {
      const pkgPath = path.join(currentDir, 'package.json');

      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

          // Check if this is our addon
          if (pkg.name === '@flavius/local-laravel') {
            const npmCliPath = path.join(currentDir, 'node_modules', 'npm', 'bin', 'npm-cli.js');

            if (fs.existsSync(npmCliPath)) {
              this.logger.info(`[NpmManager] Found bundled npm at ${npmCliPath}`);
              return npmCliPath;
            }

            this.logger.warn(`[NpmManager] Bundled npm not found at ${npmCliPath}`);
            return null;
          }
        } catch {
          // Invalid package.json, continue searching
        }
      }

      currentDir = path.dirname(currentDir);
      depth++;
    }

    this.logger.warn('[NpmManager] Could not find addon root');
    return null;
  }

  /**
   * Create a temporary directory with a 'node' wrapper script
   * that invokes Electron with ELECTRON_RUN_AS_NODE=1.
   *
   * This allows npm's child processes (like Vite) to use Electron's
   * built-in Node.js (v22+) instead of the system Node.
   *
   * Public so that other code (like artisan commands) can use the wrapper PATH.
   */
  async ensureNodeWrapper(): Promise<string> {
    if (this.nodeWrapperDir && fs.existsSync(this.nodeWrapperDir)) {
      return this.nodeWrapperDir;
    }

    const tmpDir = path.join(os.tmpdir(), 'local-laravel-node');
    await fs.ensureDir(tmpDir);

    const isWindows = process.platform === 'win32';
    const nodePath = path.join(tmpDir, isWindows ? 'node.cmd' : 'node');

    if (isWindows) {
      // Windows batch file
      await fs.writeFile(nodePath, `@echo off\nset ELECTRON_RUN_AS_NODE=1\n"${process.execPath}" %*`);
    } else {
      // Unix shell script
      await fs.writeFile(nodePath, `#!/bin/bash\nELECTRON_RUN_AS_NODE=1 exec "${process.execPath}" "$@"`);
      await fs.chmod(nodePath, 0o755);
    }

    this.nodeWrapperDir = tmpDir;
    this.logger.info(`[NpmManager] Created node wrapper at ${nodePath}`);
    return tmpDir;
  }

  /**
   * Get npm information (system or bundled)
   */
  async getNpmInfo(): Promise<NpmInfo> {
    if (this.cachedNpmInfo) {
      return this.cachedNpmInfo;
    }

    // Try system npm first
    const hasSystemNpm = await this.detectSystemNpm();

    if (hasSystemNpm && this.cachedNpmPath) {
      this.cachedNpmInfo = {
        type: 'system',
        path: this.cachedNpmPath
      };
      return this.cachedNpmInfo;
    }

    // Fall back to bundled npm
    this.logger.info('[NpmManager] Falling back to bundled npm...');
    const bundledPath = this.getBundledNpmPath();

    if (bundledPath) {
      this.cachedNpmInfo = {
        type: 'bundled',
        path: bundledPath
      };
      return this.cachedNpmInfo;
    }

    throw new Error(
      'npm not found. Please install Node.js from https://nodejs.org ' +
      'or reinstall this addon to get bundled npm.'
    );
  }

  /**
   * Run npm install
   */
  async install(options: NpmOptions): Promise<void> {
    return this.runCommand(['install'], options);
  }

  /**
   * Run npm command with arguments
   */
  async runCommand(args: string[], options: NpmOptions): Promise<void> {
    const npmInfo = await this.getNpmInfo();

    if (npmInfo.type === 'system') {
      return this.runSystemNpm(args, options);
    } else {
      return this.runBundledNpm(npmInfo.path, args, options);
    }
  }

  /**
   * Execute system npm command
   */
  private runSystemNpm(args: string[], options: NpmOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const npmPath = this.cachedNpmPath;

      if (!npmPath) {
        reject(new Error('System npm path not resolved'));
        return;
      }

      this.logger.info(`[NpmManager] Running: ${npmPath} ${args.join(' ')}`);

      const child = spawn(npmPath, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrOutput = '';

      child.stdout?.on('data', (data) => {
        if (options.onProgress) {
          options.onProgress(data.toString());
        }
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        if (options.onProgress) {
          options.onProgress(output);
        }
        stderrOutput += output;
      });

      child.on('exit', (code) => {
        if (code === 0) {
          this.logger.info(`[NpmManager] npm ${args[0]} completed successfully`);
          resolve();
        } else {
          const error = new Error(`npm ${args.join(' ')} failed with exit code ${code}\n${stderrOutput}`);
          this.logger.error(`[NpmManager] ${error.message}`);
          reject(error);
        }
      });

      child.on('error', (error) => {
        this.logger.error(`[NpmManager] npm error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Execute bundled npm command using Electron as Node.js.
   *
   * Creates a node wrapper script and prepends it to PATH so that
   * child processes (like Vite) use Electron's Node.js instead of system Node.
   */
  private async runBundledNpm(npmCliPath: string, args: string[], options: NpmOptions): Promise<void> {
    // Create node wrapper and prepend to PATH
    const wrapperDir = await this.ensureNodeWrapper();
    const newPath = `${wrapperDir}${path.delimiter}${process.env.PATH || ''}`;

    this.logger.info(`[NpmManager] Running bundled: node ${npmCliPath} ${args.join(' ')}`);
    this.logger.info(`[NpmManager] Node wrapper PATH: ${wrapperDir}`);

    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [npmCliPath, ...args], {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...options.env,
          // Critical: Tell Electron to run as Node.js
          ELECTRON_RUN_AS_NODE: '1',
          // Prepend wrapper to PATH so child processes find our 'node'
          PATH: newPath,
          // Configure npm
          NPM_CONFIG_PREFIX: options.cwd,
          NPM_CONFIG_CACHE: path.join(options.cwd, '.npm-cache'),
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stderrOutput = '';

      child.stdout?.on('data', (data) => {
        if (options.onProgress) {
          options.onProgress(data.toString());
        }
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        if (options.onProgress) {
          options.onProgress(output);
        }
        stderrOutput += output;
      });

      child.on('exit', (code) => {
        if (code === 0) {
          this.logger.info(`[NpmManager] bundled npm ${args[0]} completed successfully`);
          resolve();
        } else {
          const error = new Error(`Bundled npm ${args.join(' ')} failed with exit code ${code}\n${stderrOutput}`);
          this.logger.error(`[NpmManager] ${error.message}`);
          reject(error);
        }
      });

      child.on('error', (error) => {
        this.logger.error(`[NpmManager] bundled npm error: ${error.message}`);
        reject(error);
      });
    });
  }
}

// Export singleton instance
export const npmManager = new NpmManager();
