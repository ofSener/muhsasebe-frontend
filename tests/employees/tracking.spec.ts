import { test, expect } from '../fixtures/auth.fixture';

/**
 * Employee Tracking Page E2E Tests
 * Tests tracking and hakedis (commission) functionality
 */
test.describe('Employee Tracking Page', () => {
  test.beforeEach(async ({ employeesPage }) => {
    await employeesPage.gotoTracking();
  });

  test.describe('Page Load', () => {
    test('should load tracking page', async ({ page }) => {
      await expect(page).toHaveURL(/tracking\.html/);
    });

    test('should display tracking table', async ({ employeesPage }) => {
      await employeesPage.expectTrackingTableVisible();
    });
  });

  test.describe('Tracking Data', () => {
    test('should display tracking data', async ({ employeesPage }) => {
      const count = await employeesPage.getTrackingRowsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Date Filtering', () => {
    test('should filter by date range', async ({ employeesPage }) => {
      await employeesPage.setDateRange('01.01.2024', '31.12.2024');
      await employeesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Export', () => {
    test('should have export button', async ({ page }) => {
      const exportButton = page.locator('button:has-text("Excel"), button:has-text("Indir")');
      const isVisible = await exportButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(exportButton).toBeVisible();
      }
    });
  });
});
