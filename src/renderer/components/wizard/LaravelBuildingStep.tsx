/**
 * Laravel Building Step
 *
 * Final step of the Laravel site creation wizard.
 * Shows progress during site provisioning and Laravel installation.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import type { WizardStepProps, CreationProgress } from '../../../common/types';
import { IPC_CHANNELS, CREATION_STAGES } from '../../../common/constants';
import { getThemeColors, onThemeChange, type ThemeColors } from '../../../common/theme';

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
  progress: number;
  stage: string;
  message: string;
  error: string | null;
  isComplete: boolean;
  siteId: string | null;
  themeColors: ThemeColors;
}

/**
 * LaravelBuildingStep component.
 *
 * Initiates site creation and displays real-time progress.
 * On completion, navigates to the new site's overview.
 */
export class LaravelBuildingStep extends React.Component<WizardStepProps, State> {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private ipcRenderer: any;
  private themeCleanup: (() => void) | null = null;

  constructor(props: WizardStepProps) {
    super(props);

    this.state = {
      progress: 0,
      stage: 'INITIALIZING',
      message: CREATION_STAGES.INITIALIZING.message,
      error: null,
      isComplete: false,
      siteId: null,
      themeColors: getThemeColors(),
    };

    // Get ipcRenderer
    this.ipcRenderer = getIpcRenderer();
  }

  componentDidMount(): void {
    this.themeCleanup = onThemeChange(() => {
      this.setState({ themeColors: getThemeColors() });
    });
    this.startSiteCreation();
  }

