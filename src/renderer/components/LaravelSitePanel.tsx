/**
 * Laravel Site Panel
 *
 * Displays Laravel-specific information and quick actions
 * on the site info overview page for Laravel sites.
 *
 * Also injects CSS to hide WordPress-specific UI elements.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import { IPC_CHANNELS, QUICK_ARTISAN_COMMANDS } from '../../common/constants';
import type { LaravelPanelProps, ArtisanResult, FailedJob } from '../../common/types';

/**
 * CSS to hide WordPress-specific UI elements for Laravel sites.
 * These selectors target common WordPress-related elements in Local's UI.
 */
const LARAVEL_SITE_CSS = `
  /* Hide WordPress version row in site info */
  .laravel-site [data-testid="wordpress-version"],
  .laravel-site .SiteInfoOverview__WordPressVersion,
  .laravel-site [class*="WordPressVersion"],
  .laravel-site [class*="wordpress-version"] {
    display: none !important;
  }

  /* Hide "Open WP Admin" button for Laravel sites */
  .laravel-site [data-testid="open-wp-admin"],
  .laravel-site button[title*="WP Admin"],
  .laravel-site a[href*="wp-admin"] {
    display: none !important;
  }

  /* Hide WordPress-specific menu items */
  .laravel-site [class*="WPAdmin"],
  .laravel-site [class*="wp-admin"] {
    display: none !important;
  }
`;

// Get ipcRenderer - try multiple methods for Local's environment
const getIpcRenderer = (): any => {
  // Method 1: Try window.require (Electron with nodeIntegration)
  if (typeof (window as any).require === 'function') {
    try {
      return (window as any).require('electron').ipcRenderer;
    } catch (e) {
      // Continue to next method
    }
  }

  // Method 2: Try window.electron (contextBridge exposure)
  if ((window as any).electron?.ipcRenderer) {
    return (window as any).electron.ipcRenderer;
  }

  // Method 3: Try global require
  if (typeof require === 'function') {
    try {
      return require('electron').ipcRenderer;
    } catch (e) {
      // Continue
    }
  }

  return null;
};

interface State {
  isRunningCommand: boolean;
  lastCommandOutput: string | null;
  lastCommandSuccess: boolean | null;
  showOutput: boolean;
  siteStatus: string;
  // Custom command
  customCommand: string;
  commandHistory: string[];
  showHistory: boolean;
  // Log viewer
  showLogs: boolean;
  logs: string;
  isLoadingLogs: boolean;
  autoRefreshLogs: boolean;
  // .env editor
  showEnvEditor: boolean;
  envVariables: Array<{ key: string; value: string; editing?: boolean }>;
  envRaw: string;
  isLoadingEnv: boolean;
  isSavingEnv: boolean;
  envEditMode: 'table' | 'raw';
  // Queue monitor
  showQueueMonitor: boolean;
  failedJobs: FailedJob[];
  isLoadingJobs: boolean;
  processingJobId: string | null;
}

/** Style element ID for Laravel CSS injection */
const LARAVEL_STYLE_ID = 'local-laravel-site-styles';

/**
 * LaravelSitePanel component.
 *
 * Displays:
 * - Laravel version and environment info
 * - Quick artisan command buttons
 * - Command output viewer
 *
 * Also handles:
 * - CSS injection to hide WordPress-specific UI
 * - Adding 'laravel-site' class to parent container
 */
export class LaravelSitePanel extends React.Component<LaravelPanelProps, State> {
  private ipcRenderer: any;
  private observer: MutationObserver | null = null;
  private statusPollInterval: ReturnType<typeof setInterval> | null = null;

  constructor(props: LaravelPanelProps) {
    super(props);

    // Load command history from localStorage
    const savedHistory = this.loadCommandHistory();

    this.state = {
      isRunningCommand: false,
      lastCommandOutput: null,
      lastCommandSuccess: null,
      showOutput: false,
      siteStatus: props.siteStatus || 'unknown',
      // Custom command
      customCommand: '',
      commandHistory: savedHistory,
      showHistory: false,
      // Log viewer
      showLogs: false,
      logs: '',
      isLoadingLogs: false,
      autoRefreshLogs: false,
      // .env editor
      showEnvEditor: false,
      envVariables: [],
      envRaw: '',
      isLoadingEnv: false,
      isSavingEnv: false,
      envEditMode: 'table',
      // Queue monitor
      showQueueMonitor: false,
      failedJobs: [],
      isLoadingJobs: false,
      processingJobId: null,
    };

    this.ipcRenderer = getIpcRenderer();
  }

