import { Page, Locator, expect } from '@playwright/test';

/**
 * Login Page Object Model
 * Handles all interactions with the login page
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly forgotPasswordLink: Locator;
  readonly errorMessage: Locator;
  readonly errorText: Locator;
  readonly passwordToggle: Locator;
  readonly loginCard: Locator;
  readonly cardLogo: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('#email');
    this.passwordInput = page.locator('#password');
    this.loginButton = page.locator('#loginButton');
    this.rememberMeCheckbox = page.locator('#rememberMe');
    this.forgotPasswordLink = page.locator('.forgot-password');
    this.errorMessage = page.locator('#errorMessage');
    this.errorText = page.locator('#errorText');
    this.passwordToggle = page.locator('.password-toggle');
    this.loginCard = page.locator('#loginCard');
    this.cardLogo = page.locator('#cardLogo');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto('/pages/login.html');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Fill email input
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill password input
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  /**
   * Click login button
   */
  async clickLogin() {
    await this.loginButton.click();
  }

  /**
   * Complete login flow
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  /**
   * Toggle remember me checkbox
   */
  async toggleRememberMe() {
    await this.rememberMeCheckbox.click();
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility() {
    await this.passwordToggle.click();
  }

  /**
   * Check if password is visible
   */
  async isPasswordVisible(): Promise<boolean> {
    const type = await this.passwordInput.getAttribute('type');
    return type === 'text';
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    await this.errorMessage.waitFor({ state: 'visible' });
    return await this.errorText.textContent() || '';
  }

  /**
   * Check if error message is visible
   */
  async isErrorVisible(): Promise<boolean> {
    return await this.errorMessage.isVisible();
  }

  /**
   * Check if login button is loading
   */
  async isLoginButtonLoading(): Promise<boolean> {
    return await this.loginButton.evaluate((el) => el.classList.contains('loading'));
  }

  /**
   * Wait for successful login redirect
   */
  async waitForLoginSuccess() {
    await this.page.waitForURL('**/index.html', { timeout: 10000 });
  }

  /**
   * Check form validation
   */
  async expectEmailRequired() {
    await expect(this.emailInput).toHaveAttribute('required', '');
  }

  async expectPasswordRequired() {
    await expect(this.passwordInput).toHaveAttribute('required', '');
  }

  /**
   * Check page title
   */
  async expectTitle() {
    await expect(this.page).toHaveTitle(/Giris Yap.*IhsanAI/);
  }

  /**
   * Check login card is visible
   */
  async expectLoginCardVisible() {
    await expect(this.loginCard).toBeVisible();
  }
}
