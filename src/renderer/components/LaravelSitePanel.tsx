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
import type { LaravelPanelProps, ArtisanResult } from '../../common/types';

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

    this.state = {
      isRunningCommand: false,
      lastCommandOutput: null,
      lastCommandSuccess: null,
      showOutput: false,
      siteStatus: props.siteStatus || 'unknown',
    };

    this.ipcRenderer = getIpcRenderer();
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

  render(): React.ReactNode {
    const { site } = this.props;
    const { isRunningCommand, lastCommandOutput, lastCommandSuccess, showOutput, siteStatus } = this.state;

    const customOptions = site.customOptions || {};
    const laravelVersion = customOptions.laravelVersion || 'Unknown';
    const starterKit = customOptions.starterKit || 'none';
    const isRunning = siteStatus === 'running';

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
              `Version ${laravelVersion}${starterKit !== 'none' ? ` with ${starterKit}` : ''}`
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
