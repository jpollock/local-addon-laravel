/**
 * Sidebar Badge Manager
 *
 * Manages injection of Laravel badges into the sidebar site list.
 * Uses MutationObserver since there's no per-site hook available in Local.
 *
 * DOM structure from Local's SiteListSite.tsx:
 * <NavLink data-site-id="abc123" data-site-name="mysite">
 *   {status icon}
 *   <span class="TID_SiteListSite_Span_SiteName">mysite</span>
 *   {lastStarted}
 * </NavLink>
 */
import { IPC_CHANNELS } from '../common/constants';

const BADGE_CLASS = 'local-laravel-sidebar-badge';
const BADGE_DATA_ATTR = 'data-laravel-badge';
const STYLE_ID = 'local-laravel-sidebar-styles';

export class SidebarBadgeManager {
  private observer: MutationObserver | null = null;
  private laravelSiteIds: Set<string> = new Set();
  private electron: any;
  private isInitialized: boolean = false;
  private pendingRefresh: number | null = null;

  constructor(electron: any) {
    this.electron = electron;
  }

  /**
   * Initialize the badge manager.
   * Fetches Laravel sites, injects styles, and starts observing DOM changes.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Inject CSS styles once
    this.injectStyles();

    // Fetch all Laravel site IDs in one batch
    await this.refreshLaravelSites();

    // Initial badge injection
    this.injectBadges();

    // Watch for DOM changes (new sites, navigation)
    this.startObserver();

    console.log('[LocalLaravel] SidebarBadgeManager initialized');
  }

  /**
   * Fetch all Laravel site IDs from main process.
   * Single IPC call instead of N individual calls.
   */
  private async refreshLaravelSites(): Promise<void> {
    try {
      const result = await this.electron.ipcRenderer.invoke(
        IPC_CHANNELS.GET_LARAVEL_SITES
      );
      if (result.success && result.siteIds) {
        this.laravelSiteIds = new Set(result.siteIds);
        console.log(
          '[LocalLaravel] Laravel sites:',
          Array.from(this.laravelSiteIds)
        );
      }
    } catch (error) {
      console.error('[LocalLaravel] Failed to fetch Laravel sites:', error);
    }
  }

  /**
   * Inject CSS styles for the sidebar badge.
   */
  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BADGE_CLASS} {
        width: 14px;
        height: 14px;
        background-color: #f55247;
        color: #fff;
        font-size: 8px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        flex-shrink: 0;
        margin-left: 6px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Inject badges into all Laravel site list items.
   */
  private injectBadges(): void {
    // Find all site list items using data-site-id attribute
    const siteElements = document.querySelectorAll('[data-site-id]');

    siteElements.forEach((element) => {
      const siteId = element.getAttribute('data-site-id');
      if (!siteId) return;

      // Check if this is a Laravel site
      const isLaravel = this.laravelSiteIds.has(siteId);
      const hasBadge = element.querySelector(`.${BADGE_CLASS}`) !== null;

      if (isLaravel && !hasBadge) {
        // Find the site name span and inject badge after it
        const nameSpan = element.querySelector('.TID_SiteListSite_Span_SiteName');
        if (nameSpan) {
          const badge = document.createElement('div');
          badge.className = BADGE_CLASS;
          badge.setAttribute(BADGE_DATA_ATTR, 'true');
          badge.textContent = 'L';
          badge.title = 'Laravel Site';
          nameSpan.parentElement?.insertBefore(badge, nameSpan.nextSibling);
        }
      } else if (!isLaravel && hasBadge) {
        // Remove badge if site is no longer Laravel (edge case)
        const badge = element.querySelector(`.${BADGE_CLASS}`);
        badge?.remove();
      }
    });
  }

  /**
   * Start observing DOM for changes.
   * Uses requestAnimationFrame to debounce badge injection.
   */
  private startObserver(): void {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      // Debounce badge injection using requestAnimationFrame
      if (this.pendingRefresh !== null) {
        cancelAnimationFrame(this.pendingRefresh);
      }
      this.pendingRefresh = requestAnimationFrame(() => {
        this.injectBadges();
        this.pendingRefresh = null;
      });
    });

    // Observe the entire body for changes (sidebar may not exist yet)
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Refresh Laravel sites list and re-inject badges.
   * Call this when a site is created or deleted.
   */
  async refresh(): Promise<void> {
    await this.refreshLaravelSites();
    this.injectBadges();
  }

  /**
   * Clean up observers and injected elements.
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.pendingRefresh !== null) {
      cancelAnimationFrame(this.pendingRefresh);
      this.pendingRefresh = null;
    }
    // Remove all injected badges
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
    // Remove injected styles
    document.getElementById(STYLE_ID)?.remove();
  }
}
