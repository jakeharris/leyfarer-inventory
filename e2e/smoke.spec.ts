import { expect, test } from '@playwright/test';

test('app shell loads and survives reload', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Leyfarer Inventory' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('textbox', { name: /^Name$/ }).fill('Rations');
  await page.getByRole('button', { name: 'Save Item' }).click();
  await expect(page.getByText('Rations')).toBeVisible();

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('textbox', { name: /^Name$/ }).fill('Unidentified Wand');
  await page.getByRole('checkbox', { name: 'Magic Item' }).check();
  await page.getByRole('button', { name: 'Save Item' }).click();
  await expect(page.getByText('Unidentified Wand')).toBeVisible();
  await expect(page.getByText('Needs Details', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Rations')).toBeVisible();
  await expect(page.getByText('Unidentified Wand')).toBeVisible();
  await expect(page.getByText('Needs Details', { exact: true })).toBeVisible();
});
