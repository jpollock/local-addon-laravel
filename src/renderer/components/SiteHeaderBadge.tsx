/**
 * Site Header Laravel Badge
 *
 * Appears in the top-right of the site info header for Laravel sites.
 * Uses the SiteInfo_Top_TopRight hook.
 *
 * IMPORTANT: Local uses an older React version - NO HOOKS allowed!
 * All components must be class-based.
 */
import * as React from 'react';
import { LaravelBadge } from './LaravelBadge';
import { SITE_TYPE_KEY, SITE_TYPE_VALUE } from '../../common/constants';

interface SiteHeaderBadgeProps {
  site: any;
  siteStatus: string;
}

interface SiteHeaderBadgeState {
  isLaravel: boolean;
}

/**
 * Badge component for site header.
 * Shows Laravel badge + label only for Laravel sites.
 */
export class SiteHeaderBadge extends React.Component<
  SiteHeaderBadgeProps,
  SiteHeaderBadgeState
> {
  state: SiteHeaderBadgeState = {
    isLaravel: false,
  };

  componentDidMount(): void {
    this.checkIfLaravel();
  }

  componentDidUpdate(prevProps: SiteHeaderBadgeProps): void {
    if (prevProps.site?.id !== this.props.site?.id) {
      this.checkIfLaravel();
    }
  }

  /**
   * Check if current site is a Laravel site.
   * Uses direct customOptions check (faster than IPC).
   */
  checkIfLaravel(): void {
    const { site } = this.props;
    const isLaravel = site?.customOptions?.[SITE_TYPE_KEY] === SITE_TYPE_VALUE;
    this.setState({ isLaravel });
  }

  render(): React.ReactNode {
    const { isLaravel } = this.state;

    // Don't render anything for non-Laravel sites
    if (!isLaravel) {
      return null;
    }

    return React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingRight: '12px',
          borderRight: '1px solid #e5e7eb',
          marginRight: '12px',
        },
      },
      React.createElement(LaravelBadge, { size: 'medium' }),
      React.createElement(
        'span',
        {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            color: '#666',
          },
        },
        'Laravel'
      )
    );
  }
}
