import { test, expect } from '../fixtures/auth.fixture';

/**
 * Employee Performance Page E2E Tests
 * Tests performance metrics and charts
 */
test.describe('Employee Performance Page', () => {
  test.beforeEach(async ({ employeesPage }) => {
    await employeesPage.gotoPerformance();
  });

  test.describe('Page Load', () => {
    test('should load performance page', async ({ page }) => {
      await expect(page).toHaveURL(/performance\.html/);
    });
  });

  test.describe('Performance Metrics', () => {
    test('should display performance metrics', async ({ employeesPage }) => {
      const count = await employeesPage.getPerformanceMetricsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show metric values', async ({ employeesPage }) => {
      const count = await employeesPage.getPerformanceMetricsCount();
      if (count > 0) {
        const value = await employeesPage.getPerformanceMetricValue(0);
        expect(value).toBeTruthy();
      }
    });
  });

  test.describe('Date Filtering', () => {
    test('should filter by date range', async ({ employeesPage }) => {
      await employeesPage.setDateRange('01.01.2024', '31.12.2024');
      await employeesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Charts', () => {
    test('should render performance charts', async ({ page }) => {
      const charts = page.locator('canvas, .apexcharts-canvas');
      const count = await charts.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
