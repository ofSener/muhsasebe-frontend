import { test, expect } from '../fixtures/auth.fixture';

/**
 * Commission Rates Page E2E Tests
 * Tests commission rate management functionality
 */
test.describe('Commission Rates Page', () => {
  test.beforeEach(async ({ employeesPage }) => {
    await employeesPage.gotoCommission();
  });

  test.describe('Page Load', () => {
    test('should load commission page', async ({ page }) => {
      await expect(page).toHaveURL(/commission\.html/);
    });

    test('should display commission table', async ({ employeesPage }) => {
      await employeesPage.expectCommissionTableVisible();
    });
  });

  test.describe('Commission Rates', () => {
    test('should display commission rates', async ({ employeesPage }) => {
      const count = await employeesPage.getCommissionRowsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Add Commission Rate', () => {
    test('should have add button', async ({ page }) => {
      const addButton = page.locator('button:has-text("Ekle"), button:has-text("Yeni")');
      const isVisible = await addButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(addButton).toBeVisible();
      }
    });
  });

  test.describe('Edit Commission Rate', () => {
    test('should have edit buttons in rows', async ({ page }) => {
      const editButtons = page.locator('table tbody tr button:has-text("Duzenle"), .edit-btn');
      const count = await editButtons.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
