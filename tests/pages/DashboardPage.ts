import { Page, Locator, expect } from '@playwright/test';

/**
 * Dashboard Page Object Model
 * Handles all interactions with the main dashboard page
 */
export class DashboardPage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly navbar: Locator;
  readonly statsCards: Locator;
  readonly chartsSection: Locator;
  readonly activityFeed: Locator;
  readonly userDropdown: Locator;
  readonly logoutButton: Locator;
  readonly sidebarToggle: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('.sidebar, #sidebar, [class*="sidebar"]');
    this.navbar = page.locator('.navbar, nav, [class*="navbar"]');
    this.statsCards = page.locator('.stat-card, .stats-card, [class*="stat"]');
    this.chartsSection = page.locator('.charts, .chart-container, [class*="chart"]');
    this.activityFeed = page.locator('.activity, .activities, [class*="activity"]');
    this.userDropdown = page.locator('.user-dropdown, .user-menu, [class*="user-dropdown"]');
    this.logoutButton = page.locator('button:has-text("Cikis"), a:has-text("Cikis")');
    this.sidebarToggle = page.locator('.sidebar-toggle, .hamburger, [class*="hamburger"]');
    this.searchInput = page.locator('input[type="search"], .search-input');
  }

  /**
   * Navigate to the dashboard page
   */
  async goto() {
    await this.page.goto('/index.html');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for dashboard to load completely
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for at least one stat card to be visible
    await this.statsCards.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      // Stats might not exist, continue
    });
  }

  /**
   * Get count of stat cards
   */
  async getStatsCount(): Promise<number> {
    return await this.statsCards.count();
  }

  /**
   * Get stat card value by index
   */
  async getStatValue(index: number): Promise<string> {
    const card = this.statsCards.nth(index);
    const value = card.locator('.stat-value, .value, h2, h3').first();
    return await value.textContent() || '';
  }

  /**
   * Check if sidebar is visible
   */
  async isSidebarVisible(): Promise<boolean> {
    return await this.sidebar.isVisible();
  }

  /**
   * Toggle sidebar (for mobile)
   */
  async toggleSidebar() {
    await this.sidebarToggle.click();
  }

  /**
   * Navigate to a page via sidebar
   */
  async navigateToPage(pageName: string) {
    const link = this.sidebar.locator(`a:has-text("${pageName}")`);
    await link.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click on user dropdown
   */
  async openUserDropdown() {
    await this.userDropdown.click();
  }

  /**
   * Logout from the application
   */
  async logout() {
    await this.openUserDropdown();
    await this.logoutButton.click();
  }

  /**
   * Get user name from navbar
   */
  async getUserName(): Promise<string> {
    const userName = this.navbar.locator('.user-name, [class*="user-name"]');
    return await userName.textContent() || '';
  }

  /**
   * Check if charts are rendered
   */
  async areChartsRendered(): Promise<boolean> {
    const charts = this.page.locator('canvas, .apexcharts-canvas, [class*="apexcharts"]');
    return (await charts.count()) > 0;
  }

  /**
   * Get activity feed items count
   */
  async getActivityCount(): Promise<number> {
    const items = this.activityFeed.locator('.activity-item, li, [class*="item"]');
    return await items.count();
  }

  /**
   * Search in dashboard
   */
  async search(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Assertions
   */
  async expectPageLoaded() {
    await expect(this.page).toHaveURL(/index\.html/);
  }

  async expectSidebarVisible() {
    await expect(this.sidebar).toBeVisible();
  }

  async expectNavbarVisible() {
    await expect(this.navbar).toBeVisible();
  }

  async expectStatsVisible() {
    await expect(this.statsCards.first()).toBeVisible();
  }
}
