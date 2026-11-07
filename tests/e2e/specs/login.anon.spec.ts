import { expect, test } from '@playwright/test';

import { USER_EMAIL, USER_PASSWORD } from './constants';
import { agreeToTermsOfService, submitLogin } from './helpers';

test.describe('Login', () => {
  test('redirects an anonymous visitor to the login form', async ({ page }) => {
    await page.goto('/projects');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Login to Mycelium')).toBeVisible();
  });

  test('rejects unknown credentials', async ({ page }) => {
    await page.goto('/login');
    // An address with no account, so the run never counts towards locking
    // out the real user after repeated failures.
    await submitLogin(page, 'nobody@example.com', 'not-the-password');
    // The Terms of Service are agreed to before the credentials are checked.
    await agreeToTermsOfService(page);

    // The form is reset and no session is created.
    await expect(page.locator('#password')).toHaveValue('');
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('keeps the user out until the Terms of Service are accepted', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, USER_EMAIL, USER_PASSWORD);

    const terms = page.getByRole('dialog').filter({ hasText: 'Terms of Service' });
    await terms.getByRole('button', { name: 'Disagree' }).click();

    await expect(page.getByText('Access can not be granted until Terms of Service are accepted')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in and returns to the requested page', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);

    await submitLogin(page, USER_EMAIL, USER_PASSWORD);
    await agreeToTermsOfService(page);

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('heading', { name: 'Your Projects' })).toBeVisible();
  });
});
