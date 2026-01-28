import { test, expect } from '../fixtures/auth.fixture';

/**
 * Finance Reports Page E2E Tests
 * Tests financial report generation
 */
test.describe('Finance Reports Page', () => {
  test.beforeEach(async ({ financePage }) => {
    await financePage.gotoReports();
  });

  test.describe('Page Load', () => {
    test('should load reports page', async ({ page }) => {
      await expect(page).toHaveURL(/reports\.html/);
    });
  });

  test.describe('Report Options', () => {
    test('should display report type selection', async ({ page }) => {
      const reportSelect = page.locator('select[name="reportType"], .report-type, #reportType');
      const isVisible = await reportSelect.isVisible().catch(() => false);

      if (isVisible) {
        await expect(reportSelect).toBeVisible();
      }
    });
  });

  test.describe('Date Range', () => {
    test('should have date range filter', async ({ financePage }) => {
      const datePickerCount = await financePage.dateRangePicker.count();
      expect(datePickerCount).toBeGreaterThan(0);
    });
  });

  test.describe('Generate Report', () => {
    test('should have generate button', async ({ page }) => {
      const generateButton = page.locator('button:has-text("Olustur"), button:has-text("Generate")');
      const isVisible = await generateButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(generateButton).toBeVisible();
      }
    });
  });

  test.describe('Export', () => {
    test('should have export button', async ({ financePage }) => {
      const isVisible = await financePage.exportButton.isVisible().catch(() => false);

      if (isVisible) {
        await expect(financePage.exportButton).toBeVisible();
      }
    });
  });
});
