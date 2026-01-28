import { test as base, expect } from '@playwright/test';
import { LoginPage, DashboardPage, PoliciesPage, CustomersPage, FinancePage, SettingsPage, EmployeesPage } from '../pages';

/**
 * Test credentials - these should be environment variables in production
 */
export const TEST_CREDENTIALS = {
  email: process.env.TEST_EMAIL || 'test@ihsanai.com',
  password: process.env.TEST_PASSWORD || 'test123',
};

/**
 * Extended test fixtures with page objects
 */
type PageFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  policiesPage: PoliciesPage;
  customersPage: CustomersPage;
  financePage: FinancePage;
  settingsPage: SettingsPage;
  employeesPage: EmployeesPage;
};

/**
 * Extended test with page fixtures
 */
export const test = base.extend<PageFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  policiesPage: async ({ page }, use) => {
    await use(new PoliciesPage(page));
  },
  customersPage: async ({ page }, use) => {
    await use(new CustomersPage(page));
  },
  financePage: async ({ page }, use) => {
    await use(new FinancePage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  employeesPage: async ({ page }, use) => {
    await use(new EmployeesPage(page));
  },
});

export { expect };
