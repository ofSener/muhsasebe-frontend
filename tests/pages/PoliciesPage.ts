import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Policies Page Object Model
 * Handles all interactions with policy-related pages
 */
export class PoliciesPage extends BasePage {
  readonly policiesTable: Locator;
  readonly policyRows: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly addPolicyButton: Locator;
  readonly exportButton: Locator;
  readonly pagination: Locator;
  readonly policyDetailModal: Locator;
  readonly batchActions: Locator;
  readonly selectAllCheckbox: Locator;
  readonly dateRangePicker: Locator;
  readonly statusFilter: Locator;
  readonly companyFilter: Locator;
  readonly branchFilter: Locator;

  constructor(page: Page) {
    super(page);
    this.policiesTable = page.locator('table, .table, [class*="table"]');
    this.policyRows = page.locator('table tbody tr, .table-row, [class*="row"]');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Ara"], .search-input');
    this.filterButton = page.locator('button:has-text("Filtre"), .filter-button');
    this.addPolicyButton = page.locator('button:has-text("Ekle"), button:has-text("Yeni"), .add-policy-btn');
    this.exportButton = page.locator('button:has-text("Excel"), button:has-text("Indir")');
    this.pagination = page.locator('.pagination, [class*="pagination"]');
    this.policyDetailModal = page.locator('.policy-detail-modal, .modal');
    this.batchActions = page.locator('.batch-actions, [class*="batch"]');
    this.selectAllCheckbox = page.locator('th input[type="checkbox"], .select-all');
    this.dateRangePicker = page.locator('.flatpickr-input, input[data-date]');
    this.statusFilter = page.locator('select[name="status"], .status-filter');
    this.companyFilter = page.locator('select[name="company"], .company-filter');
    this.branchFilter = page.locator('select[name="branch"], .branch-filter');
  }

  /**
   * Navigate to My Policies page
   */
  async gotoMyPolicies() {
    await this.page.goto('/pages/policies/my-policies.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Policy Pool page
   */
  async gotoPool() {
    await this.page.goto('/pages/policies/pool.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Captured Policies page
   */
  async gotoCaptured() {
    await this.page.goto('/pages/policies/captured.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Add Manual Policy page
   */
  async gotoAddManual() {
    await this.page.goto('/pages/policies/add-manual.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Bulk Import page
   */
  async gotoBulkImport() {
    await this.page.goto('/pages/policies/bulk-import.html');
    await this.waitForPageLoad();
  }

  /**
   * Get number of policy rows
   */
  async getPolicyCount(): Promise<number> {
    await this.policiesTable.waitFor({ state: 'visible', timeout: 10000 });
    return await this.policyRows.count();
  }

  /**
   * Search for a policy
   */
  async searchPolicy(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Clear search
   */
  async clearSearch() {
    await this.searchInput.clear();
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Click on a policy row to view details
   */
  async viewPolicyDetails(rowIndex: number = 0) {
    const row = this.policyRows.nth(rowIndex);
    await row.click();
    await this.policyDetailModal.waitFor({ state: 'visible' });
  }

  /**
   * Select a policy checkbox
   */
  async selectPolicy(rowIndex: number) {
    const checkbox = this.policyRows.nth(rowIndex).locator('input[type="checkbox"]');
    await checkbox.check();
  }

  /**
   * Select all policies
   */
  async selectAllPolicies() {
    await this.selectAllCheckbox.check();
  }

  /**
   * Deselect all policies
   */
  async deselectAllPolicies() {
    await this.selectAllCheckbox.uncheck();
  }

  /**
   * Get selected policies count
   */
  async getSelectedCount(): Promise<number> {
    const checkedBoxes = this.policyRows.locator('input[type="checkbox"]:checked');
    return await checkedBoxes.count();
  }

  /**
   * Apply date filter
   */
  async filterByDateRange(startDate: string, endDate: string) {
    await this.dateRangePicker.first().fill(startDate);
    await this.dateRangePicker.last().fill(endDate);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Filter by status
   */
  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
    await this.waitForLoadingToComplete();
  }

  /**
   * Filter by company
   */
  async filterByCompany(company: string) {
    await this.companyFilter.selectOption(company);
    await this.waitForLoadingToComplete();
  }

  /**
   * Export policies to Excel
   */
  async exportToExcel() {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click()
    ]);
    return download;
  }

  /**
   * Go to next page
   */
  async goToNextPage() {
    const nextButton = this.pagination.locator('button:has-text("Sonraki"), .next, [aria-label="Next"]');
    await nextButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Go to previous page
   */
  async goToPreviousPage() {
    const prevButton = this.pagination.locator('button:has-text("Onceki"), .prev, [aria-label="Previous"]');
    await prevButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get current page number
   */
  async getCurrentPage(): Promise<number> {
    const currentPage = this.pagination.locator('.current, .active, [aria-current="page"]');
    const text = await currentPage.textContent();
    return parseInt(text || '1', 10);
  }

  /**
   * Assertions
   */
  async expectTableVisible() {
    await expect(this.policiesTable).toBeVisible();
  }

  async expectPoliciesLoaded() {
    await expect(this.policyRows.first()).toBeVisible({ timeout: 10000 });
  }

  async expectSearchResultsEmpty() {
    const emptyMessage = this.page.locator('.empty-state, .no-results, :text("Sonuc bulunamadi")');
    await expect(emptyMessage).toBeVisible();
  }

  async expectPolicyCount(count: number) {
    await expect(this.policyRows).toHaveCount(count);
  }
}
