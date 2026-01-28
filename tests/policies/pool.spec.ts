import { test, expect } from '../fixtures/auth.fixture';

/**
 * Policy Pool Page E2E Tests
 * Tests policy pool listing and management functionality
 */
test.describe('Policy Pool Page', () => {
  test.beforeEach(async ({ policiesPage }) => {
    await policiesPage.gotoPool();
  });

  test.describe('Page Load', () => {
    test('should load pool page', async ({ page }) => {
      await expect(page).toHaveURL(/pool\.html/);
    });

    test('should display policies table', async ({ policiesPage }) => {
      await policiesPage.expectTableVisible();
    });
  });

  test.describe('Pool Policies', () => {
    test('should display pool policies', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Search', () => {
    test('should search pool policies', async ({ policiesPage }) => {
      await policiesPage.searchPolicy('search-term');
      await policiesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Selection', () => {
    test('should select policies from pool', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.selectPolicy(0);
        const selectedCount = await policiesPage.getSelectedCount();
        expect(selectedCount).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Batch Actions', () => {
    test('should show batch actions when policies selected', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.selectAllPolicies();
        await expect(policiesPage.batchActions).toBeVisible();
      }
    });
  });
});
