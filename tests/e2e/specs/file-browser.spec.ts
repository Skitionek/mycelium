import { expect, Page, test } from '@playwright/test';

import { EXAMPLE_PROJECT_FILES, SEEDED_PROJECTS, uniqueName } from './constants';

test.describe('File browser', () => {
  test('lists the seeded projects', async ({ page }) => {
    await page.goto('/projects');

    for (const project of SEEDED_PROJECTS) {
      await expect(page.getByRole('link', { name: project, exact: true })).toBeVisible();
    }
  });

  test('opens a project and lists its files', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('link', { name: 'Example', exact: true }).click();

    // A project link opens the project's root folder.
    await expect(page).toHaveURL(/\/folders\//);
    await expect(page.getByRole('heading', { name: 'Example' })).toBeVisible();
    for (const file of EXAMPLE_PROJECT_FILES) {
      await expect(page.getByRole('link', { name: file, exact: true })).toBeVisible();
    }
  });

  test('creates a project, then a folder inside it', async ({ page }) => {
    const projectName = uniqueName('e2e');
    const folderName = uniqueName('folder');

    await createProject(page, projectName);

    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByRole('button', { name: 'New Folder...' }).click();

    const folderDialog = page.getByRole('dialog');
    await folderDialog.getByLabel('Filename').fill(folderName);
    await folderDialog.getByRole('button', { name: 'Save' }).click();
    await expect(folderDialog).toBeHidden();

    await expect(page.getByRole('link', { name: folderName, exact: true })).toBeVisible();

    // The new project is listed alongside the seeded ones.
    await page.goto('/projects');
    await expect(page.getByRole('link', { name: projectName, exact: true })).toBeVisible();
  });

  test('uploads a text file and opens it', async ({ page }) => {
    const projectName = uniqueName('e2e');
    const filename = `${uniqueName('notes')}.txt`;
    const content = 'Mycelium end-to-end upload check.';

    await createProject(page, projectName);

    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    const uploadDialog = page.getByRole('dialog');
    await uploadDialog.locator('input[type=file]').setInputFiles({
      name: filename,
      mimeType: 'text/plain',
      buffer: Buffer.from(content),
    });
    await expect(uploadDialog.getByLabel('Filename')).toHaveValue(filename);
    await uploadDialog.getByRole('button', { name: 'Save' }).click();
    await expect(uploadDialog).toBeHidden();

    await page.getByRole('link', { name: filename, exact: true }).click();
    await expect(page.getByText(content)).toBeVisible();
  });
});

async function createProject(page: Page, name: string) {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New Project' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Description').fill('Created by the e2e suite.');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  await expect(page).toHaveURL(new RegExp(`/projects/${name}`));
}
