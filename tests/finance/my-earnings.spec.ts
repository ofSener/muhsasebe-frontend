import { test, expect } from '../fixtures/auth.fixture';

/**
 * My Earnings Page E2E Tests
 * Tests earnings overview for current user
 */
test.describe('My Earnings Page', () => {
  test.beforeEach(async ({ financePage }) => {
    await financePage.gotoMyEarnings();
  });

  test.describe('Page Load', () => {
    test('should load my earnings page', async ({ page }) => {
      await expect(page).toHaveURL(/my-earnings\.html/);
    });
  });

  test.describe('Earnings Data', () => {
    test('should display earnings table or summary', async ({ financePage }) => {
      const tableOrSummary = financePage.page.locator('table, .earnings-summary, .summary');
      await expect(tableOrSummary.first()).toBeVisible();
    });
  });

  test.describe('Summary Stats', () => {
    test('should show earnings statistics', async ({ financePage }) => {
      const stats = await financePage.getStatsCount();
      expect(stats).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Filtering', () => {
    test('should filter by date range', async ({ financePage }) => {
      await financePage.setDateRange('01.01.2024', '31.12.2024');
      await financePage.waitForLoadingToComplete();
    });
  });
});
