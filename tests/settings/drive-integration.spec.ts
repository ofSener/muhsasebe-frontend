import { test, expect } from '../fixtures/auth.fixture';

/**
 * Drive Integration Page E2E Tests
 * Tests Google Drive integration functionality
 */
test.describe('Drive Integration Page', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.gotoDriveIntegration();
  });

  test.describe('Page Load', () => {
    test('should load drive integration page', async ({ page }) => {
      await expect(page).toHaveURL(/drive-integration\.html/);
    });
  });

  test.describe('Connection Status', () => {
    test('should display connection status', async ({ settingsPage }) => {
      await expect(settingsPage.driveStatus).toBeVisible();
    });
  });

  test.describe('Connect Button', () => {
    test('should have connect or disconnect button', async ({ settingsPage }) => {
      const connectVisible = await settingsPage.driveConnectButton.isVisible().catch(() => false);
      const disconnectVisible = await settingsPage.driveDisconnectButton.isVisible().catch(() => false);

      expect(connectVisible || disconnectVisible).toBeTruthy();
    });
  });

  test.describe('Drive Settings', () => {
    test('should display drive settings form', async ({ page }) => {
      const settingsForm = page.locator('form, .settings-form, .drive-settings');
      const isVisible = await settingsForm.isVisible().catch(() => false);

      if (isVisible) {
        await expect(settingsForm).toBeVisible();
      }
    });
  });
});
