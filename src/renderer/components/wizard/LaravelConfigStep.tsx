/**
 * Laravel Config Step
 *
 * Second step of the Laravel site creation wizard.
 * Collects PHP version, Laravel version, and starter kit selection.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import type { WizardStepProps, LaravelVersion, StarterKit, BreezeStack } from '../../../common/types';
import {
  ROUTES,
  LARAVEL_VERSIONS,
  DEFAULT_LARAVEL_VERSION,
  STARTER_KITS,
  DEFAULT_STARTER_KIT,
} from '../../../common/constants';

interface State {
  laravelVersion: LaravelVersion;
  phpVersion: string;
  starterKit: StarterKit;
  breezeStack: BreezeStack;
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
const BREEZE_STACKS: Array<{ value: BreezeStack; label: string; description: string }> = [
  { value: 'blade', label: 'Blade + Alpine.js', description: 'Traditional server-side rendering' },
  { value: 'livewire', label: 'Livewire', description: 'Full-stack with reactive components' },
  { value: 'react', label: 'React + Inertia', description: 'React SPA with server-side routing' },
  { value: 'vue', label: 'Vue + Inertia', description: 'Vue SPA with server-side routing' },
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
  constructor(props: WizardStepProps) {
    super(props);

    this.state = {
      laravelVersion: (props.siteSettings.laravelVersion as LaravelVersion) || DEFAULT_LARAVEL_VERSION,
      phpVersion: props.siteSettings.phpVersion || '8.3',
      starterKit: (props.siteSettings.starterKit as StarterKit) || DEFAULT_STARTER_KIT,
      breezeStack: (props.siteSettings.breezeStack as BreezeStack) || 'blade',
    };
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
   * Go back to previous step.
   */
  handleBack = (): void => {
    this.props.history.goBack();
  };

  /**
   * Validate and proceed to building step.
   */
  handleContinue = (): void => {
    const { laravelVersion, phpVersion, starterKit, breezeStack } = this.state;

    // Update settings and navigate
    this.props.updateSiteSettings({
      laravelVersion,
      phpVersion,
      starterKit,
      breezeStack: starterKit === 'breeze' ? breezeStack : undefined,
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
    const { laravelVersion, phpVersion, starterKit, breezeStack } = this.state;

    return React.createElement(
      'div',
      {
        style: {
          padding: '40px',
          maxWidth: '700px',
          margin: '0 auto',
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
              color: '#1a1a1a',
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
              color: '#666',
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
              color: '#333',
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
                  border: laravelVersion === key ? '2px solid #f55247' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: laravelVersion === key ? '#fff5f4' : '#fff',
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
                    color: laravelVersion === key ? '#f55247' : '#333',
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
                    color: '#666',
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
              color: '#333',
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
                  border: phpVersion === php.value ? '2px solid #f55247' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: phpVersion === php.value ? '#fff5f4' : '#fff',
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
                    color: phpVersion === php.value ? '#f55247' : '#333',
                  },
                },
                php.label
              ),
              React.createElement(
                'div',
                {
                  style: {
                    fontSize: '11px',
                    color: '#888',
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
              color: '#333',
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
                  border: starterKit === key ? '2px solid #f55247' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: starterKit === key ? '#fff5f4' : '#fff',
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
                    color: starterKit === key ? '#f55247' : '#333',
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
                    color: '#666',
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
                color: '#333',
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
            BREEZE_STACKS.map((stack) =>
              React.createElement(
                'button',
                {
                  key: stack.value,
                  onClick: () => this.handleBreezeStackChange(stack.value),
                  style: {
                    padding: '14px',
                    border: breezeStack === stack.value ? '2px solid #f55247' : '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: breezeStack === stack.value ? '#fff5f4' : '#fff',
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
                      color: breezeStack === stack.value ? '#f55247' : '#333',
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
                      color: '#888',
                    },
                  },
                  stack.description
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
              color: '#666',
              backgroundColor: '#f5f5f5',
              border: '1px solid #d1d5db',
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
              backgroundColor: '#f55247',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            },
            onMouseOver: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = '#e04438';
            },
            onMouseOut: (e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.backgroundColor = '#f55247';
            },
          },
          'Create Laravel Site'
        )
      )
    );
  }
}
