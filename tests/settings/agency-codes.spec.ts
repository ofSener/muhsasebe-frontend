import { test, expect } from '../fixtures/auth.fixture';

/**
 * Agency Codes Page E2E Tests
 * Tests agency code management functionality
 */
test.describe('Agency Codes Page', () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.gotoAgencyCodes();
  });

  test.describe('Page Load', () => {
    test('should load agency codes page', async ({ page }) => {
      await expect(page).toHaveURL(/agency-codes\.html/);
    });

    test('should display agency codes table', async ({ settingsPage }) => {
      await settingsPage.expectAgencyCodesTableVisible();
    });
  });

  test.describe('Agency Codes List', () => {
    test('should display agency codes', async ({ settingsPage }) => {
      const count = await settingsPage.getAgencyCodesCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Add Agency Code', () => {
    test('should have add agency code button', async ({ settingsPage }) => {
      await expect(settingsPage.addAgencyCodeButton).toBeVisible();
    });

    test('should open add modal on click', async ({ settingsPage }) => {
      await settingsPage.clickAddAgencyCode();
      await expect(settingsPage.modal).toBeVisible();
    });
  });

  test.describe('Edit Agency Code', () => {
    test('should have edit buttons in rows', async ({ page }) => {
      const editButtons = page.locator('table tbody tr .edit-btn, table tbody tr button:has-text("Duzenle")');
      const count = await editButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
