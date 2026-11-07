import { expect, Page } from '@playwright/test';

/** Fills in and submits the login form; the page must be on /login. */
export async function submitLogin(page: Page, email: string, password: string) {
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/**
 * The Terms of Service dialog opens after every login without a current
 * `terms_of_service` cookie.
 */
export async function agreeToTermsOfService(page: Page) {
  const dialog = page.getByRole('dialog').filter({ hasText: 'Terms of Service' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Agree', exact: true }).click();
  await expect(dialog).toBeHidden();
}
