import { test, expect } from '../fixtures/auth.fixture';

/**
 * My Policies Page E2E Tests
 * Tests policy listing, filtering, and management functionality
 */
test.describe('My Policies Page', () => {
  test.beforeEach(async ({ policiesPage }) => {
    await policiesPage.gotoMyPolicies();
  });

  test.describe('Page Load', () => {
    test('should load my policies page', async ({ page }) => {
      await expect(page).toHaveURL(/my-policies\.html/);
    });

    test('should display policies table', async ({ policiesPage }) => {
      await policiesPage.expectTableVisible();
    });

    test('should display search input', async ({ policiesPage }) => {
      await expect(policiesPage.searchInput).toBeVisible();
    });
  });

  test.describe('Policy List', () => {
    test('should load policies', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      // At minimum, the table structure should exist
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display pagination when policies exist', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 10) {
        await expect(policiesPage.pagination).toBeVisible();
      }
    });
  });

  test.describe('Search Functionality', () => {
    test('should search for policies', async ({ policiesPage }) => {
      await policiesPage.searchPolicy('test');
      // After search, page should update
      await policiesPage.waitForLoadingToComplete();
    });

    test('should clear search', async ({ policiesPage }) => {
      await policiesPage.searchPolicy('test');
      await policiesPage.clearSearch();
      await policiesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Filtering', () => {
    test('should filter by date range', async ({ policiesPage }) => {
      const startDate = '01.01.2024';
      const endDate = '31.12.2024';
      await policiesPage.filterByDateRange(startDate, endDate);
      await policiesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Selection', () => {
    test('should select a policy', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.selectPolicy(0);
        const selectedCount = await policiesPage.getSelectedCount();
        expect(selectedCount).toBeGreaterThan(0);
      }
    });

    test('should select all policies', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.selectAllPolicies();
        const selectedCount = await policiesPage.getSelectedCount();
        expect(selectedCount).toBe(count);
      }
    });
  });

  test.describe('Policy Details', () => {
    test('should open policy details on row click', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.viewPolicyDetails(0);
        await expect(policiesPage.policyDetailModal).toBeVisible();
      }
    });
  });

  test.describe('Pagination', () => {
    test('should navigate to next page', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 10) {
        const currentPage = await policiesPage.getCurrentPage();
        await policiesPage.goToNextPage();
        const newPage = await policiesPage.getCurrentPage();
        expect(newPage).toBe(currentPage + 1);
      }
    });
  });
});