  /**
   * Load command history from localStorage.
   */
  private loadCommandHistory(): string[] {
    try {
      const saved = localStorage.getItem('local-laravel-command-history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * Save command history to localStorage.
   */
  private saveCommandHistory(history: string[]): void {
    try {
      localStorage.setItem('local-laravel-command-history', JSON.stringify(history.slice(0, 20)));
    } catch {
      // Ignore localStorage errors
    }
  }

  componentDidMount(): void {
    console.log('[LaravelSitePanel] componentDidMount fired');

    // Inject CSS to hide WordPress elements
    this.injectLaravelStyles();

    // Add class to parent container for CSS scoping
    this.addLaravelSiteClass();

    // Start observer to hide WordPress elements as they appear
    this.startWordPressElementObserver();

    // Fetch initial site status
    this.fetchSiteStatus();

    // Poll for site status changes every 2 seconds
    this.statusPollInterval = setInterval(() => {
      this.fetchSiteStatus();
    }, 2000);
  }

  componentWillUnmount(): void {
    // Clean up observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up status polling
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
    }

    // Remove the class when leaving the site
    this.removeLaravelSiteClass();

    // Show WordPress elements again when leaving
    this.showWordPressElements();
  }

  /**
   * Fetch site status from main process.
   */
  private async fetchSiteStatus(): Promise<void> {
    if (!this.ipcRenderer) return;

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.GET_SITE_STATUS, {
        siteId: this.props.site.id,
      });

      if (response.success && response.status !== this.state.siteStatus) {
        this.setState({ siteStatus: response.status });
      }
    } catch (error) {
      console.warn('[LaravelSitePanel] Failed to fetch site status:', error);
    }
  }

  /**
   * Start a MutationObserver to watch for WordPress elements and hide them.
   * This handles the timing issue where elements render after our component mounts.
   */
  private startWordPressElementObserver(): void {
    // Initial attempt (in case elements already exist)
    this.hideWordPressElements();

    // Watch for new elements being added to the DOM
    this.observer = new MutationObserver(() => {
      this.hideWordPressElements();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Stop observing after 3 seconds (page should be stable by then)
    setTimeout(() => {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
        console.log('[LaravelSitePanel] Observer disconnected after timeout');
      }
    }, 3000);
  }

  /**
   * Inject CSS styles to hide WordPress-specific UI.
   */
  private injectLaravelStyles(): void {
    // Only inject once
    if (document.getElementById(LARAVEL_STYLE_ID)) {
      return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = LARAVEL_STYLE_ID;
    styleEl.textContent = LARAVEL_SITE_CSS;
    document.head.appendChild(styleEl);
  }

  /**
   * Add 'laravel-site' class to the site info container.
   */
  private addLaravelSiteClass(): void {
    // Find the main site info container and add our class
    const siteInfoContainer = document.querySelector('[class*="SiteInfo"]') ||
      document.querySelector('[class*="site-info"]') ||
      document.querySelector('main');

    if (siteInfoContainer) {
      siteInfoContainer.classList.add('laravel-site');
    }
  }

  /**
   * Remove 'laravel-site' class when leaving.
   */
  private removeLaravelSiteClass(): void {
    const containers = document.querySelectorAll('.laravel-site');
    containers.forEach((el) => el.classList.remove('laravel-site'));
  }

  /**
   * Hide WordPress-specific elements by finding them via text content.
   */
  private hideWordPressElements(): void {
    // WordPress-specific labels to hide (case-insensitive)
    const labelsToHide = [
      'wordpress version',
      'one-click admin',
      'multisite',
    ];

    // Find and hide rows containing WordPress-specific labels
    const allStrong = document.querySelectorAll('strong');

    allStrong.forEach((el) => {
      const text = el.textContent?.toLowerCase() || '';

      for (const label of labelsToHide) {
        if (text.includes(label)) {
          // Hide the parent TableListRow
          const row = el.closest('li') || el.closest('[class*="TableListRow"]');
          if (row && !(row as HTMLElement).hasAttribute('data-hidden-by-laravel')) {
            console.log('[LaravelSitePanel] Hiding row:', label);
            (row as HTMLElement).style.display = 'none';
            (row as HTMLElement).setAttribute('data-hidden-by-laravel', 'true');
          }
          break;
        }
      }
    });

    // Find and hide "Open WP Admin" or similar buttons
    const allButtons = document.querySelectorAll('button, a');
    allButtons.forEach((el) => {
      // Skip if already hidden
      if ((el as HTMLElement).hasAttribute('data-hidden-by-laravel')) {
        return;
      }

      const text = el.textContent?.toLowerCase() || '';
      const title = el.getAttribute('title')?.toLowerCase() || '';

      if (text.includes('wp admin') || text.includes('wordpress') ||
          text.includes('one-click admin') ||
          title.includes('wp admin') || title.includes('wordpress')) {
        console.log('[LaravelSitePanel] Hiding button:', text || title);
        (el as HTMLElement).style.display = 'none';
        (el as HTMLElement).setAttribute('data-hidden-by-laravel', 'true');
      }
    });
  }

  /**
   * Show WordPress elements that were hidden.
   */
  private showWordPressElements(): void {
    const hiddenElements = document.querySelectorAll('[data-hidden-by-laravel="true"]');
    hiddenElements.forEach((el) => {
      (el as HTMLElement).style.display = '';
      el.removeAttribute('data-hidden-by-laravel');
    });
  }

  /**
   * Run an artisan command.
   */
  handleRunCommand = async (command: string): Promise<void> => {
    const { site } = this.props;
    const { siteStatus } = this.state;

    if (siteStatus !== 'running') {
      this.setState({
        lastCommandOutput: 'Error: Site must be running to execute artisan commands.',
        lastCommandSuccess: false,
        showOutput: true,
      });
      return;
    }

    if (!this.ipcRenderer) {
      this.setState({
        lastCommandOutput: 'Error: Unable to communicate with Local.',
        lastCommandSuccess: false,
        showOutput: true,
      });
      return;
    }

    this.setState({
      isRunningCommand: true,
      lastCommandOutput: null,
      showOutput: true,
    });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.RUN_ARTISAN, {
        siteId: site.id,
        command: command.split(' '),
      });

      const result: ArtisanResult = response.data;

      this.setState({
        isRunningCommand: false,
        lastCommandOutput: result.output,
        lastCommandSuccess: result.success,
      });
    } catch (error: any) {
      this.setState({
        isRunningCommand: false,
        lastCommandOutput: error.message || 'Failed to run command',
        lastCommandSuccess: false,
      });
    }
  };

