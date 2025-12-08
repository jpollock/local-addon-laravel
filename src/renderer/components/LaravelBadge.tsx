/**
 * Laravel Badge Component
 *
 * Reusable badge showing Laravel "L" logo.
 * Used in both site header and sidebar.
 *
 * IMPORTANT: Local uses an older React version - NO HOOKS allowed!
 * All components must be class-based.
 */
import * as React from 'react';

interface LaravelBadgeProps {
  size?: 'small' | 'medium';
  style?: React.CSSProperties;
}

/**
 * Laravel "L" badge component.
 *
 * @param size - 'small' (14px, for sidebar) or 'medium' (20px, for header)
 * @param style - Additional styles to merge
 */
export class LaravelBadge extends React.Component<LaravelBadgeProps> {
  render(): React.ReactNode {
    const { size = 'medium', style = {} } = this.props;

    const dimensions =
      size === 'small'
        ? {
            width: '14px',
            height: '14px',
            fontSize: '8px',
            borderRadius: '3px',
          }
        : {
            width: '20px',
            height: '20px',
            fontSize: '11px',
            borderRadius: '4px',
          };

    return React.createElement(
      'div',
      {
        style: {
          ...dimensions,
          backgroundColor: '#f55247', // Laravel red
          color: '#fff',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          ...style,
        },
        title: 'Laravel Site',
      },
      'L'
    );
  }
}
