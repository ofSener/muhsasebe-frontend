import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Customers Page Object Model
 * Handles all interactions with customer-related pages
 */
export class CustomersPage extends BasePage {
  readonly customersTable: Locator;
  readonly customerRows: Locator;
  readonly searchInput: Locator;
  readonly addCustomerButton: Locator;
  readonly customerDetailModal: Locator;
  readonly editCustomerButton: Locator;
  readonly deleteCustomerButton: Locator;
  readonly customerName: Locator;
  readonly customerTC: Locator;
  readonly customerPhone: Locator;
  readonly customerEmail: Locator;
  readonly customerPolicies: Locator;

  constructor(page: Page) {
    super(page);
    this.customersTable = page.locator('table, .table, [class*="table"]');
    this.customerRows = page.locator('table tbody tr, .customer-row');
    this.searchInput = page.locator('input[type="search"], input[placeholder*="Ara"], .search-input');
    this.addCustomerButton = page.locator('button:has-text("Ekle"), button:has-text("Yeni Musteri")');
    this.customerDetailModal = page.locator('.customer-detail-modal, .modal');
    this.editCustomerButton = page.locator('button:has-text("Duzenle"), .edit-btn');
    this.deleteCustomerButton = page.locator('button:has-text("Sil"), .delete-btn');
    this.customerName = page.locator('.customer-name, [data-field="name"]');
    this.customerTC = page.locator('.customer-tc, [data-field="tc"]');
    this.customerPhone = page.locator('.customer-phone, [data-field="phone"]');
    this.customerEmail = page.locator('.customer-email, [data-field="email"]');
    this.customerPolicies = page.locator('.customer-policies, .policy-list');
  }

  /**
   * Navigate to Customers List page
   */
  async gotoList() {
    await this.page.goto('/pages/customers/list.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Customer Detail page
   */
  async gotoDetail(customerId: string) {
    await this.page.goto(`/pages/customers/detail.html?id=${customerId}`);
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Renewals page
   */
  async gotoRenewals() {
    await this.page.goto('/pages/customers/renewals.html');
    await this.waitForPageLoad();
  }

  /**
   * Get number of customer rows
   */
  async getCustomerCount(): Promise<number> {
    await this.customersTable.waitFor({ state: 'visible', timeout: 10000 });
    return await this.customerRows.count();
  }

  /**
   * Search for a customer
   */
  async searchCustomer(query: string) {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForLoadingToComplete();
  }

  /**
   * Click on a customer row to view details
   */
  async viewCustomerDetails(rowIndex: number = 0) {
    const row = this.customerRows.nth(rowIndex);
    await row.click();
  }

  /**
   * Get customer info from a row
   */
  async getCustomerInfo(rowIndex: number): Promise<{ name: string; tc: string; phone: string }> {
    const row = this.customerRows.nth(rowIndex);
    const name = await row.locator('td').nth(1).textContent() || '';
    const tc = await row.locator('td').nth(2).textContent() || '';
    const phone = await row.locator('td').nth(3).textContent() || '';
    return { name: name.trim(), tc: tc.trim(), phone: phone.trim() };
  }

  /**
   * Add new customer
   */
  async clickAddCustomer() {
    await this.addCustomerButton.click();
    await this.customerDetailModal.waitFor({ state: 'visible' });
  }

  /**
   * Edit customer
   */
  async clickEditCustomer() {
    await this.editCustomerButton.click();
    await this.customerDetailModal.waitFor({ state: 'visible' });
  }

  /**
   * Delete customer
   */
  async clickDeleteCustomer() {
    await this.deleteCustomerButton.click();
  }

  /**
   * Fill customer form
   */
  async fillCustomerForm(customerData: {
    name?: string;
    surname?: string;
    tc?: string;
    phone?: string;
    email?: string;
  }) {
    if (customerData.name) {
      await this.page.locator('input[name="name"], #customerName').fill(customerData.name);
    }
    if (customerData.surname) {
      await this.page.locator('input[name="surname"], #customerSurname').fill(customerData.surname);
    }
    if (customerData.tc) {
      await this.page.locator('input[name="tc"], #customerTC').fill(customerData.tc);
    }
    if (customerData.phone) {
      await this.page.locator('input[name="phone"], #customerPhone').fill(customerData.phone);
    }
    if (customerData.email) {
      await this.page.locator('input[name="email"], #customerEmail').fill(customerData.email);
    }
  }

  /**
   * Submit customer form
   */
  async submitCustomerForm() {
    const submitButton = this.page.locator('button[type="submit"], button:has-text("Kaydet")');
    await submitButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get customer policies count on detail page
   */
  async getCustomerPoliciesCount(): Promise<number> {
    const policyRows = this.customerPolicies.locator('tr, .policy-item');
    return await policyRows.count();
  }

  /**
   * Assertions
   */
  async expectTableVisible() {
    await expect(this.customersTable).toBeVisible();
  }

  async expectCustomersLoaded() {
    await expect(this.customerRows.first()).toBeVisible({ timeout: 10000 });
  }

  async expectSearchResultsEmpty() {
    const emptyMessage = this.page.locator('.empty-state, .no-results, :text("Sonuc bulunamadi")');
    await expect(emptyMessage).toBeVisible();
  }

  async expectCustomerCount(count: number) {
    await expect(this.customerRows).toHaveCount(count);
  }

  async expectCustomerDetailVisible() {
    await expect(this.customerName.first()).toBeVisible();
  }
}
