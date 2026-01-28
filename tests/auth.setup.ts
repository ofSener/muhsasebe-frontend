import { test as setup, expect } from '@playwright/test';
import { TEST_CREDENTIALS } from './fixtures/auth.fixture';

const authFile = 'tests/.auth/user.json';

/**
 * Authentication setup - runs before all tests that require authentication
 * This logs in once and saves the authentication state for reuse
 */
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/pages/login.html');

  // Fill in login form
  await page.locator('#email').fill(TEST_CREDENTIALS.email);
  await page.locator('#password').fill(TEST_CREDENTIALS.password);

  // Click login button
  await page.locator('#loginButton').click();

  // Wait for successful login - should redirect to dashboard
  await page.waitForURL('**/index.html', { timeout: 30000 });

  // Verify we're on the dashboard
  await expect(page).toHaveURL(/index\.html/);

  // Save authentication state
  await page.context().storageState({ path: authFile });
});

/**
 * Alternative setup for API-based authentication (faster)
 */
setup.skip('authenticate via API', async ({ request, page }) => {
  // Direct API login
  const response = await request.post('https://muhasebeapi.sigorta.teklifi.al/api/auth/login', {
    data: {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password,
    },
  });

  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.success).toBeTruthy();
  expect(body.token).toBeTruthy();

  // Navigate to app and set tokens
  await page.goto('/');
  await page.evaluate(({ token, refreshToken, user }) => {
    // Set tokens in the app's auth system
    sessionStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refreshToken);
    sessionStorage.setItem('user', JSON.stringify(user));
  }, {
    token: body.token,
    refreshToken: body.refreshToken,
    user: body.user,
  });

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
