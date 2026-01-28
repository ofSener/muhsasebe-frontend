import { test, expect } from '../fixtures/auth.fixture';

/**
 * Dashboard Page E2E Tests
 * Tests main dashboard functionality including stats, charts, and navigation
 */
test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
    await dashboardPage.waitForLoad();
  });

  test.describe('Page Load', () => {
    test('should load dashboard page correctly', async ({ dashboardPage }) => {
      await dashboardPage.expectPageLoaded();
    });

    test('should display sidebar navigation', async ({ dashboardPage }) => {
      await dashboardPage.expectSidebarVisible();
    });

    test('should display navbar', async ({ dashboardPage }) => {
      await dashboardPage.expectNavbarVisible();
    });
  });

  test.describe('Statistics Cards', () => {
    test('should display statistics cards', async ({ dashboardPage }) => {
      const statsCount = await dashboardPage.getStatsCount();
      expect(statsCount).toBeGreaterThan(0);
    });

    test('should show stats values', async ({ dashboardPage }) => {
      const firstStatValue = await dashboardPage.getStatValue(0);
      expect(firstStatValue).toBeTruthy();
    });
  });

  test.describe('Charts', () => {
    test('should render charts', async ({ dashboardPage }) => {
      const chartsRendered = await dashboardPage.areChartsRendered();
      expect(chartsRendered).toBeTruthy();
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to policies page', async ({ dashboardPage, page }) => {
      await dashboardPage.navigateToPage('Policelerim');
      await expect(page).toHaveURL(/my-policies\.html/);
    });

    test('should navigate to customers page', async ({ dashboardPage, page }) => {
      await dashboardPage.navigateToPage('Musteriler');
      await expect(page).toHaveURL(/list\.html/);
    });
  });

  test.describe('User Info', () => {
    test('should display user information in navbar', async ({ dashboardPage }) => {
      // User dropdown should be visible
      await expect(dashboardPage.userDropdown).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page, dashboardPage }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await dashboardPage.goto();

      // On mobile, sidebar might be hidden
      const sidebarVisible = await dashboardPage.isSidebarVisible();

      if (!sidebarVisible) {
        // Should have a hamburger menu to toggle sidebar
        await dashboardPage.toggleSidebar();
        await expect(dashboardPage.sidebar).toBeVisible();
      }
    });
  });
});
