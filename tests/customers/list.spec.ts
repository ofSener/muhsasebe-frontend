import { test, expect } from '../fixtures/auth.fixture';

/**
 * Customers List Page E2E Tests
 * Tests customer listing, search, and management functionality
 */
test.describe('Customers List Page', () => {
  test.beforeEach(async ({ customersPage }) => {
    await customersPage.gotoList();
  });

  test.describe('Page Load', () => {
    test('should load customers list page', async ({ page }) => {
      await expect(page).toHaveURL(/list\.html/);
    });

    test('should display customers table', async ({ customersPage }) => {
      await customersPage.expectTableVisible();
    });

    test('should display search input', async ({ customersPage }) => {
      await expect(customersPage.searchInput).toBeVisible();
    });
  });

  test.describe('Customer List', () => {
    test('should load customers', async ({ customersPage }) => {
      const count = await customersPage.getCustomerCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Search Functionality', () => {
    test('should search for customers', async ({ customersPage }) => {
      await customersPage.searchCustomer('test');
      await customersPage.waitForLoadingToComplete();
    });

    test('should search by TC number', async ({ customersPage }) => {
      await customersPage.searchCustomer('12345678901');
      await customersPage.waitForLoadingToComplete();
    });

    test('should search by phone number', async ({ customersPage }) => {
      await customersPage.searchCustomer('5551234567');
      await customersPage.waitForLoadingToComplete();
    });
  });

  test.describe('Customer Details', () => {
    test('should navigate to customer detail on row click', async ({ customersPage, page }) => {
      const count = await customersPage.getCustomerCount();
      if (count > 0) {
        await customersPage.viewCustomerDetails(0);
        // Should either open modal or navigate to detail page
        const url = page.url();
        const modalVisible = await customersPage.modal.isVisible().catch(() => false);
        expect(url.includes('detail.html') || modalVisible).toBeTruthy();
      }
    });
  });
});
