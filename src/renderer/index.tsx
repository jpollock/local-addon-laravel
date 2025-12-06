/**
 * Local Laravel - Renderer Process Entry Point
 *
 * This is the main entry point for the addon's renderer process.
 * It registers UI hooks and filters for the site creation wizard.
 *
 * IMPORTANT: Local uses an older React version - NO HOOKS allowed!
 * All components must be class-based.
 */

import * as React from 'react';
import { FLOW_NAME, ROUTES } from '../common/constants';
import { LaravelEntryStep } from './components/wizard/LaravelEntryStep';
import { LaravelConfigStep } from './components/wizard/LaravelConfigStep';
import { LaravelBuildingStep } from './components/wizard/LaravelBuildingStep';

/**
 * Renderer addon entry function.
 *
 * Called by Local when the renderer process loads the addon.
 * The context parameter is REQUIRED.
 */
export default function (context: any): void {
  const { React: LocalReact, hooks } = context;

  console.log('[LocalLaravel] Renderer loading...');

  // Register site creation flow option
  registerCreateSiteFlow(hooks, LocalReact);

  // Register site info panel for Laravel sites
  registerSiteInfoPanel(hooks, LocalReact);

  console.log('[LocalLaravel] Renderer loaded successfully');
}

/**
 * Register the Laravel site creation flow.
 */
function registerCreateSiteFlow(hooks: any, _LocalReact: typeof React): void {
  // Add "Laravel Project" option to site creation dialog
  hooks.addFilter('CreateSite:RadioOptions', (options: any) => {
    return {
      ...options,
      [FLOW_NAME]: {
        label: 'Laravel Project',
        description: React.createElement(
          'span',
          {},
          'Create a new Laravel application with PHP, MySQL, and Nginx configured automatically.'
        ),
      },
    };
  });

  // Provide wizard steps for Laravel flow
  hooks.addFilter('CreateSite:Steps', function (this: any, steps: any[]) {
    // Check if Laravel flow is selected
    if (this.selectedCreateSiteFlow !== FLOW_NAME) {
      return steps;
    }

    // Return Laravel-specific wizard steps with actual components
    return [
      {
        key: 'laravel-entry',
        path: ROUTES.ENTRY,
        name: 'Setup',
        component: LaravelEntryStep,
      },
      {
        key: 'laravel-config',
        path: ROUTES.CONFIG,
        name: 'Configure',
        component: LaravelConfigStep,
      },
      {
        key: 'laravel-building',
        path: ROUTES.BUILDING,
        name: 'Building',
        component: LaravelBuildingStep,
      },
    ];
  });
}

/**
 * Register the Laravel site info panel.
 */
function registerSiteInfoPanel(hooks: any, LocalReact: typeof React): void {
  // Add Laravel panel to site info when viewing a Laravel site
  hooks.addContent('SiteInfoOverview', (props: any) => {
    const { site } = props;

    // Only show for Laravel sites
    if (site?.customOptions?.siteType !== 'laravel') {
      return null;
    }

    // TODO: Implement LaravelSitePanel component
    return LocalReact.createElement(
      'div',
      {
        style: {
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '16px',
        },
      },
      LocalReact.createElement(
        'h3',
        { style: { margin: '0 0 8px 0', color: '#f55247' } },
        'Laravel'
      ),
      LocalReact.createElement(
        'p',
        { style: { margin: 0, color: '#666' } },
        `Version: ${site.customOptions.laravelVersion || 'Unknown'}`
      )
    );
  });
}

