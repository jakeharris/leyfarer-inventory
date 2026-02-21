import { expect, test } from '@playwright/test';

test('app shell loads and survives reload', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Leyfarer Inventory' })).toBeVisible();
  await expect(page.getByTestId('shell-status')).toHaveText('Shell healthy');

  await page.reload();
  await expect(page.getByTestId('shell-status')).toHaveText('Shell healthy');
});
