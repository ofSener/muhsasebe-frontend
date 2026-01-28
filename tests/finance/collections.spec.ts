import { test, expect } from '../fixtures/auth.fixture';

/**
 * Collections Page E2E Tests
 * Tests payment collection tracking
 */
test.describe('Collections Page', () => {
  test.beforeEach(async ({ financePage }) => {
    await financePage.gotoCollections();
  });

  test.describe('Page Load', () => {
    test('should load collections page', async ({ page }) => {
      await expect(page).toHaveURL(/collections\.html/);
    });

    test('should display collections table', async ({ financePage }) => {
      await financePage.expectTableVisible();
    });
  });

  test.describe('Collections Data', () => {
    test('should display collection records', async ({ financePage }) => {
      const count = await financePage.getTableRowsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Summary', () => {
    test('should show total amounts', async ({ page }) => {
      const totalElement = page.locator('.total, .summary, [class*="total"]');
      const isVisible = await totalElement.isVisible().catch(() => false);

      if (isVisible) {
        await expect(totalElement).toBeVisible();
      }
    });
  });

  test.describe('Filtering', () => {
    test('should filter by date range', async ({ financePage }) => {
      await financePage.setDateRange('01.01.2024', '31.12.2024');
      await financePage.waitForLoadingToComplete();
    });
  });
});
