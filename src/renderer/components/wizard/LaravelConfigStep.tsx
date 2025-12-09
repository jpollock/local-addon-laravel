/**
 * Laravel Config Step
 *
 * Second step of the Laravel site creation wizard.
 * Collects PHP version, Laravel version, and starter kit selection.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import type { WizardStepProps, LaravelVersion, StarterKit, BreezeStack, JetstreamStack } from '../../../common/types';
import {
  ROUTES,
  LARAVEL_VERSIONS,
  DEFAULT_LARAVEL_VERSION,
  STARTER_KITS,
  DEFAULT_STARTER_KIT,
  JETSTREAM_STACKS,
} from '../../../common/constants';
import { getThemeColors, onThemeChange, type ThemeColors } from '../../../common/theme';

interface State {
  laravelVersion: LaravelVersion;
  phpVersion: string;
  starterKit: StarterKit;
  breezeStack: BreezeStack;
  jetstreamStack: JetstreamStack;
  jetstreamTeams: boolean;
  jetstreamApi: boolean;
  themeColors: ThemeColors;
}

/**
 * Available PHP versions.
 * Filtered based on Laravel version requirements.
 */
const PHP_VERSIONS = [
  { value: '8.3', label: 'PHP 8.3', description: 'Latest stable' },
  { value: '8.2', label: 'PHP 8.2', description: 'Recommended for Laravel 11' },
  { value: '8.1', label: 'PHP 8.1', description: 'Minimum for Laravel 10' },
];

/**
 * Breeze stack options.
 */
const BREEZE_STACKS_UI: Array<{ value: BreezeStack; label: string; description: string }> = [
  { value: 'blade', label: 'Blade + Alpine.js', description: 'Traditional server-side rendering' },
  { value: 'livewire', label: 'Livewire', description: 'Full-stack with reactive components' },
  { value: 'react', label: 'React + Inertia', description: 'React SPA with server-side routing' },
  { value: 'vue', label: 'Vue + Inertia', description: 'Vue SPA with server-side routing' },
  { value: 'api', label: 'API Only', description: 'Headless backend for separate frontend' },
];

/**
 * Jetstream stack options.
 */
const JETSTREAM_STACKS_UI: Array<{ value: JetstreamStack; label: string; description: string }> = [
  { value: 'livewire', label: 'Livewire', description: 'PHP-driven reactive components' },
  { value: 'inertia', label: 'Inertia (Vue)', description: 'Vue.js SPA with server-side routing' },
];

/**
 * LaravelConfigStep component.
 *
 * Collects configuration options:
 * - Laravel version
 * - PHP version
 * - Starter kit
 * - Breeze stack (if Breeze selected)
 */
export class LaravelConfigStep extends React.Component<WizardStepProps, State> {
  private themeCleanup: (() => void) | null = null;

  constructor(props: WizardStepProps) {
    super(props);

    this.state = {
      laravelVersion: (props.siteSettings.laravelVersion as LaravelVersion) || DEFAULT_LARAVEL_VERSION,
      phpVersion: props.siteSettings.phpVersion || '8.3',
      starterKit: (props.siteSettings.starterKit as StarterKit) || DEFAULT_STARTER_KIT,
      breezeStack: (props.siteSettings.breezeStack as BreezeStack) || 'blade',
      jetstreamStack: (props.siteSettings.jetstreamStack as JetstreamStack) || 'livewire',
      jetstreamTeams: props.siteSettings.jetstreamTeams || false,
      jetstreamApi: props.siteSettings.jetstreamApi || false,
      themeColors: getThemeColors(),
    };
  }

  componentDidMount(): void {
    this.themeCleanup = onThemeChange(() => {
      this.setState({ themeColors: getThemeColors() });
    });
  }

  componentWillUnmount(): void {
    if (this.themeCleanup) {
      this.themeCleanup();
      this.themeCleanup = null;
    }
  }

