/**
 * Laravel Site Panel
 *
 * Displays Laravel-specific information and quick actions
 * on the site info overview page for Laravel sites.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import { IPC_CHANNELS, QUICK_ARTISAN_COMMANDS } from '../../common/constants';
import type { LaravelPanelProps, ArtisanResult } from '../../common/types';

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
}

/**
 * LaravelSitePanel component.
 *
 * Displays:
 * - Laravel version and environment info
 * - Quick artisan command buttons
 * - Command output viewer
 */
export class LaravelSitePanel extends React.Component<LaravelPanelProps, State> {
  private ipcRenderer: any;

  constructor(props: LaravelPanelProps) {
    super(props);

    this.state = {
      isRunningCommand: false,
      lastCommandOutput: null,
      lastCommandSuccess: null,
      showOutput: false,
    };

    this.ipcRenderer = getIpcRenderer();
  }

  /**
   * Run an artisan command.
   */
  handleRunCommand = async (command: string): Promise<void> => {
    const { site, siteStatus } = this.props;

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
    const { site, siteStatus } = this.props;
    const { isRunningCommand, lastCommandOutput, lastCommandSuccess, showOutput } = this.state;

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
