import { test, expect } from '../fixtures/auth.fixture';

/**
 * Report Settings Page E2E Tests
 * Tests report configuration functionality
 */
test.describe('Report Settings Page', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.gotoReportSettings();
  });

  test.describe('Page Load', () => {
    test('should load report settings page', async ({ page }) => {
      await expect(page).toHaveURL(/report-settings\.html/);
    });

    test('should display settings form', async ({ settingsPage }) => {
      await settingsPage.expectSettingsFormVisible();
    });
  });

  test.describe('Settings Form', () => {
    test('should have form fields', async ({ page }) => {
      const formFields = page.locator('input, select, textarea').filter({ has: page.locator('[name]') });
      const count = await formFields.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Save Settings', () => {
    test('should have save button', async ({ settingsPage }) => {
      await expect(settingsPage.saveSettingsButton).toBeVisible();
    });

    test('should save settings on submit', async ({ settingsPage }) => {
      await settingsPage.saveSettings();
      // Should show success toast or update
      await settingsPage.waitForLoadingToComplete();
    });
  });
});