  /**
   * Handle Laravel version change.
   * May update PHP version if current selection is incompatible.
   */
  handleLaravelVersionChange = (version: LaravelVersion): void => {
    const minPhp = LARAVEL_VERSIONS[version].minPhp;

    // If current PHP version is below minimum, bump it up
    let { phpVersion } = this.state;
    if (parseFloat(phpVersion) < parseFloat(minPhp)) {
      phpVersion = minPhp;
    }

    this.setState({ laravelVersion: version, phpVersion });
  };

  /**
   * Handle PHP version change.
   */
  handlePhpVersionChange = (version: string): void => {
    this.setState({ phpVersion: version });
  };

  /**
   * Handle starter kit change.
   */
  handleStarterKitChange = (kit: StarterKit): void => {
    this.setState({ starterKit: kit });
  };

  /**
   * Handle Breeze stack change.
   */
  handleBreezeStackChange = (stack: BreezeStack): void => {
    this.setState({ breezeStack: stack });
  };

  /**
   * Handle Jetstream stack change.
   */
  handleJetstreamStackChange = (stack: JetstreamStack): void => {
    this.setState({ jetstreamStack: stack });
  };

  /**
   * Handle Jetstream teams toggle.
   */
  handleJetstreamTeamsChange = (enabled: boolean): void => {
    this.setState({ jetstreamTeams: enabled });
  };

  /**
   * Handle Jetstream API toggle.
   */
  handleJetstreamApiChange = (enabled: boolean): void => {
    this.setState({ jetstreamApi: enabled });
  };

  /**
   * Go back to previous step.
   */
  handleBack = (): void => {
    this.props.history.goBack();
  };

  /**
   * Validate and proceed to building step.
   */
  handleContinue = (): void => {
    const { laravelVersion, phpVersion, starterKit, breezeStack, jetstreamStack, jetstreamTeams, jetstreamApi } = this.state;

    // Update settings and navigate
    this.props.updateSiteSettings({
      laravelVersion,
      phpVersion,
      starterKit,
      breezeStack: starterKit === 'breeze' ? breezeStack : undefined,
      jetstreamStack: starterKit === 'jetstream' ? jetstreamStack : undefined,
      jetstreamTeams: starterKit === 'jetstream' ? jetstreamTeams : undefined,
      jetstreamApi: starterKit === 'jetstream' ? jetstreamApi : undefined,
    });

    this.props.history.push(ROUTES.BUILDING);
  };

  /**
   * Get available PHP versions based on Laravel version.
   */
  getAvailablePhpVersions(): typeof PHP_VERSIONS {
    const minPhp = LARAVEL_VERSIONS[this.state.laravelVersion].minPhp;
    return PHP_VERSIONS.filter((php) => parseFloat(php.value) >= parseFloat(minPhp));
  }

