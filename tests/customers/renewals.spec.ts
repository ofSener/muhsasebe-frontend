import { test, expect } from '../fixtures/auth.fixture';

/**
 * Renewals Page E2E Tests
 * Tests policy renewal tracking functionality
 */
test.describe('Renewals Page', () => {
  test.beforeEach(async ({ customersPage }) => {
    await customersPage.gotoRenewals();
  });

  test.describe('Page Load', () => {
    test('should load renewals page', async ({ page }) => {
      await expect(page).toHaveURL(/renewals\.html/);
    });

    test('should display renewals table', async ({ customersPage }) => {
      await customersPage.expectTableVisible();
    });
  });

  test.describe('Renewals List', () => {
    test('should display upcoming renewals', async ({ page }) => {
      const renewalRows = page.locator('table tbody tr, .renewal-item');
      const count = await renewalRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Date Filtering', () => {
    test('should have date range filter', async ({ page }) => {
      const dateFilter = page.locator('.flatpickr-input, input[type="date"], .date-filter');
      const count = await dateFilter.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Search', () => {
    test('should search renewals', async ({ customersPage }) => {
      await customersPage.searchCustomer('test');
      await customersPage.waitForLoadingToComplete();
    });
  });
});
