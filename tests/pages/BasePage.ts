import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object Model
 * Contains common functionality shared across all pages
 */
export class BasePage {
  readonly page: Page;
  readonly sidebar: Locator;
  readonly navbar: Locator;
  readonly loadingOverlay: Locator;
  readonly toast: Locator;
  readonly modal: Locator;
  readonly modalCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebar = page.locator('.sidebar, #sidebar');
    this.navbar = page.locator('.navbar, nav');
    this.loadingOverlay = page.locator('.loading-overlay, .loading, [class*="loading"]');
    this.toast = page.locator('.toast, [class*="toast"]');
    this.modal = page.locator('.modal, [class*="modal"]');
    this.modalCloseButton = page.locator('.modal .close, .modal-close, [class*="modal"] button:has-text("Kapat")');
  }

  /**
   * Wait for page to fully load
   */
  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Wait for loading overlay to disappear
   */
  async waitForLoadingToComplete() {
    const loading = this.page.locator('.loading-overlay:visible, .loading:visible');
    if (await loading.count() > 0) {
      await loading.waitFor({ state: 'hidden', timeout: 30000 });
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.page.evaluate(() => {
      return localStorage.getItem('refreshToken') !== null;
    });
    return token;
  }

  /**
   * Navigate using sidebar
   */
  async navigateTo(menuText: string) {
    const menuItem = this.sidebar.locator(`a:has-text("${menuText}")`);
    await menuItem.click();
    await this.waitForPageLoad();
  }

  /**
   * Get toast message
   */
  async getToastMessage(): Promise<string> {
    await this.toast.waitFor({ state: 'visible', timeout: 5000 });
    return await this.toast.textContent() || '';
  }

  /**
   * Wait for toast to appear
   */
  async waitForToast(type?: 'success' | 'error' | 'warning' | 'info') {
    if (type) {
      await this.page.locator(`.toast.${type}, .toast-${type}`).waitFor({ state: 'visible' });
    } else {
      await this.toast.waitFor({ state: 'visible' });
    }
  }

  /**
   * Close modal if open
   */
  async closeModal() {
    if (await this.modal.isVisible()) {
      await this.modalCloseButton.click();
      await this.modal.waitFor({ state: 'hidden' });
    }
  }

  /**
   * Check if modal is open
   */
  async isModalOpen(): Promise<boolean> {
    return await this.modal.isVisible();
  }

  /**
   * Get current URL path
   */
  async getCurrentPath(): Promise<string> {
    const url = this.page.url();
    return new URL(url).pathname;
  }

  /**
   * Check permission-based element visibility
   */
  async hasPermission(permissionKey: string): Promise<boolean> {
    return await this.page.evaluate((key) => {
      const user = JSON.parse(sessionStorage.getItem('user') || '{}');
      return user?.permissions?.[key] === '1';
    }, permissionKey);
  }

  /**
   * Take screenshot with name
   */
  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }

  /**
   * Scroll to element
   */
  async scrollTo(locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
  }

  /**
   * Common assertions
   */
  async expectUrl(urlPattern: RegExp | string) {
    if (typeof urlPattern === 'string') {
      await expect(this.page).toHaveURL(new RegExp(urlPattern));
    } else {
      await expect(this.page).toHaveURL(urlPattern);
    }
  }

  async expectToastVisible() {
    await expect(this.toast).toBeVisible();
  }

  async expectNoErrors() {
    const errors = this.page.locator('.error:visible, .error-message:visible');
    await expect(errors).toHaveCount(0);
  }
}
