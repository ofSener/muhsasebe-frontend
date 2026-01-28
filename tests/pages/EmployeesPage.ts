import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Employees Page Object Model
 * Handles all interactions with employee-related pages
 */
export class EmployeesPage extends BasePage {
  readonly employeesTable: Locator;
  readonly employeeRows: Locator;
  readonly searchInput: Locator;
  readonly addEmployeeButton: Locator;
  readonly performanceMetrics: Locator;
  readonly trackingTable: Locator;
  readonly commissionTable: Locator;
  readonly dateRangePicker: Locator;
  readonly exportButton: Locator;

  constructor(page: Page) {
    super(page);
    this.employeesTable = page.locator('.employees-table, table');
    this.employeeRows = page.locator('.employee-row, table tbody tr');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Ara"], .search-input');
    this.addEmployeeButton = page.locator('button:has-text("Ekle"), button:has-text("Yeni Calisan")');
    this.performanceMetrics = page.locator('.performance-metrics, .metrics, [class*="metric"]');
    this.trackingTable = page.locator('.tracking-table, table');
    this.commissionTable = page.locator('.commission-table, table');
    this.dateRangePicker = page.locator('.flatpickr-input, input[data-date]');
    this.exportButton = page.locator('button:has-text("Excel"), button:has-text("Indir")');
  }

  /**
   * Navigate to Employees List page
   */
  async gotoList() {
    await this.page.goto('/pages/employees/list.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Performance page
   */
  async gotoPerformance() {
    await this.page.goto('/pages/employees/performance.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Tracking page
   */
  async gotoTracking() {
    await this.page.goto('/pages/employees/tracking.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Commission page
   */
  async gotoCommission() {
    await this.page.goto('/pages/employees/commission.html');
    await this.waitForPageLoad();
  }

  /**
   * Get employee count
   */
  async getEmployeeCount(): Promise<number> {
    await this.employeesTable.waitFor({ state: 'visible', timeout: 10000 });
    return await this.employeeRows.count();
  }

  /**
   * Search for an employee
   */
  async searchEmployee(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Click on an employee row
   */
  async viewEmployeeDetails(rowIndex: number = 0) {
    const row = this.employeeRows.nth(rowIndex);
    await row.click();
  }

  /**
   * Get employee info from a row
   */
  async getEmployeeInfo(rowIndex: number): Promise<{ name: string; role: string }> {
    const row = this.employeeRows.nth(rowIndex);
    const name = await row.locator('td').nth(1).textContent() || '';
    const role = await row.locator('td').nth(2).textContent() || '';
    return { name: name.trim(), role: role.trim() };
  }

  /**
   * Get performance metrics count
   */
  async getPerformanceMetricsCount(): Promise<number> {
    return await this.performanceMetrics.locator('.metric-card, .stat-card').count();
  }

  /**
   * Get performance metric value by index
   */
  async getPerformanceMetricValue(index: number): Promise<string> {
    const metric = this.performanceMetrics.locator('.metric-card, .stat-card').nth(index);
    const value = metric.locator('.value, h2, h3').first();
    return await value.textContent() || '';
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
   * Export to Excel
   */
  async exportToExcel() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click()
    ]);
    return download;
  }

  /**
   * Get tracking table rows count
   */
  async getTrackingRowsCount(): Promise<number> {
    const rows = this.trackingTable.locator('tbody tr');
    return await rows.count();
  }

  /**
   * Get commission table rows count
   */
  async getCommissionRowsCount(): Promise<number> {
    const rows = this.commissionTable.locator('tbody tr');
    return await rows.count();
  }

  /**
   * Assertions
   */
  async expectEmployeesTableVisible() {
    await expect(this.employeesTable).toBeVisible();
  }

  async expectEmployeesLoaded() {
    await expect(this.employeeRows.first()).toBeVisible({ timeout: 10000 });
  }

  async expectPerformanceMetricsVisible() {
    await expect(this.performanceMetrics.first()).toBeVisible();
  }

  async expectTrackingTableVisible() {
    await expect(this.trackingTable).toBeVisible();
  }

  async expectCommissionTableVisible() {
    await expect(this.commissionTable).toBeVisible();
  }
}
