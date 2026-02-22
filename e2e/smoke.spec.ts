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
  await expect(page.locator('.badge-warning', { hasText: 'Needs Details' })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Rations')).toBeVisible();
  await expect(page.getByText('Unidentified Wand')).toBeVisible();
  await expect(page.locator('.badge-warning', { hasText: 'Needs Details' })).toBeVisible();
});

test('supports search filters and attunement replacement flow', async ({ page }) => {
  await page.goto('/');

  const addAttunable = async (name: string, isAttuned: boolean) => {
    await page.getByRole('button', { name: 'Add Item' }).click();
    await page.getByRole('textbox', { name: /^Name$/ }).fill(name);
    await page.getByRole('checkbox', { name: 'Magic Item' }).check();
    await page.getByRole('checkbox', { name: 'Requires Attunement' }).check();
    if (isAttuned) {
      await page.getByRole('checkbox', { name: 'Currently Attuned' }).check();
    }
    await page.getByRole('button', { name: 'Save Item' }).click();
    await expect(page.getByText(name)).toBeVisible();
  };

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('textbox', { name: /^Name$/ }).fill('Healing Potion');
  await page.getByRole('checkbox', { name: 'Consumable', exact: true }).check();
  await page.getByRole('button', { name: 'Save Item' }).click();
  await expect(page.getByText('Healing Potion')).toBeVisible();

  await addAttunable('Attuned One', true);
  await addAttunable('Attuned Two', true);
  await addAttunable('Attuned Three', true);
  await addAttunable('Attuned Four', false);

  await expect(page.getByRole('heading', { name: 'Attuned Items' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consumables' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Search' }).fill('potion');
  await expect(page.getByText('Healing Potion')).toBeVisible();
  await expect(page.getByText('Attuned One')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Consumables' })).toBeHidden();

  await page.getByRole('searchbox', { name: 'Search' }).fill('');

  const fourthCard = page.locator('li.item-card').filter({ hasText: 'Attuned Four' });
  await fourthCard.getByRole('button', { name: 'Attune' }).click();

  await expect(page.getByRole('dialog', { name: 'Attunement full' })).toBeVisible();
  await page.getByRole('radio', { name: 'Attuned Two' }).check();
  await page.getByRole('button', { name: 'Replace Selected' }).click();

  await expect(page.getByRole('dialog', { name: 'Attunement full' })).toBeHidden();

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('checkbox', { name: /^Attuned Only$/ }).check();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('Attuned Four')).toBeVisible();
  await expect(page.getByText('Attuned Two')).toBeHidden();
});

test('snapshot catalog refresh supports manual catalog and reward entry', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByRole('button', { name: 'Catalog' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Refresh Catalog' }).click();
  await expect(page.getByText(/Catalog loaded from local snapshot/)).toBeVisible();

  await page.getByRole('button', { name: 'Manual Entry' }).click();
  await page.getByRole('textbox', { name: /^Name$/ }).fill('Beneath the Brewery');
  await page.getByRole('button', { name: 'Save Manual Entry' }).click();
  await page.getByRole('searchbox', { name: 'Search Catalog' }).fill('beneath');
  await expect(page.getByText('Beneath the Brewery')).toBeVisible();

  await page.getByRole('button', { name: 'Add Rewards' }).click();
  await page.getByRole('combobox', { name: 'Side Quest' }).selectOption({ label: 'Beneath the Brewery' });
  await page.getByRole('textbox', { name: /Reward Item Names/ }).fill('Clockwork Token');
  await page.getByRole('button', { name: 'Save Rewards' }).click();

  await expect(page.getByText('Clockwork Token')).toBeVisible();
});