  /**
   * Toggle output visibility.
   */
  handleToggleOutput = (): void => {
    this.setState((state) => ({ showOutput: !state.showOutput }));
  };

  /**
   * Clear command output.
   */
  handleClearOutput = (): void => {
    this.setState({
      lastCommandOutput: null,
      lastCommandSuccess: null,
      showOutput: false,
    });
  };

  /**
   * Handle custom command input change.
   */
  handleCustomCommandChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({ customCommand: e.target.value });
  };

  /**
   * Run custom artisan command.
   */
  handleRunCustomCommand = async (): Promise<void> => {
    const { customCommand, commandHistory } = this.state;
    const trimmedCommand = customCommand.trim();

    if (!trimmedCommand) return;

    // Add to history (avoid duplicates at top)
    const newHistory = [trimmedCommand, ...commandHistory.filter((c) => c !== trimmedCommand)].slice(0, 20);
    this.setState({ commandHistory: newHistory, customCommand: '', showHistory: false });
    this.saveCommandHistory(newHistory);

    // Run the command
    await this.handleRunCommand(trimmedCommand);
  };

  /**
   * Handle key press in custom command input.
   */
  handleCustomCommandKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      this.handleRunCustomCommand();
    }
  };

  /**
   * Select a command from history.
   */
  handleSelectFromHistory = (command: string): void => {
    this.setState({ customCommand: command, showHistory: false });
  };

  /**
   * Toggle log viewer visibility.
   */
  handleToggleLogs = async (): Promise<void> => {
    const { showLogs } = this.state;

    if (!showLogs) {
      // Opening logs, fetch them
      await this.fetchLogs();
    }

    this.setState({ showLogs: !showLogs });
  };

  /**
   * Fetch Laravel logs from the site.
   */
  fetchLogs = async (): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ isLoadingLogs: true });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.GET_LARAVEL_LOGS, {
        siteId: this.props.site.id,
        lines: 200,
      });

      if (response.success) {
        this.setState({ logs: response.logs || 'No logs found', isLoadingLogs: false });
      } else {
        this.setState({ logs: response.error || 'Failed to load logs', isLoadingLogs: false });
      }
    } catch (error: any) {
      this.setState({ logs: error.message || 'Failed to load logs', isLoadingLogs: false });
    }
  };

  /**
   * Toggle auto-refresh for logs.
   */
  handleToggleAutoRefresh = (): void => {
    this.setState((state) => ({ autoRefreshLogs: !state.autoRefreshLogs }));
  };

  /**
   * Toggle .env editor visibility.
   */
  handleToggleEnvEditor = async (): Promise<void> => {
    const { showEnvEditor } = this.state;

    if (!showEnvEditor) {
      // Opening editor, fetch env file
      await this.fetchEnv();
    }

    this.setState({ showEnvEditor: !showEnvEditor });
  };

  /**
   * Fetch .env file contents.
   */
  fetchEnv = async (): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ isLoadingEnv: true });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.GET_ENV, {
        siteId: this.props.site.id,
      });

      if (response.success) {
        this.setState({
          envVariables: response.variables || [],
          envRaw: response.raw || '',
          isLoadingEnv: false,
        });
      } else {
        this.setState({
          envRaw: response.error || 'Failed to load .env',
          isLoadingEnv: false,
        });
      }
    } catch (error: any) {
      this.setState({
        envRaw: error.message || 'Failed to load .env',
        isLoadingEnv: false,
      });
    }
  };

  /**
   * Save .env file.
   */
  handleSaveEnv = async (): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ isSavingEnv: true });

    try {
      const { envRaw } = this.state;

      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.UPDATE_ENV, {
        siteId: this.props.site.id,
        content: envRaw,
      });

      if (response.success) {
        // Refresh the env to show saved state
        await this.fetchEnv();
        this.setState({
          isSavingEnv: false,
          lastCommandOutput: '.env file saved successfully',
          lastCommandSuccess: true,
          showOutput: true,
        });
      } else {
        this.setState({
          isSavingEnv: false,
          lastCommandOutput: response.error || 'Failed to save .env',
          lastCommandSuccess: false,
          showOutput: true,
        });
      }
    } catch (error: any) {
      this.setState({
        isSavingEnv: false,
        lastCommandOutput: error.message || 'Failed to save .env',
        lastCommandSuccess: false,
        showOutput: true,
      });
    }
  };

  /**
   * Handle .env raw content change.
   */
  handleEnvRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    this.setState({ envRaw: e.target.value });
  };

  /**
   * Toggle .env edit mode between table and raw.
   */
  handleToggleEnvEditMode = (): void => {
    this.setState((state) => ({
      envEditMode: state.envEditMode === 'table' ? 'raw' : 'table',
    }));
  };

  /**
   * Toggle queue monitor visibility.
   */
  handleToggleQueueMonitor = async (): Promise<void> => {
    const { showQueueMonitor } = this.state;

    if (!showQueueMonitor) {
      // Opening monitor, fetch failed jobs
      await this.fetchFailedJobs();
    }

    this.setState({ showQueueMonitor: !showQueueMonitor });
  };

  /**
   * Fetch failed jobs from the queue.
   */
  fetchFailedJobs = async (): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ isLoadingJobs: true });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.GET_FAILED_JOBS, {
        siteId: this.props.site.id,
      });

      if (response.success) {
        this.setState({ failedJobs: response.jobs || [], isLoadingJobs: false });
      } else {
        this.setState({
          failedJobs: [],
          isLoadingJobs: false,
          lastCommandOutput: response.error || 'Failed to load queue',
          lastCommandSuccess: false,
          showOutput: true,
        });
      }
    } catch (error: any) {
      this.setState({
        failedJobs: [],
        isLoadingJobs: false,
        lastCommandOutput: error.message || 'Failed to load queue',
        lastCommandSuccess: false,
        showOutput: true,
      });
    }
  };

  /**
   * Retry a failed job.
   */
  handleRetryJob = async (jobId: string): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ processingJobId: jobId });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.RETRY_JOB, {
        siteId: this.props.site.id,
        jobId,
      });

      if (response.success) {
        this.setState({
          lastCommandOutput: response.message || `Job ${jobId} pushed back to queue`,
          lastCommandSuccess: true,
          showOutput: true,
        });
        // Refresh the list
        await this.fetchFailedJobs();
      } else {
        this.setState({
          lastCommandOutput: response.error || 'Failed to retry job',
          lastCommandSuccess: false,
          showOutput: true,
        });
      }
    } catch (error: any) {
      this.setState({
        lastCommandOutput: error.message || 'Failed to retry job',
        lastCommandSuccess: false,
        showOutput: true,
      });
    } finally {
      this.setState({ processingJobId: null });
    }
  };

  /**
   * Retry all failed jobs.
   */
  handleRetryAllJobs = async (): Promise<void> => {
    await this.handleRetryJob('all');
  };

  /**
   * Delete (forget) a failed job.
   */
  handleForgetJob = async (jobId: string): Promise<void> => {
    if (!this.ipcRenderer) return;

    this.setState({ processingJobId: jobId });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.FORGET_JOB, {
        siteId: this.props.site.id,
        jobId,
      });

      if (response.success) {
        this.setState({
          lastCommandOutput: response.message || 'Job deleted',
          lastCommandSuccess: true,
          showOutput: true,
        });
        // Refresh the list
        await this.fetchFailedJobs();
      } else {
        this.setState({
          lastCommandOutput: response.error || 'Failed to delete job',
          lastCommandSuccess: false,
          showOutput: true,
        });
      }
    } catch (error: any) {
      this.setState({
        lastCommandOutput: error.message || 'Failed to delete job',
        lastCommandSuccess: false,
        showOutput: true,
      });
    } finally {
      this.setState({ processingJobId: null });
    }
  };

  /**
   * Flush all failed jobs.
   */
  handleFlushAllJobs = async (): Promise<void> => {
    if (!this.ipcRenderer) return;

    // Confirm before flushing
    if (!confirm('Are you sure you want to delete ALL failed jobs? This cannot be undone.')) {
      return;
    }

    this.setState({ processingJobId: 'flush' });

    try {
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.FLUSH_JOBS, {
        siteId: this.props.site.id,
      });

      if (response.success) {
        this.setState({
          lastCommandOutput: response.message || 'All failed jobs deleted',
          lastCommandSuccess: true,
          showOutput: true,
          failedJobs: [],
        });
      } else {
        this.setState({
          lastCommandOutput: response.error || 'Failed to flush jobs',
          lastCommandSuccess: false,
          showOutput: true,
        });
      }
    } catch (error: any) {
      this.setState({
        lastCommandOutput: error.message || 'Failed to flush jobs',
        lastCommandSuccess: false,
        showOutput: true,
      });
    } finally {
      this.setState({ processingJobId: null });
    }
  };

  render(): React.ReactNode {
    const { site } = this.props;
    const {
      isRunningCommand,
      lastCommandOutput,
      lastCommandSuccess,
      showOutput,
      siteStatus,
      customCommand,
      commandHistory,
      showHistory,
      showLogs,
      logs,
      isLoadingLogs,
      showEnvEditor,
      envRaw,
      isLoadingEnv,
      isSavingEnv,
      showQueueMonitor,
      failedJobs,
      isLoadingJobs,
      processingJobId,
    } = this.state;

    const customOptions = site.customOptions || {};
    const laravelVersion = customOptions.laravelVersion || 'Unknown';
    const starterKit = customOptions.starterKit || 'none';
    const breezeStack = customOptions.breezeStack;
    const jetstreamStack = customOptions.jetstreamStack;
    const jetstreamTeams = customOptions.jetstreamTeams;
    const jetstreamApi = customOptions.jetstreamApi;
    const isRunning = siteStatus === 'running';

    // Build starter kit display string
    let starterKitDisplay = '';
    if (starterKit === 'breeze' && breezeStack) {
      starterKitDisplay = `Breeze (${breezeStack})`;
    } else if (starterKit === 'jetstream' && jetstreamStack) {
      const features: string[] = [];
      if (jetstreamTeams) features.push('teams');
      if (jetstreamApi) features.push('API');
      starterKitDisplay = `Jetstream (${jetstreamStack}${features.length ? ' + ' + features.join(', ') : ''})`;
    } else if (starterKit !== 'none') {
      starterKitDisplay = String(starterKit);
    }

    return React.createElement(
      'div',
      {
        style: {
          marginTop: '24px',
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        },
      },
      // Header
      React.createElement(
        'div',
        {
          style: {
            padding: '16px 20px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        },
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          // Laravel Logo
          React.createElement(
            'div',
            {
              style: {
                width: '32px',
                height: '32px',
                backgroundColor: '#f55247',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '14px',
              },
            },
            'L'
          ),
          React.createElement(
            'div',
            {},
            React.createElement(
              'h3',
              {
                style: {
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1a1a1a',
                },
              },
              'Laravel'
            ),
            React.createElement(
              'p',
              {
                style: {
                  margin: 0,
                  fontSize: '12px',
                  color: '#666',
                },
              },
              `Version ${laravelVersion}${starterKitDisplay ? ` with ${starterKitDisplay}` : ''}`
            )
          )
        ),
        // Status Badge
        React.createElement(
          'span',
          {
            style: {
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              backgroundColor: isRunning ? '#c6f6d5' : '#fed7d7',
              color: isRunning ? '#22543d' : '#742a2a',
              borderRadius: '4px',
            },
          },
          isRunning ? 'Running' : 'Stopped'
        )
      ),

      // Quick Commands Section
      React.createElement(
        'div',
        { style: { padding: '16px 20px' } },
        React.createElement(
          'h4',
          {
            style: {
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: 500,
              color: '#666',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            },
          },
          'Quick Commands'
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            },
          },
          QUICK_ARTISAN_COMMANDS.map((cmd) => {
            const isDangerous = 'dangerous' in cmd && cmd.dangerous;
            return React.createElement(
              'button',
              {
                key: cmd.command,
                onClick: () => this.handleRunCommand(cmd.command),
                disabled: !isRunning || isRunningCommand,
                title: cmd.description,
                style: {
                  padding: '10px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: isDangerous ? '#c53030' : '#333',
                  backgroundColor: '#f8f9fa',
                  border: isDangerous ? '1px solid #fed7d7' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  cursor: isRunning && !isRunningCommand ? 'pointer' : 'not-allowed',
                  opacity: isRunning ? 1 : 0.5,
                  transition: 'background-color 0.2s',
                },
                onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
                  if (isRunning && !isRunningCommand) {
                    e.currentTarget.style.backgroundColor = isDangerous ? '#fed7d7' : '#e5e7eb';
                  }
                },
                onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                },
              },
              cmd.label
            );
          })
        )
      ),

      // Custom Command Section
      React.createElement(
        'div',
        {
          style: {
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
          },
        },
        React.createElement(
          'h4',
          {
            style: {
              margin: '0 0 12px 0',
              fontSize: '12px',
              fontWeight: 500,
              color: '#666',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            },
          },
          'Custom Command'
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              gap: '8px',
              position: 'relative' as const,
            },
          },
          React.createElement('input', {
            type: 'text',
            placeholder: 'e.g., make:model User -m',
            value: customCommand,
            onChange: this.handleCustomCommandChange,
            onKeyPress: this.handleCustomCommandKeyPress,
            onFocus: () => this.setState({ showHistory: true }),
            onBlur: () => setTimeout(() => this.setState({ showHistory: false }), 200),
            disabled: !isRunning || isRunningCommand,
            style: {
              flex: 1,
              padding: '10px 12px',
              fontSize: '13px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              outline: 'none',
              backgroundColor: isRunning ? '#fff' : '#f8f9fa',
            },
          }),
          React.createElement(
            'button',
            {
              onClick: this.handleRunCustomCommand,
              disabled: !isRunning || isRunningCommand || !customCommand.trim(),
              style: {
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: isRunning && customCommand.trim() ? '#f55247' : '#ccc',
                border: 'none',
                borderRadius: '6px',
                cursor: isRunning && customCommand.trim() ? 'pointer' : 'not-allowed',
              },
            },
            'Run'
          )
        ),
        // Command history dropdown
        showHistory && commandHistory.length > 0 &&
          React.createElement(
            'div',
            {
              style: {
                marginTop: '4px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                backgroundColor: '#fff',
                maxHeight: '150px',
                overflow: 'auto',
              },
            },
            commandHistory.slice(0, 10).map((cmd, index) =>
              React.createElement(
                'div',
                {
                  key: index,
                  onClick: () => this.handleSelectFromHistory(cmd),
                  style: {
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontFamily: 'Monaco, Menlo, monospace',
                    cursor: 'pointer',
                    borderBottom: index < commandHistory.length - 1 ? '1px solid #f0f0f0' : 'none',
                  },
                  onMouseOver: (e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  },
                  onMouseOut: (e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                  },
                },
                cmd
              )
            )
          )
      ),

      // Log Viewer Section
      React.createElement(
        'div',
        {
          style: {
            borderTop: '1px solid #e5e7eb',
          },
        },
        React.createElement(
          'div',
          {
            onClick: this.handleToggleLogs,
            style: {
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            },
          },
          React.createElement(
            'h4',
            {
              style: {
                margin: 0,
                fontSize: '12px',
                fontWeight: 500,
                color: '#666',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              },
            },
            React.createElement('span', {}, showLogs ? '▼' : '▶'),
            'View Logs'
          ),
          React.createElement(
            'button',
            {
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                this.fetchLogs();
              },
              disabled: isLoadingLogs,
              style: {
                padding: '4px 8px',
                fontSize: '11px',
                color: '#666',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e5e7eb',
                borderRadius: '4px',
                cursor: 'pointer',
              },
            },
            isLoadingLogs ? 'Loading...' : 'Refresh'
          )
        ),
        showLogs &&
          React.createElement(
            'div',
            {
              style: {
                padding: '0 20px 16px 20px',
              },
            },
            React.createElement(
              'pre',
              {
                style: {
                  margin: 0,
                  padding: '12px',
                  fontSize: '11px',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  backgroundColor: '#1a1a1a',
                  color: '#e5e7eb',
                  borderRadius: '6px',
                  maxHeight: '300px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                },
              },
              logs || 'No logs available'
            )
          )
      ),

      // .env Editor Section
      React.createElement(
        'div',
        {
          style: {
            borderTop: '1px solid #e5e7eb',
          },
        },
        React.createElement(
          'div',
          {
            onClick: this.handleToggleEnvEditor,
            style: {
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            },
          },
          React.createElement(
            'h4',
            {
              style: {
                margin: 0,
                fontSize: '12px',
                fontWeight: 500,
                color: '#666',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              },
            },
            React.createElement('span', {}, showEnvEditor ? '▼' : '▶'),
            'Edit .env'
          ),
          showEnvEditor &&
            React.createElement(
              'button',
              {
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  this.handleSaveEnv();
                },
                disabled: isSavingEnv || isLoadingEnv,
                style: {
                  padding: '4px 12px',
                  fontSize: '11px',
                  color: '#fff',
                  backgroundColor: isSavingEnv ? '#ccc' : '#f55247',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSavingEnv ? 'not-allowed' : 'pointer',
                },
              },
              isSavingEnv ? 'Saving...' : 'Save'
            )
        ),
        showEnvEditor &&
          React.createElement(
            'div',
            {
              style: {
                padding: '0 20px 16px 20px',
              },
            },
            isLoadingEnv
              ? React.createElement(
                  'div',
                  { style: { padding: '20px', textAlign: 'center' as const, color: '#666' } },
                  'Loading .env...'
                )
              : React.createElement('textarea', {
                  value: envRaw,
                  onChange: this.handleEnvRawChange,
                  style: {
                    width: '100%',
                    minHeight: '200px',
                    padding: '12px',
                    fontSize: '12px',
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    resize: 'vertical' as const,
                    outline: 'none',
                  },
                })
          )
      ),

      // Queue Monitor Section
      React.createElement(
        'div',
        {
          style: {
            borderTop: '1px solid #e5e7eb',
          },
        },
        React.createElement(
          'div',
          {
            onClick: this.handleToggleQueueMonitor,
            style: {
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            },
          },
          React.createElement(
            'h4',
            {
              style: {
                margin: 0,
                fontSize: '12px',
                fontWeight: 500,
                color: '#666',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              },
            },
            React.createElement('span', {}, showQueueMonitor ? '▼' : '▶'),
            'Queue Monitor',
            failedJobs.length > 0 &&
              React.createElement(
                'span',
                {
                  style: {
                    padding: '2px 6px',
                    fontSize: '10px',
                    backgroundColor: '#fed7d7',
                    color: '#c53030',
                    borderRadius: '10px',
                    fontWeight: 600,
                  },
                },
                failedJobs.length
              )
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: '8px' } },
            showQueueMonitor && failedJobs.length > 0 &&
              React.createElement(
                'button',
                {
                  onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    this.handleRetryAllJobs();
                  },
                  disabled: isLoadingJobs || processingJobId !== null,
                  style: {
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#fff',
                    backgroundColor: processingJobId ? '#ccc' : '#48bb78',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: processingJobId ? 'not-allowed' : 'pointer',
                  },
                },
                'Retry All'
              ),
            React.createElement(
              'button',
              {
                onClick: (e: React.MouseEvent) => {
                  e.stopPropagation();
                  this.fetchFailedJobs();
                },
                disabled: isLoadingJobs,
                style: {
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: '#666',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  cursor: 'pointer',
                },
              },
              isLoadingJobs ? 'Loading...' : 'Refresh'
            )
          )
        ),
        showQueueMonitor &&
          React.createElement(
            'div',
            {
              style: {
                padding: '0 20px 16px 20px',
              },
            },
            isLoadingJobs
              ? React.createElement(
                  'div',
                  { style: { padding: '20px', textAlign: 'center' as const, color: '#666' } },
                  'Loading failed jobs...'
                )
              : failedJobs.length === 0
              ? React.createElement(
                  'div',
                  {
                    style: {
                      padding: '20px',
                      textAlign: 'center' as const,
                      color: '#48bb78',
                      backgroundColor: '#f0fff4',
                      borderRadius: '6px',
                      border: '1px solid #c6f6d5',
                    },
                  },
                  '✓ No failed jobs'
                )
              : React.createElement(
                  'div',
                  {},
                  // Jobs table
                  React.createElement(
                    'table',
                    {
                      style: {
                        width: '100%',
                        borderCollapse: 'collapse' as const,
                        fontSize: '12px',
                      },
                    },
                    React.createElement(
                      'thead',
                      {},
                      React.createElement(
                        'tr',
                        {
                          style: {
                            backgroundColor: '#f8f9fa',
                            borderBottom: '1px solid #e5e7eb',
                          },
                        },
                        React.createElement('th', { style: { padding: '8px 12px', textAlign: 'left' as const, fontWeight: 500 } }, 'ID'),
                        React.createElement('th', { style: { padding: '8px 12px', textAlign: 'left' as const, fontWeight: 500 } }, 'Queue'),
                        React.createElement('th', { style: { padding: '8px 12px', textAlign: 'left' as const, fontWeight: 500 } }, 'Failed At'),
                        React.createElement('th', { style: { padding: '8px 12px', textAlign: 'right' as const, fontWeight: 500 } }, 'Actions')
                      )
                    ),
                    React.createElement(
                      'tbody',
                      {},
                      failedJobs.map((job) =>
                        React.createElement(
                          'tr',
                          {
                            key: job.id,
                            style: {
                              borderBottom: '1px solid #f0f0f0',
                            },
                          },
                          React.createElement(
                            'td',
                            {
                              style: {
                                padding: '8px 12px',
                                fontFamily: 'Monaco, Menlo, monospace',
                              },
                            },
                            job.id
                          ),
                          React.createElement(
                            'td',
                            { style: { padding: '8px 12px' } },
                            job.queue
                          ),
                          React.createElement(
                            'td',
                            {
                              style: {
                                padding: '8px 12px',
                                color: '#666',
                                fontSize: '11px',
                              },
                            },
                            job.failedAt
                          ),
                          React.createElement(
                            'td',
                            {
                              style: {
                                padding: '8px 12px',
                                textAlign: 'right' as const,
                              },
                            },
                            React.createElement(
                              'button',
                              {
                                onClick: () => this.handleRetryJob(job.id),
                                disabled: processingJobId !== null,
                                style: {
                                  padding: '4px 8px',
                                  fontSize: '10px',
                                  color: '#fff',
                                  backgroundColor: processingJobId === job.id ? '#ccc' : '#48bb78',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: processingJobId ? 'not-allowed' : 'pointer',
                                  marginRight: '4px',
                                },
                              },
                              processingJobId === job.id ? '...' : 'Retry'
                            ),
                            React.createElement(
                              'button',
                              {
                                onClick: () => this.handleForgetJob(job.id),
                                disabled: processingJobId !== null,
                                style: {
                                  padding: '4px 8px',
                                  fontSize: '10px',
                                  color: '#c53030',
                                  backgroundColor: '#fff',
                                  border: '1px solid #fed7d7',
                                  borderRadius: '3px',
                                  cursor: processingJobId ? 'not-allowed' : 'pointer',
                                },
                              },
                              'Delete'
                            )
                          )
                        )
                      )
                    )
                  ),
                  // Flush all button
                  failedJobs.length > 1 &&
                    React.createElement(
                      'div',
                      {
                        style: {
                          marginTop: '12px',
                          textAlign: 'center' as const,
                        },
                      },
                      React.createElement(
                        'button',
                        {
                          onClick: this.handleFlushAllJobs,
                          disabled: processingJobId !== null,
                          style: {
                            padding: '6px 12px',
                            fontSize: '11px',
                            color: '#c53030',
                            backgroundColor: '#fff',
                            border: '1px solid #fed7d7',
                            borderRadius: '4px',
                            cursor: processingJobId ? 'not-allowed' : 'pointer',
                          },
                        },
                        processingJobId === 'flush' ? 'Deleting...' : 'Flush All Failed Jobs'
                      )
                    )
                )
          )
      ),

      // Output Section (conditional)
      (showOutput || lastCommandOutput) &&
        React.createElement(
          'div',
          {
            style: {
              borderTop: '1px solid #e5e7eb',
              padding: '16px 20px',
            },
          },
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px',
              },
            },
            React.createElement(
              'h4',
              {
                style: {
                  margin: 0,
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#666',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.5px',
                },
              },
              isRunningCommand ? 'Running...' : 'Output'
            ),
            !isRunningCommand &&
              lastCommandOutput &&
              React.createElement(
                'button',
                {
                  onClick: this.handleClearOutput,
                  style: {
                    padding: '4px 8px',
                    fontSize: '11px',
                    color: '#666',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  },
                },
                'Clear'
              )
          ),
          React.createElement(
            'div',
            {
              style: {
                backgroundColor: lastCommandSuccess === false ? '#fff5f5' : '#f8f9fa',
                border: `1px solid ${lastCommandSuccess === false ? '#fed7d7' : '#e5e7eb'}`,
                borderRadius: '6px',
                padding: '12px',
                maxHeight: '200px',
                overflow: 'auto',
              },
            },
            isRunningCommand
              ? React.createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#666',
                    },
                  },
                  React.createElement(
                    'span',
                    {
                      style: {
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        border: '2px solid #e5e7eb',
                        borderTopColor: '#f55247',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      },
                    }
                  ),
                  'Executing command...'
                )
              : React.createElement(
                  'pre',
                  {
                    style: {
                      margin: 0,
                      fontSize: '11px',
                      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: lastCommandSuccess === false ? '#c53030' : '#333',
                    },
                  },
                  lastCommandOutput || 'No output'
                )
          )
        )
    );
  }
}
