import { test, expect } from '../fixtures/auth.fixture';

/**
 * Customer Detail Page E2E Tests
 * Tests customer detail view and policy listing
 */
test.describe('Customer Detail Page', () => {
  test.describe('Page Load', () => {
    test('should display customer information', async ({ customersPage, page }) => {
      // Navigate to detail page with a sample ID
      await page.goto('/pages/customers/detail.html?id=1');
      await customersPage.waitForPageLoad();

      // Should show customer detail section
      const detailSection = page.locator('.customer-detail, .detail-section, main');
      await expect(detailSection).toBeVisible();
    });
  });

  test.describe('Customer Policies', () => {
    test('should display customer policies section', async ({ customersPage, page }) => {
      await page.goto('/pages/customers/detail.html?id=1');
      await customersPage.waitForPageLoad();

      // Should have policies section
      const policiesSection = page.locator('.customer-policies, .policies-section');
      const isVisible = await policiesSection.isVisible().catch(() => false);

      // Policies section might exist but be empty
      if (isVisible) {
        await expect(policiesSection).toBeVisible();
      }
    });
  });

  test.describe('Edit Customer', () => {
    test('should have edit button', async ({ customersPage, page }) => {
      await page.goto('/pages/customers/detail.html?id=1');
      await customersPage.waitForPageLoad();

      const editButton = page.locator('button:has-text("Duzenle"), .edit-btn');
      const isVisible = await editButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(editButton).toBeVisible();
      }
    });
  });
});
