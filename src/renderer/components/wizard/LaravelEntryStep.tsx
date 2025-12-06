/**
 * Laravel Entry Step
 *
 * First step of the Laravel site creation wizard.
 * Collects site name and domain.
 *
 * IMPORTANT: Class-based component required (no React hooks).
 */

import * as React from 'react';
import type { WizardStepProps } from '../../../common/types';
import { ROUTES } from '../../../common/constants';

interface State {
  siteName: string;
  siteDomain: string;
  errors: {
    siteName?: string;
    siteDomain?: string;
  };
}

/**
 * LaravelEntryStep component.
 *
 * Collects basic site information:
 * - Site name (used for display and directory name)
 * - Site domain (e.g., mysite.local)
 */
export class LaravelEntryStep extends React.Component<WizardStepProps, State> {
  constructor(props: WizardStepProps) {
    super(props);

    this.state = {
      siteName: props.siteSettings.siteName || '',
      siteDomain: props.siteSettings.siteDomain || '',
      errors: {},
    };
  }

  /**
   * Handle site name change.
   * Auto-generates domain from site name.
   */
  handleSiteNameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const siteName = event.target.value;

    // Generate domain from site name
    const domain = this.generateDomain(siteName);

    this.setState({
      siteName,
      siteDomain: domain,
      errors: {},
    });
  };

  /**
   * Handle domain change.
   */
  handleDomainChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setState({
      siteDomain: event.target.value,
      errors: {},
    });
  };

  /**
   * Generate a domain from site name.
   */
  generateDomain(siteName: string): string {
    // Convert to lowercase, replace spaces with hyphens, remove special chars
    const slug = siteName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    return slug ? `${slug}.local` : '';
  }

  /**
   * Validate form and navigate to next step.
   */
  handleContinue = (): void => {
    const { siteName, siteDomain } = this.state;
    const errors: State['errors'] = {};

    // Validate site name
    if (!siteName.trim()) {
      errors.siteName = 'Site name is required';
    } else if (siteName.length < 2) {
      errors.siteName = 'Site name must be at least 2 characters';
    }

    // Validate domain
    if (!siteDomain.trim()) {
      errors.siteDomain = 'Domain is required';
    } else if (!/^[a-z0-9-]+\.local$/.test(siteDomain)) {
      errors.siteDomain = 'Domain must end with .local (e.g., mysite.local)';
    }

    if (Object.keys(errors).length > 0) {
      this.setState({ errors });
      return;
    }

    // Update settings and navigate
    this.props.updateSiteSettings({
      siteName: siteName.trim(),
      siteDomain: siteDomain.trim(),
    });

    this.props.history.push(ROUTES.CONFIG);
  };

  render(): React.ReactNode {
    const { siteName, siteDomain, errors } = this.state;

    return React.createElement(
      'div',
      {
        style: {
          padding: '40px',
          maxWidth: '600px',
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
          'Create Laravel Site'
        ),
        React.createElement(
          'p',
          {
            style: {
              fontSize: '14px',
              color: '#666',
            },
          },
          "Let's set up your new Laravel project"
        )
      ),

      // Form
      React.createElement(
        'div',
        { style: { marginBottom: '24px' } },

        // Site Name Field
        React.createElement(
          'div',
          { style: { marginBottom: '20px' } },
          React.createElement(
            'label',
            {
              style: {
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
              },
            },
            'Site Name'
          ),
          React.createElement('input', {
            type: 'text',
            value: siteName,
            onChange: this.handleSiteNameChange,
            placeholder: 'My Laravel App',
            style: {
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              border: errors.siteName ? '2px solid #e53e3e' : '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box' as const,
            },
          }),
          errors.siteName &&
            React.createElement(
              'p',
              {
                style: {
                  marginTop: '4px',
                  fontSize: '12px',
                  color: '#e53e3e',
                },
              },
              errors.siteName
            )
        ),

        // Domain Field
        React.createElement(
          'div',
          { style: { marginBottom: '20px' } },
          React.createElement(
            'label',
            {
              style: {
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: '#333',
              },
            },
            'Domain'
          ),
          React.createElement('input', {
            type: 'text',
            value: siteDomain,
            onChange: this.handleDomainChange,
            placeholder: 'my-laravel-app.local',
            style: {
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              border: errors.siteDomain ? '2px solid #e53e3e' : '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              boxSizing: 'border-box' as const,
            },
          }),
          errors.siteDomain &&
            React.createElement(
              'p',
              {
                style: {
                  marginTop: '4px',
                  fontSize: '12px',
                  color: '#e53e3e',
                },
              },
              errors.siteDomain
            ),
          React.createElement(
            'p',
            {
              style: {
                marginTop: '4px',
                fontSize: '12px',
                color: '#888',
              },
            },
            'Your site will be accessible at http://' + (siteDomain || 'yoursite.local')
          )
        )
      ),

      // Continue Button
      React.createElement(
        'button',
        {
          onClick: this.handleContinue,
          style: {
            width: '100%',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: 500,
            color: '#fff',
            backgroundColor: '#f55247', // Laravel red
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
        'Continue'
      )
    );
  }
}
