import { test, expect } from '../fixtures/auth.fixture';

/**
 * Finance Dashboard Page E2E Tests
 * Tests financial overview and statistics
 */
test.describe('Finance Dashboard Page', () => {
  test.beforeEach(async ({ financePage }) => {
    await financePage.gotoDashboard();
  });

  test.describe('Page Load', () => {
    test('should load finance dashboard page', async ({ page }) => {
      await expect(page).toHaveURL(/dashboard\.html/);
    });

    test('should display stats cards', async ({ financePage }) => {
      await financePage.expectStatsCardsVisible();
    });
  });

  test.describe('Statistics', () => {
    test('should display financial stats', async ({ financePage }) => {
      const count = await financePage.getStatsCount();
      expect(count).toBeGreaterThan(0);
    });

    test('should show stat values', async ({ financePage }) => {
      const value = await financePage.getStatValue(0);
      expect(value).toBeTruthy();
    });
  });

  test.describe('Charts', () => {
    test('should render financial charts', async ({ financePage }) => {
      const chartsRendered = await financePage.areChartsRendered();
      expect(chartsRendered).toBeTruthy();
    });
  });

  test.describe('Date Filtering', () => {
    test('should filter by date range', async ({ financePage }) => {
      await financePage.setDateRange('01.01.2024', '31.12.2024');
      await financePage.waitForLoadingToComplete();
    });
  });
});