  render(): React.ReactNode {
    const { laravelVersion, phpVersion, starterKit, breezeStack, jetstreamStack, jetstreamTeams, jetstreamApi, themeColors } = this.state;
    const colors = themeColors;

    // Selected state background for buttons
    const selectedBg = colors.panelBgTertiary;

    return React.createElement(
      'div',
      {
        style: {
          padding: '40px',
          maxWidth: '700px',
          margin: '0 auto',
          height: '100%',
          overflowY: 'auto' as const,
          boxSizing: 'border-box' as const,
        },
      },
      // Header
      React.createElement(
        'div',
        { style: { marginBottom: '32px', textAlign: 'center' as const } },
        React.createElement(
          'h1',
          {
            style: {
              fontSize: '28px',
              fontWeight: 600,
              color: colors.textPrimary,
              marginBottom: '8px',
            },
          },
          'Configure Laravel'
        ),
        React.createElement(
          'p',
          {
            style: {
              fontSize: '14px',
              color: colors.textSecondary,
            },
          },
          'Choose your PHP version, Laravel version, and optional starter kit'
        )
      ),

      // Laravel Version Selection
      React.createElement(
        'div',
        { style: { marginBottom: '28px' } },
        React.createElement(
          'label',
          {
            style: {
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 500,
              color: colors.textPrimary,
            },
          },
          'Laravel Version'
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '12px' } },
          Object.entries(LARAVEL_VERSIONS).map(([key, config]) =>
            React.createElement(
              'button',
              {
                key,
                onClick: () => this.handleLaravelVersionChange(key as LaravelVersion),
                style: {
                  flex: 1,
                  padding: '16px',
                  border: laravelVersion === key ? `2px solid ${colors.laravelRed}` : `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  backgroundColor: laravelVersion === key ? selectedBg : colors.panelBg,
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  transition: 'all 0.2s',
                },
              },
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '16px',
                    fontWeight: 500,
                    color: laravelVersion === key ? colors.laravelRed : colors.textPrimary,
                    marginBottom: '4px',
                  },
                },
                config.label
              ),
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '12px',
                    color: colors.textSecondary,
                  },
                },
                config.description
              )
            )
          )
        )
      ),

      // PHP Version Selection
      React.createElement(
        'div',
        { style: { marginBottom: '28px' } },
        React.createElement(
          'label',
          {
            style: {
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 500,
              color: colors.textPrimary,
            },
          },
          'PHP Version'
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '12px' } },
          this.getAvailablePhpVersions().map((php) =>
            React.createElement(
              'button',
              {
                key: php.value,
                onClick: () => this.handlePhpVersionChange(php.value),
                style: {
                  flex: 1,
                  padding: '12px',
                  border: phpVersion === php.value ? `2px solid ${colors.laravelRed}` : `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  backgroundColor: phpVersion === php.value ? selectedBg : colors.panelBg,
                  cursor: 'pointer',
                  textAlign: 'center' as const,
                  transition: 'all 0.2s',
                },
              },
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '14px',
                    fontWeight: 500,
                    color: phpVersion === php.value ? colors.laravelRed : colors.textPrimary,
                  },
                },
                php.label
              ),
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginTop: '2px',
                  },
                },
                php.description
              )
            )
          )
        )
      ),

      // Starter Kit Selection
      React.createElement(
        'div',
        { style: { marginBottom: '28px' } },
        React.createElement(
          'label',
          {
            style: {
              display: 'block',
              marginBottom: '12px',
              fontSize: '14px',
              fontWeight: 500,
              color: colors.textPrimary,
            },
          },
          'Starter Kit'
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', gap: '12px' } },
          Object.entries(STARTER_KITS).map(([key, config]) =>
            React.createElement(
              'button',
              {
                key,
                onClick: () => this.handleStarterKitChange(key as StarterKit),
                style: {
                  flex: 1,
                  padding: '16px',
                  border: starterKit === key ? `2px solid ${colors.laravelRed}` : `1px solid ${colors.inputBorder}`,
                  borderRadius: '8px',
                  backgroundColor: starterKit === key ? selectedBg : colors.panelBg,
                  cursor: 'pointer',
                  textAlign: 'left' as const,
                  transition: 'all 0.2s',
                },
              },
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '14px',
                    fontWeight: 500,
                    color: starterKit === key ? colors.laravelRed : colors.textPrimary,
                    marginBottom: '4px',
                  },
                },
                config.label
              ),
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '12px',
                    color: colors.textSecondary,
                  },
                },
                config.description
              )
            )
          )
        )
      ),

      // Breeze Stack Selection (conditional)
      starterKit === 'breeze' &&
        React.createElement(
          'div',
          { style: { marginBottom: '28px' } },
          React.createElement(
            'label',
            {
              style: {
                display: 'block',
                marginBottom: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: colors.textPrimary,
              },
            },
            'Breeze Stack'
          ),
          React.createElement(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              },
            },
            BREEZE_STACKS_UI.map((stack) =>
              React.createElement(
                'button',
                {
                  key: stack.value,
                  onClick: () => this.handleBreezeStackChange(stack.value),
                  style: {
                    padding: '14px',
                    border: breezeStack === stack.value ? `2px solid ${colors.laravelRed}` : `1px solid ${colors.inputBorder}`,
                    borderRadius: '8px',
                    backgroundColor: breezeStack === stack.value ? selectedBg : colors.panelBg,
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                    transition: 'all 0.2s',
                  },
                },
                React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '14px',
                      fontWeight: 500,
                      color: breezeStack === stack.value ? colors.laravelRed : colors.textPrimary,
                      marginBottom: '2px',
                    },
                  },
                  stack.label
                ),
                React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '11px',
                      color: colors.textMuted,
                    },
                  },
                  stack.description
                )
              )
            )
          )
        ),

      // Jetstream Stack Selection (conditional)
      starterKit === 'jetstream' &&
        React.createElement(
          'div',
          { style: { marginBottom: '28px' } },
          React.createElement(
            'label',
            {
              style: {
                display: 'block',
                marginBottom: '12px',
                fontSize: '14px',
                fontWeight: 500,
                color: colors.textPrimary,
              },
            },
            'Jetstream Stack'
          ),
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                gap: '12px',
                marginBottom: '16px',
              },
            },
            JETSTREAM_STACKS_UI.map((stack) =>
              React.createElement(
                'button',
                {
                  key: stack.value,
                  onClick: () => this.handleJetstreamStackChange(stack.value),
                  style: {
                    flex: 1,
                    padding: '14px',
                    border: jetstreamStack === stack.value ? `2px solid ${colors.laravelRed}` : `1px solid ${colors.inputBorder}`,
                    borderRadius: '8px',
                    backgroundColor: jetstreamStack === stack.value ? selectedBg : colors.panelBg,
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                    transition: 'all 0.2s',
                  },
                },
                React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '14px',
                      fontWeight: 500,
                      color: jetstreamStack === stack.value ? colors.laravelRed : colors.textPrimary,
                      marginBottom: '2px',
                    },
                  },
                  stack.label
                ),
                React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: '11px',
                      color: colors.textMuted,
                    },
                  },
                  stack.description
                )
              )
            )
          ),
          // Jetstream Options (Teams and API checkboxes)
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '12px',
                padding: '16px',
                backgroundColor: colors.panelBgSecondary,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
              },
            },
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: colors.textPrimary,
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: jetstreamTeams,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  this.handleJetstreamTeamsChange(e.target.checked),
                style: {
                  width: '16px',
                  height: '16px',
                  accentColor: colors.laravelRed,
                },
              }),
              React.createElement(
                'span',
                null,
                'Enable team management',
                React.createElement(
                  'span',
                  { style: { color: colors.textSecondary, marginLeft: '6px', fontSize: '12px' } },
                  '(multi-user workspaces)'
                )
              )
            ),
            React.createElement(
              'label',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: colors.textPrimary,
                },
              },
              React.createElement('input', {
                type: 'checkbox',
                checked: jetstreamApi,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  this.handleJetstreamApiChange(e.target.checked),
                style: {
                  width: '16px',
                  height: '16px',
                  accentColor: colors.laravelRed,
                },
              }),
              React.createElement(
                'span',
                null,
                'Enable API support',
                React.createElement(
                  'span',
                  { style: { color: colors.textSecondary, marginLeft: '6px', fontSize: '12px' } },
                  '(Laravel Sanctum)'
                )
              )
            )
          )
        ),

      // Navigation Buttons
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            gap: '12px',
            marginTop: '16px',
          },
        },
        React.createElement(
          'button',
          {
            onClick: this.handleBack,
            style: {
              flex: 1,
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 500,
              color: colors.textSecondary,
              backgroundColor: colors.panelBgSecondary,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            },
          },
          'Back'
        ),
        React.createElement(
          'button',
          {
            onClick: this.handleContinue,
            style: {
              flex: 2,
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#fff',
              backgroundColor: colors.laravelRed,
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            },
            onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = colors.laravelRedHover;
            },
            onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = colors.laravelRed;
            },
          },
          'Create Laravel Site'
        )
      )
    );
  }
}
