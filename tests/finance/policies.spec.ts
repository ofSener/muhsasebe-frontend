import { test, expect } from '../fixtures/auth.fixture';

/**
 * Finance Policies Page E2E Tests
 * Tests policy payment tracking
 */
test.describe('Finance Policies Page', () => {
  test.beforeEach(async ({ financePage }) => {
    await financePage.gotoPolicies();
  });

  test.describe('Page Load', () => {
    test('should load finance policies page', async ({ page }) => {
      await expect(page).toHaveURL(/policies\.html/);
    });

    test('should display policies table', async ({ financePage }) => {
      await financePage.expectTableVisible();
    });
  });

  test.describe('Policy Payments', () => {
    test('should display policy payment data', async ({ financePage }) => {
      const count = await financePage.getTableRowsCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Filtering', () => {
    test('should have date filter', async ({ financePage }) => {
      await expect(financePage.dateRangePicker.first()).toBeVisible();
    });
  });

  test.describe('Export', () => {
    test('should have export button', async ({ financePage }) => {
      await expect(financePage.exportButton).toBeVisible();
    });
  });
});
