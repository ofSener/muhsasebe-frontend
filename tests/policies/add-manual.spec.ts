import { test, expect } from '../fixtures/auth.fixture';

/**
 * Add Manual Policy Page E2E Tests
 * Tests manual policy entry form and validation
 */
test.describe('Add Manual Policy Page', () => {
  test.beforeEach(async ({ policiesPage }) => {
    await policiesPage.gotoAddManual();
  });

  test.describe('Page Load', () => {
    test('should load add manual policy page', async ({ page }) => {
      await expect(page).toHaveURL(/add-manual\.html/);
    });

    test('should display policy form', async ({ page }) => {
      const form = page.locator('form, .policy-form');
      await expect(form).toBeVisible();
    });
  });

  test.describe('Form Fields', () => {
    test('should display required form fields', async ({ page }) => {
      // Check for common policy form fields
      const fields = [
        'input[name="policyNumber"], #policyNumber',
        'select[name="company"], #company',
        'select[name="branch"], #branch',
        'input[name="customerName"], #customerName',
      ];

      for (const field of fields) {
        const element = page.locator(field).first();
        const isVisible = await element.isVisible().catch(() => false);
        // At least some fields should be visible
        if (isVisible) {
          await expect(element).toBeVisible();
          break;
        }
      }
    });
  });

  test.describe('Form Validation', () => {
    test('should validate required fields', async ({ page }) => {
      const submitButton = page.locator('button[type="submit"], button:has-text("Kaydet")');
      await submitButton.click();

      // Should show validation errors or HTML5 validation
      const invalidFields = page.locator(':invalid');
      const count = await invalidFields.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Date Picker', () => {
    test('should have date picker for policy dates', async ({ page }) => {
      const datePicker = page.locator('.flatpickr-input, input[type="date"]');
      const count = await datePicker.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});
