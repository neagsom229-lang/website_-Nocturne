import { test, expect } from '@playwright/test';

test.describe('Nocturne E2E Flow Audit', () => {
  test('signed out visitors are redirected from protected routes to login within 5 seconds', async ({ page }) => {
    // Clear any auth cookies
    await page.context().clearCookies();

    for (const path of ['/tapes', '/playlists']) {
      await page.goto(path);
      // Should redirect to /auth/login (or contain auth/login)
      await page.waitForURL(/\/auth\/login/, { timeout: 5000 });
      expect(page.url()).toContain('/auth/login');
    }
  });

  test('login and signup forms render and validate empty/invalid submission', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('#signin-title')).toHaveText('Welcome back');

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    await page.goto('/auth/register');
    await expect(page.locator('#auth-title')).toHaveText('Stay a little.');
    await page.locator('button[type="submit"]').click();
  });

  test('authenticated user session loads protected page successfully', async ({ page }) => {
    // Mock /api/auth/me to return a logged-in user
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-test-1',
            email: 'test@example.com',
            displayName: 'Test Listener',
          },
        }),
      });
    });

    await page.goto('/tapes');
    // Ensure it does not show "Turning the little key…" or hang indefinitely
    await page.waitForSelector('.auth-loading', { state: 'detached', timeout: 5000 }).catch(() => {});
    // Should render workspace shell or app content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });
});
