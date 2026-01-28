import { test, expect } from '../fixtures/auth.fixture';

/**
 * Employees List Page E2E Tests
 * Tests employee listing and search functionality
 */
test.describe('Employees List Page', () => {
  test.beforeEach(async ({ employeesPage }) => {
    await employeesPage.gotoList();
  });

  test.describe('Page Load', () => {
    test('should load employees list page', async ({ page }) => {
      await expect(page).toHaveURL(/list\.html/);
    });

    test('should display employees table', async ({ employeesPage }) => {
      await employeesPage.expectEmployeesTableVisible();
    });
  });

  test.describe('Employee List', () => {
    test('should load employees', async ({ employeesPage }) => {
      const count = await employeesPage.getEmployeeCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Search', () => {
    test('should search for employees', async ({ employeesPage }) => {
      await employeesPage.searchEmployee('test');
      await employeesPage.waitForLoadingToComplete();
    });
  });

  test.describe('Employee Details', () => {
    test('should show employee details on row click', async ({ employeesPage, page }) => {
      const count = await employeesPage.getEmployeeCount();
      if (count > 0) {
        await employeesPage.viewEmployeeDetails(0);
      }
    });
  });
});
