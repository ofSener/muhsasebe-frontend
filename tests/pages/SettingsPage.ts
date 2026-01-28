import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Settings Page Object Model
 * Handles all interactions with settings-related pages
 */
export class SettingsPage extends BasePage {
  readonly permissionsTable: Locator;
  readonly permissionRows: Locator;
  readonly addPermissionButton: Locator;
  readonly editPermissionButton: Locator;
  readonly deletePermissionButton: Locator;
  readonly agencyCodesTable: Locator;
  readonly agencyCodeRows: Locator;
  readonly addAgencyCodeButton: Locator;
  readonly driveConnectButton: Locator;
  readonly driveDisconnectButton: Locator;
  readonly driveStatus: Locator;
  readonly reportSettingsForm: Locator;
  readonly saveSettingsButton: Locator;

  constructor(page: Page) {
    super(page);
    this.permissionsTable = page.locator('.permissions-table, table');
    this.permissionRows = page.locator('.permission-row, table tbody tr');
    this.addPermissionButton = page.locator('button:has-text("Yetki Ekle"), button:has-text("Yeni Yetki")');
    this.editPermissionButton = page.locator('button:has-text("Duzenle"), .edit-btn');
    this.deletePermissionButton = page.locator('button:has-text("Sil"), .delete-btn');
    this.agencyCodesTable = page.locator('.agency-codes-table, table');
    this.agencyCodeRows = page.locator('.agency-code-row, table tbody tr');
    this.addAgencyCodeButton = page.locator('button:has-text("Acente Ekle"), button:has-text("Yeni Kod")');
    this.driveConnectButton = page.locator('button:has-text("Baglan"), button:has-text("Connect")');
    this.driveDisconnectButton = page.locator('button:has-text("Baglantıyı Kes"), button:has-text("Disconnect")');
    this.driveStatus = page.locator('.drive-status, .connection-status');
    this.reportSettingsForm = page.locator('.report-settings-form, form');
    this.saveSettingsButton = page.locator('button:has-text("Kaydet"), button[type="submit"]');
  }

  /**
   * Navigate to Permissions page
   */
  async gotoPermissions() {
    await this.page.goto('/pages/settings/permissions.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Agency Codes page
   */
  async gotoAgencyCodes() {
    await this.page.goto('/pages/settings/agency-codes.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Drive Integration page
   */
  async gotoDriveIntegration() {
    await this.page.goto('/pages/settings/drive-integration.html');
    await this.waitForPageLoad();
  }

  /**
   * Navigate to Report Settings page
   */
  async gotoReportSettings() {
    await this.page.goto('/pages/settings/report-settings.html');
    await this.waitForPageLoad();
  }

  /**
   * Get permissions count
   */
  async getPermissionsCount(): Promise<number> {
    await this.permissionsTable.waitFor({ state: 'visible', timeout: 10000 });
    return await this.permissionRows.count();
  }

  /**
   * Add new permission
   */
  async clickAddPermission() {
    await this.addPermissionButton.click();
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Edit permission by row index
   */
  async editPermission(rowIndex: number) {
    const row = this.permissionRows.nth(rowIndex);
    const editBtn = row.locator('.edit-btn, button:has-text("Duzenle")');
    await editBtn.click();
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Delete permission by row index
   */
  async deletePermission(rowIndex: number) {
    const row = this.permissionRows.nth(rowIndex);
    const deleteBtn = row.locator('.delete-btn, button:has-text("Sil")');
    await deleteBtn.click();
  }

  /**
   * Fill permission form
   */
  async fillPermissionForm(permissionData: {
    name?: string;
    description?: string;
    canViewPolicies?: boolean;
    canEditPolicies?: boolean;
    canViewPool?: boolean;
    canTransferPolicies?: boolean;
  }) {
    if (permissionData.name) {
      await this.page.locator('input[name="name"], #permissionName').fill(permissionData.name);
    }
    if (permissionData.description) {
      await this.page.locator('textarea[name="description"], #permissionDesc').fill(permissionData.description);
    }
    if (permissionData.canViewPolicies !== undefined) {
      const checkbox = this.page.locator('input[name="canViewPolicies"]');
      if (permissionData.canViewPolicies) {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
    }
  }

  /**
   * Submit permission form
   */
  async submitPermissionForm() {
    const submitButton = this.modal.locator('button[type="submit"], button:has-text("Kaydet")');
    await submitButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Get agency codes count
   */
  async getAgencyCodesCount(): Promise<number> {
    await this.agencyCodesTable.waitFor({ state: 'visible', timeout: 10000 });
    return await this.agencyCodeRows.count();
  }

  /**
   * Add new agency code
   */
  async clickAddAgencyCode() {
    await this.addAgencyCodeButton.click();
    await this.modal.waitFor({ state: 'visible' });
  }

  /**
   * Get Drive connection status
   */
  async getDriveStatus(): Promise<string> {
    return await this.driveStatus.textContent() || '';
  }

  /**
   * Connect to Google Drive
   */
  async connectDrive() {
    await this.driveConnectButton.click();
    // This would typically open OAuth popup
  }

  /**
   * Disconnect from Google Drive
   */
  async disconnectDrive() {
    await this.driveDisconnectButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.saveSettingsButton.click();
    await this.waitForLoadingToComplete();
  }

  /**
   * Assertions
   */
  async expectPermissionsTableVisible() {
    await expect(this.permissionsTable).toBeVisible();
  }

  async expectAgencyCodesTableVisible() {
    await expect(this.agencyCodesTable).toBeVisible();
  }

  async expectDriveConnected() {
    await expect(this.driveStatus).toContainText(/Bagli|Connected/i);
  }

  async expectDriveDisconnected() {
    await expect(this.driveStatus).toContainText(/Bagli Degil|Disconnected/i);
  }

  async expectSettingsFormVisible() {
    await expect(this.reportSettingsForm).toBeVisible();
  }
}
