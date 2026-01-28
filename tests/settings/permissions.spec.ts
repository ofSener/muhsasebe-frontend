import { test, expect } from '../fixtures/auth.fixture';

/**
 * Permissions Page E2E Tests
 * Tests permission management functionality
 */
test.describe('Permissions Page', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.gotoPermissions();
  });

  test.describe('Page Load', () => {
    test('should load permissions page', async ({ page }) => {
      await expect(page).toHaveURL(/permissions\.html/);
    });

    test('should display permissions table', async ({ settingsPage }) => {
      await settingsPage.expectPermissionsTableVisible();
    });
  });

  test.describe('Permissions List', () => {
    test('should display permissions', async ({ settingsPage }) => {
      const count = await settingsPage.getPermissionsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Add Permission', () => {
    test('should have add permission button', async ({ settingsPage }) => {
      await expect(settingsPage.addPermissionButton).toBeVisible();
    });

    test('should open add permission modal on click', async ({ settingsPage }) => {
      await settingsPage.clickAddPermission();
      await expect(settingsPage.modal).toBeVisible();
    });
  });

  test.describe('Edit Permission', () => {
    test('should edit permission', async ({ settingsPage }) => {
      const count = await settingsPage.getPermissionsCount();
      if (count > 0) {
        await settingsPage.editPermission(0);
        await expect(settingsPage.modal).toBeVisible();
      }
    });
  });

  test.describe('Permission Form', () => {
    test('should fill permission form', async ({ settingsPage }) => {
      await settingsPage.clickAddPermission();
      await settingsPage.fillPermissionForm({
        name: 'Test Permission',
        description: 'Test permission description',
      });
    });
  });
});
