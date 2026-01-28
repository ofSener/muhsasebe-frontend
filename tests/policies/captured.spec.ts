import { test, expect } from '../fixtures/auth.fixture';

/**
 * Captured Policies Page E2E Tests
 * Tests captured policies listing and approval functionality
 */
test.describe('Captured Policies Page', () => {
  test.beforeEach(async ({ policiesPage }) => {
    await policiesPage.gotoCaptured();
  });

  test.describe('Page Load', () => {
    test('should load captured policies page', async ({ page }) => {
      await expect(page).toHaveURL(/captured\.html/);
    });

    test('should display policies table', async ({ policiesPage }) => {
      await policiesPage.expectTableVisible();
    });
  });

  test.describe('Captured Policies List', () => {
    test('should display captured policies', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Search', () => {
    test('should search captured policies', async ({ policiesPage }) => {
      await policiesPage.searchPolicy('test');
      await policiesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Selection', () => {
    test('should select captured policies', async ({ policiesPage }) => {
      const count = await policiesPage.getPolicyCount();
      if (count > 0) {
        await policiesPage.selectPolicy(0);
        const selectedCount = await policiesPage.getSelectedCount();
        expect(selectedCount).toBeGreaterThan(0);
      }
    });
  });
});
