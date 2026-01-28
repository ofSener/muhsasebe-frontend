import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Finance Page Object Model
 * Handles all interactions with finance-related pages
 */
export class FinancePage extends BasePage {
  readonly statsCards: Locator;
  readonly chartsContainer: Locator;
  readonly dateRangePicker: Locator;
  readonly policiesTable: Locator;
  readonly collectionsTable: Locator;
  readonly reportsSection: Locator;
  readonly earningsTable: Locator;
  readonly exportButton: Locator;
  readonly filterButton: Locator;
  readonly totalAmount: Locator;
  readonly paidAmount: Locator;
  readonly pendingAmount: Locator;

  constructor(page: Page) {
    super(page);
    this.statsCards = page.locator('.stat-card, .stats-card, [class*="stat"]');
    this.chartsContainer = page.locator('.charts, .chart-container, [class*="chart"]');
    this.dateRangePicker = page.locator('.flatpickr-input, input[data-date], .date-range');
    this.policiesTable = page.locator('.policies-table, table');
    this.collectionsTable = page.locator('.collections-table, table');
    this.reportsSection = page.locator('.reports, .report-section');
    this.earningsTable = page.locator('.earnings-table, table');
    this.exportButton = page.locator('button:has-text("Excel"), button:has-text("Indir")');
    this.filterButton = page.locator('button:has-text("Filtre"), .filter-button');
    this.totalAmount = page.locator('.total-amount, [data-field="total"]');
    this.paidAmount = page.locator('.paid-amount, [data-field="paid"]');
    this.pendingAmount = page.locator('.pending-amount, [data-field="pending"]');
  }

  /**
   * Navigate to Finance Dashboard
   */
  async gotoDashboard() {
    await this.page.goto('/pages/finance/dashboard.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Finance Policies
   */
  async gotoPolicies() {
    await this.page.goto('/pages/finance/policies.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Collections
   */
  async gotoCollections() {
    await this.page.goto('/pages/finance/collections.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to My Earnings
   */
  async gotoMyEarnings() {
    await this.page.goto('/pages/finance/my-earnings.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Finance Reports
   */
  async gotoReports() {
    await this.page.goto('/pages/finance/reports.html');
    await this.waitForPageLoad();
  }

  /**
   * Get stats card count
   */
  async getStatsCount(): Promise<number> {
    return await this.statsCards.count();
  }

  /**
   * Get stat value by index
   */
  async getStatValue(index: number): Promise<string> {
    const card = this.statsCards.nth(index);
    const value = card.locator('.stat-value, .value, h2, h3').first();
    return await value.textContent() || '';
  }

  /**
   * Check if charts are rendered
   */
  async areChartsRendered(): Promise<boolean> {
    const charts = this.page.locator('canvas, .apexcharts-canvas, [class*="apexcharts"]');
    return (await charts.count()) > 0;
  }

  /**
   * Set date range filter
   */
  async setDateRange(startDate: string, endDate: string) {
    const inputs = this.dateRangePicker;
    if (await inputs.count() >= 2) {
      await inputs.first().fill(startDate);
      await inputs.last().fill(endDate);
    } else {
      await inputs.first().fill(`${startDate} - ${endDate}`);
    }
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Get total amount text
   */
  async getTotalAmount(): Promise<string> {
    return await this.totalAmount.textContent() || '';
  }

  /**
   * Get paid amount text
   */
  async getPaidAmount(): Promise<string> {
    return await this.paidAmount.textContent() || '';
  }

  /**
   * Get pending amount text
   */
  async getPendingAmount(): Promise<string> {
    return await this.pendingAmount.textContent() || '';
  }

  /**
   * Export data to Excel
   */
  async exportToExcel() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click()
    ]);
    return download;
  }

  /**
   * Get table rows count
   */
  async getTableRowsCount(): Promise<number> {
    const rows = this.page.locator('table tbody tr');
    return await rows.count();
  }

  /**
   * Assertions
   */
  async expectDashboardLoaded() {
    await expect(this.statsCards.first()).toBeVisible();
  }

  async expectChartsVisible() {
    const chart = this.page.locator('canvas, .apexcharts-canvas').first();
    await expect(chart).toBeVisible();
  }

  async expectTableVisible() {
    await expect(this.policiesTable.or(this.collectionsTable).or(this.earningsTable)).toBeVisible();
  }

  async expectStatsCardsVisible() {
    await expect(this.statsCards.first()).toBeVisible();
  }
}
