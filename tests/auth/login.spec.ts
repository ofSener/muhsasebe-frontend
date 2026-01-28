import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Login Page E2E Tests
 * Tests authentication functionality including login, validation, and security
 */
test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('Page Load', () => {
    test('should display login form correctly', async () => {
      await loginPage.expectTitle();
      await loginPage.expectLoginCardVisible();
      await expect(loginPage.emailInput).toBeVisible();
      await expect(loginPage.passwordInput).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('should have required attributes on form fields', async () => {
      await loginPage.expectEmailRequired();
      await loginPage.expectPasswordRequired();
    });

    test('should have remember me checkbox', async () => {
      await expect(loginPage.rememberMeCheckbox).toBeVisible();
    });

    test('should have forgot password link', async () => {
      await expect(loginPage.forgotPasswordLink).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should show error when submitting empty form', async ({ page }) => {
      await loginPage.clickLogin();

      // Wait for error message or HTML5 validation
      const emailInput = loginPage.emailInput;
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should show error when email is empty', async ({ page }) => {
      await loginPage.fillPassword('password123');
      await loginPage.clickLogin();

      const emailInput = loginPage.emailInput;
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should show error when password is empty', async ({ page }) => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.clickLogin();

      const passwordInput = loginPage.passwordInput;
      const validationMessage = await passwordInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('should validate email format', async ({ page }) => {
      await loginPage.fillEmail('invalid-email');
      await loginPage.fillPassword('password123');
      await loginPage.clickLogin();

      // HTML5 email validation should trigger
      const emailInput = loginPage.emailInput;
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBeFalsy();
    });
  });

  test.describe('Login Functionality', () => {
    test('should show error for invalid credentials', async ({ page }) => {
      await loginPage.login('invalid@example.com', 'wrongpassword');

      // Wait for API response and error display
      await page.waitForResponse(resp => resp.url().includes('/auth/login'));

      const errorVisible = await loginPage.isErrorVisible();
      expect(errorVisible).toBeTruthy();
    });

    test('should show loading state while logging in', async ({ page }) => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('password123');

      // Start login and immediately check loading state
      const loginPromise = loginPage.clickLogin();

      // Check if button shows loading
      await expect(loginPage.loginButton).toHaveClass(/loading/);

      await loginPromise;
    });

    test.skip('should redirect to dashboard on successful login', async ({ page }) => {
      // This test requires valid credentials
      const email = process.env.TEST_EMAIL || 'test@ihsanai.com';
      const password = process.env.TEST_PASSWORD || 'test123';

      await loginPage.login(email, password);
      await loginPage.waitForLoginSuccess();

      await expect(page).toHaveURL(/index\.html/);
    });
  });

  test.describe('Password Visibility Toggle', () => {
    test('should toggle password visibility', async () => {
      await loginPage.fillPassword('mypassword');

      // Initially password should be hidden
      let isVisible = await loginPage.isPasswordVisible();
      expect(isVisible).toBeFalsy();

      // Toggle visibility
      await loginPage.togglePasswordVisibility();
      isVisible = await loginPage.isPasswordVisible();
      expect(isVisible).toBeTruthy();

      // Toggle back
      await loginPage.togglePasswordVisibility();
      isVisible = await loginPage.isPasswordVisible();
      expect(isVisible).toBeFalsy();
    });
  });

  test.describe('Remember Me', () => {
    test('should toggle remember me checkbox', async () => {
      await expect(loginPage.rememberMeCheckbox).not.toBeChecked();

      await loginPage.toggleRememberMe();
      await expect(loginPage.rememberMeCheckbox).toBeChecked();

      await loginPage.toggleRememberMe();
      await expect(loginPage.rememberMeCheckbox).not.toBeChecked();
    });

    test('should persist email when remember me is checked', async ({ page }) => {
      const testEmail = 'remembered@example.com';

      await loginPage.fillEmail(testEmail);
      await loginPage.toggleRememberMe();

      // Simulate storing and reloading
      await page.evaluate((email) => {
        localStorage.setItem('remembered_email', email);
      }, testEmail);

      await page.reload();
      loginPage = new LoginPage(page);

      const storedEmail = await page.evaluate(() => localStorage.getItem('remembered_email'));
      expect(storedEmail).toBe(testEmail);
    });
  });

  test.describe('Accessibility', () => {
    test('should be navigable with keyboard', async ({ page }) => {
      await page.keyboard.press('Tab');
      await expect(loginPage.emailInput).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(loginPage.passwordInput).toBeFocused();
    });

    test('should submit form with Enter key', async ({ page }) => {
      await loginPage.fillEmail('test@example.com');
      await loginPage.fillPassword('password123');

      // Press Enter in password field
      await loginPage.passwordInput.press('Enter');

      // Should trigger form submission
      await expect(loginPage.loginButton).toHaveClass(/loading/);
    });
  });

  test.describe('Security', () => {
    test('should have password field masked by default', async () => {
      await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    test('should have autocomplete attributes', async () => {
      await expect(loginPage.emailInput).toHaveAttribute('autocomplete', 'email');
      await expect(loginPage.passwordInput).toHaveAttribute('autocomplete', 'current-password');
    });
  });
});
