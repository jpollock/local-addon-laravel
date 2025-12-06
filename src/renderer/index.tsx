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
import { LaravelSitePanel } from './components/LaravelSitePanel';

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
function registerSiteInfoPanel(hooks: any, _LocalReact: typeof React): void {
  // Add Laravel panel to site info when viewing a Laravel site
  hooks.addContent('SiteInfoOverview', (props: any) => {
    // Props IS the site object directly (not props.site)
    const site = props;

    console.log('[LocalLaravel] Site:', site?.id, site?.name);
    console.log('[LocalLaravel] customOptions:', JSON.stringify(site?.customOptions));

    // Only show for Laravel sites
    if (site?.customOptions?.siteType !== 'laravel') {
      console.log('[LocalLaravel] Not a Laravel site, skipping panel');
      return null;
    }

    console.log('[LocalLaravel] Rendering LaravelSitePanel!');

    // Render the Laravel site panel
    return React.createElement(LaravelSitePanel, {
      site,
      siteStatus: 'unknown', // siteStatus not provided in this hook
    });
  });
}

