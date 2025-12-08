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
import { FLOW_NAME, ROUTES, IPC_CHANNELS } from '../common/constants';
import { LaravelEntryStep } from './components/wizard/LaravelEntryStep';
import { LaravelConfigStep } from './components/wizard/LaravelConfigStep';
import { LaravelBuildingStep } from './components/wizard/LaravelBuildingStep';
import { LaravelSitePanel } from './components/LaravelSitePanel';
import { SiteHeaderBadge } from './components/SiteHeaderBadge';
import { SidebarBadgeManager } from './SidebarBadgeManager';

/**
 * Renderer addon entry function.
 *
 * Called by Local when the renderer process loads the addon.
 * The context parameter is REQUIRED.
 */
// Global sidebar badge manager instance
let sidebarBadgeManager: SidebarBadgeManager | null = null;

export default function (context: any): void {
  const { React: LocalReact, hooks } = context;
  const electron = context.electron || (window as any).electron;

  console.log('[LocalLaravel] Renderer loading...');

  // Register site creation flow option
  registerCreateSiteFlow(hooks, LocalReact);

  // Register site info panel for Laravel sites
  registerSiteInfoPanel(hooks, LocalReact);

  // Register site header badge for Laravel sites
  registerSiteHeaderBadge(hooks);

  // Initialize sidebar badge manager (DOM-based badge injection)
  sidebarBadgeManager = new SidebarBadgeManager(electron);
  sidebarBadgeManager.initialize();

  // Set up VS Code button override for Laravel sites
  setupVSCodeOverride(context);

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

/**
 * Register the Laravel site header badge.
 * Shows a Laravel badge in the top-right of the site info header.
 */
function registerSiteHeaderBadge(hooks: any): void {
  hooks.addContent('SiteInfo_Top_TopRight', (site: any, siteStatus: string) => {
    return React.createElement(SiteHeaderBadge, { site, siteStatus });
  });
}

/**
 * Set up header button overrides for Laravel sites.
 *
 * This intercepts Local's built-in buttons (Site folder, Site shell, VS Code) and
 * redirects to our handlers that open /app (Laravel root) instead of /app/public.
 *
 * How it works:
 * 1. MutationObserver watches for DOM changes
 * 2. When buttons appear, we mark them with data-laravel-override
 * 3. Click listener added at capture phase (runs before React's handler)
 * 4. If current site is Laravel, intercept and call our handler
 * 5. If not Laravel, let default behavior continue
 */
function setupVSCodeOverride(context: any): void {
  const electron = context.electron || (window as any).electron;

  // Track the current site ID (updated when navigating between sites)
  let currentSiteId: string | null = null;
  let isCurrentSiteLaravel = false;

  // Check if a site is a Laravel site
  async function checkIfLaravelSite(siteId: string): Promise<boolean> {
    try {
      const result = await electron.ipcRenderer.invoke(
        IPC_CHANNELS.IS_LARAVEL_SITE,
        siteId
      );
      return result?.isLaravel === true;
    } catch (error) {
      console.error('[LocalLaravel] Error checking if Laravel site:', error);
      return false;
    }
  }

  // Button configurations: text to match -> IPC channel to call
  const buttonConfigs = [
    { text: 'Site folder', channel: IPC_CHANNELS.OPEN_SITE_FOLDER, name: 'Site folder' },
    { text: 'Site shell', channel: IPC_CHANNELS.OPEN_SITE_SHELL, name: 'Site shell' },
    { text: 'VS Code', channel: IPC_CHANNELS.OPEN_IN_VSCODE, name: 'VS Code' },
  ];

  // Document-level click handler (capture phase) to intercept before React's delegation
  function handleDocumentClick(event: MouseEvent): void {
    // Only process if it's a Laravel site
    if (!isCurrentSiteLaravel || !currentSiteId) {
      return;
    }

    // Find the button that was clicked (or its parent button)
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    if (!button) return;

    // Check if this button matches any of our configs
    const buttonText = button.textContent?.trim();
    const config = buttonConfigs.find(c => c.text === buttonText);
    if (!config) return;

    console.log(`[LocalLaravel] Document-level intercept: ${config.name} clicked for Laravel site`);

    // Stop the event completely - this prevents React's delegated handler from firing
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // Call our IPC handler
    electron.ipcRenderer.invoke(config.channel, { siteId: currentSiteId })
      .then((result: { success: boolean; error?: string }) => {
        if (!result.success) {
          console.error(`[LocalLaravel] Failed to handle ${config.name}:`, result.error);
        }
      })
      .catch((error: Error) => {
        console.error(`[LocalLaravel] Error handling ${config.name}:`, error);
      });
  }

  // Install document-level listener once
  let documentListenerInstalled = false;
  function installDocumentListener(): void {
    if (documentListenerInstalled) return;
    documentListenerInstalled = true;

    // Capture phase at document level - runs before ANY other handlers
    document.addEventListener('click', handleDocumentClick, true);
    console.log('[LocalLaravel] Document-level click interceptor installed');
  }

  // Watch for URL/site changes to update current site
  function updateCurrentSite(): void {
    // Method 1: Extract site ID from URL pathname
    // Local uses react-router with pathname like /main/site-info/abc123
    const hashMatch = window.location.hash.match(/\/main\/site-info\/([^\/]+)/);
    const pathMatch = window.location.pathname.match(/\/main\/site-info\/([^\/]+)/);
    let siteId = hashMatch?.[1] || pathMatch?.[1];

    // Method 2: Try to extract from data-location attribute on Window component
    if (!siteId) {
      const windowEl = document.querySelector('[data-location]');
      const dataLocation = windowEl?.getAttribute('data-location');
      if (dataLocation) {
        const match = dataLocation.match(/\/main\/site-info\/([^\/]+)/);
        siteId = match?.[1];
      }
    }

    // Method 3: Look for site ID in any NavLink that's active
    if (!siteId) {
      const activeLink = document.querySelector('a.active[href*="/main/site-info/"]');
      if (activeLink) {
        const href = activeLink.getAttribute('href');
        const match = href?.match(/\/main\/site-info\/([^\/]+)/);
        siteId = match?.[1];
      }
    }

    // Debug logging
    if (siteId !== currentSiteId) {
      console.log('[LocalLaravel] URL detection debug:', {
        hash: window.location.hash,
        pathname: window.location.pathname,
        href: window.location.href,
        foundSiteId: siteId,
      });
    }

    if (siteId && siteId !== currentSiteId) {
      currentSiteId = siteId;
      console.log('[LocalLaravel] Site changed to:', siteId);

      checkIfLaravelSite(siteId).then((isLaravel) => {
        isCurrentSiteLaravel = isLaravel;
        console.log('[LocalLaravel] Is Laravel site:', isLaravel);
      });
    }
  }

  // Install document-level listener immediately
  installDocumentListener();

  // Set up MutationObserver to detect site changes (URL updates)
  const observer = new MutationObserver(() => {
    updateCurrentSite();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check
  updateCurrentSite();

  console.log('[LocalLaravel] Header button override observer started');
}