  componentWillUnmount(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.themeCleanup) {
      this.themeCleanup();
      this.themeCleanup = null;
    }
  }

  /**
   * Start the site creation process.
   */
  async startSiteCreation(): Promise<void> {
    const { siteSettings } = this.props;

    // Check if ipcRenderer is available
    if (!this.ipcRenderer) {
      this.setState({
        error: 'Unable to communicate with Local (ipcRenderer not available)',
        progress: 0,
      });
      return;
    }

    try {
      // Invoke site creation via IPC
      const response = await this.ipcRenderer.invoke(
        IPC_CHANNELS.CREATE_SITE,
        {
          siteName: siteSettings.siteName,
          siteDomain: siteSettings.siteDomain,
          sitePath: siteSettings.sitePath,
          laravelVersion: siteSettings.laravelVersion || '11',
          phpVersion: siteSettings.phpVersion || '8.3',
          starterKit: siteSettings.starterKit || 'none',
          breezeStack: siteSettings.breezeStack,
          jetstreamStack: siteSettings.jetstreamStack,
          jetstreamTeams: siteSettings.jetstreamTeams,
          jetstreamApi: siteSettings.jetstreamApi,
        }
      );

      if (response.success) {
        this.setState({
          siteId: response.siteId,
        });

        // Start polling for progress
        this.startProgressPolling(response.siteId);
      } else {
        this.setState({
          error: response.error || 'Failed to start site creation',
          progress: 0,
        });
      }
    } catch (err: any) {
      this.setState({
        error: err.message || 'Failed to communicate with Local',
        progress: 0,
      });
    }
  }

  /**
   * Poll for creation progress updates.
   */
  startProgressPolling(siteId: string): void {
    if (!this.ipcRenderer) return;

    this.pollInterval = setInterval(async () => {
      try {
        const status = await this.ipcRenderer.invoke(
          IPC_CHANNELS.GET_CREATION_STATUS,
          { siteId }
        );

        if (status) {
          this.updateProgress(status);

          // Stop polling when complete or error
          if (status.progress >= 100 || status.error) {
            if (this.pollInterval) {
              clearInterval(this.pollInterval);
              this.pollInterval = null;
            }
          }
        }
      } catch (err) {
        // Polling error - continue trying
        console.warn('[LaravelBuildingStep] Poll error:', err);
      }
    }, 500);
  }

  /**
   * Update progress state from poll response.
   */
  updateProgress(status: CreationProgress): void {
    this.setState({
      progress: status.progress,
      stage: status.stage,
      message: status.message,
      error: status.error || null,
      isComplete: status.progress >= 100,
    });
  }

  /**
   * Navigate to the created site.
   */
  handleViewSite = (): void => {
    const { siteId } = this.state;

    if (siteId) {
      // Navigate to site overview in Local
      window.location.hash = `#/main/site-info/${siteId}`;
    }
  };

  /**
   * Retry site creation after error.
   */
  handleRetry = (): void => {
    this.setState({
      progress: 0,
      stage: 'INITIALIZING',
      message: CREATION_STAGES.INITIALIZING.message,
      error: null,
      isComplete: false,
      siteId: null,
    });

    this.startSiteCreation();
  };

  /**
   * Go back to configuration step.
   */
  handleBack = (): void => {
    this.props.history.goBack();
  };

  render(): React.ReactNode {
    const { progress, message, error, isComplete, themeColors } = this.state;
    const colors = themeColors;

    // Determine icon background color based on state
    const getIconBg = () => {
      if (error) return colors.errorBg;
      if (isComplete) return colors.successBg;
      // Light pink for in-progress state
      return colors.panelBgSecondary;
    };

    return React.createElement(
      'div',
      {
        style: {
          padding: '60px 40px',
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center' as const,
        },
      },
      // Laravel Logo / Icon
      React.createElement(
        'div',
        {
          style: {
            width: '80px',
            height: '80px',
            margin: '0 auto 24px',
            backgroundColor: getIconBg(),
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            color: error ? colors.errorText : isComplete ? colors.successText : colors.laravelRed,
          },
        },
        error ? '\u2717' : isComplete ? '\u2713' : '\u2699'
      ),

      // Title
      React.createElement(
        'h1',
        {
          style: {
            fontSize: '24px',
            fontWeight: 600,
            color: colors.textPrimary,
            marginBottom: '8px',
          },
        },
        error
          ? 'Installation Failed'
          : isComplete
            ? 'Laravel Site Created!'
            : 'Creating Laravel Site...'
      ),

      // Subtitle / Error Message
      React.createElement(
        'p',
        {
          style: {
            fontSize: '14px',
            color: error ? colors.errorText : colors.textSecondary,
            marginBottom: '32px',
          },
        },
        error || message
      ),

      // Progress Bar (when not error or complete)
      !error &&
        !isComplete &&
        React.createElement(
          'div',
          {
            style: {
              width: '100%',
              height: '8px',
              backgroundColor: colors.border,
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '16px',
            },
          },
          React.createElement('div', {
            style: {
              width: `${progress}%`,
              height: '100%',
              backgroundColor: colors.laravelRed,
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            },
          })
        ),

      // Progress Percentage
      !error &&
        !isComplete &&
        React.createElement(
          'p',
          {
            style: {
              fontSize: '14px',
              color: colors.textSecondary,
              marginBottom: '24px',
            },
          },
          `${Math.round(progress)}% complete`
        ),

      // Actions
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '16px',
          },
        },
        // Error: Show Back and Retry
        error &&
          React.createElement(
            React.Fragment,
            null,
            React.createElement(
              'button',
              {
                onClick: this.handleBack,
                style: {
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: colors.textSecondary,
                  backgroundColor: colors.panelBgSecondary,
                  border: `1px solid ${colors.inputBorder}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                },
              },
              'Back'
            ),
            React.createElement(
              'button',
              {
                onClick: this.handleRetry,
                style: {
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: colors.laravelRed,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                },
              },
              'Retry'
            )
          ),

        // Complete: Show View Site
        isComplete &&
          React.createElement(
            'button',
            {
              onClick: this.handleViewSite,
              style: {
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: colors.laravelRed,
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              },
              onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.backgroundColor = colors.laravelRedHover;
              },
              onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.backgroundColor = colors.laravelRed;
              },
            },
            'View Site'
          )
      ),

      // Installation Steps (when in progress)
      !error &&
        !isComplete &&
        React.createElement(
          'div',
          {
            style: {
              marginTop: '40px',
              textAlign: 'left' as const,
              backgroundColor: colors.panelBgSecondary,
              borderRadius: '8px',
              padding: '20px',
            },
          },
          React.createElement(
            'h3',
            {
              style: {
                fontSize: '12px',
                fontWeight: 500,
                color: colors.textSecondary,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                marginBottom: '12px',
              },
            },
            'Installation Steps'
          ),
          Object.entries(CREATION_STAGES).map(([key, stage]) => {
            const currentProgress = progress;
            const stageProgress = stage.progress;
            const isActive = currentProgress >= stageProgress - 15 && currentProgress < stageProgress;
            const isDone = currentProgress >= stageProgress;

            return React.createElement(
              'div',
              {
                key,
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  opacity: isDone || isActive ? 1 : 0.5,
                },
              },
              // Status indicator
              React.createElement(
                'span',
                {
                  style: {
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: isDone ? colors.successText : isActive ? colors.laravelRed : colors.border,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    flexShrink: 0,
                  },
                },
                isDone ? '\u2713' : isActive ? '\u2022' : ''
              ),
              // Stage message
              React.createElement(
                'span',
                {
                  style: {
                    fontSize: '13px',
                    color: isActive ? colors.laravelRed : colors.textPrimary,
                    fontWeight: isActive ? 500 : 400,
                  },
                },
                stage.message
              )
            );
          })
        )
    );
  }
}
