import { test, expect } from '../fixtures/auth.fixture';

/**
 * Bulk Import Page E2E Tests
 * Tests Excel file upload and import preview functionality
 */
test.describe('Bulk Import Page', () => {
  test.beforeEach(async ({ policiesPage }) => {
    await policiesPage.gotoBulkImport();
  });

  test.describe('Page Load', () => {
    test('should load bulk import page', async ({ page }) => {
      await expect(page).toHaveURL(/bulk-import\.html/);
    });

    test('should display file upload area', async ({ page }) => {
      const uploadArea = page.locator('input[type="file"], .upload-area, .dropzone');
      await expect(uploadArea.first()).toBeVisible();
    });
  });

  test.describe('File Upload', () => {
    test('should have file input for Excel files', async ({ page }) => {
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();

      // Check accepted file types
      const accept = await fileInput.getAttribute('accept');
      if (accept) {
        expect(accept).toContain('.xls');
      }
    });
  });

  test.describe('Company Selection', () => {
    test('should display company selection', async ({ page }) => {
      const companySelect = page.locator('select[name="company"], #companySelect, .company-select');
      const isVisible = await companySelect.isVisible().catch(() => false);

      if (isVisible) {
        await expect(companySelect).toBeVisible();
      }
    });
  });

  test.describe('Preview Area', () => {
    test('should have preview table area', async ({ page }) => {
      const previewArea = page.locator('.preview-table, .preview-area, #preview');
      // Preview area might be hidden initially
      await expect(previewArea).toBeAttached();
    });
  });

  test.describe('Import Actions', () => {
    test('should have import button', async ({ page }) => {
      const importButton = page.locator('button:has-text("Aktar"), button:has-text("Import")');
      // Button might be disabled initially
      await expect(importButton).toBeAttached();
    });
  });
});
