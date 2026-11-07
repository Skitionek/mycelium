import { expect, test as setup } from '@playwright/test';

import { STORAGE_STATE, USER_EMAIL, USER_PASSWORD } from './constants';
import { agreeToTermsOfService, submitLogin } from './helpers';

// Logs in once through the UI and saves the session (JWTs in localStorage,
// the ToS cookie) for the specs in the `chromium` project.
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await submitLogin(page, USER_EMAIL, USER_PASSWORD);
  await agreeToTermsOfService(page);
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: STORAGE_STATE });
});
