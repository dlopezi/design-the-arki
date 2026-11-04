import { expect, test } from '@playwright/test';
import { openLevel } from './helpers';

test('a component type is introduced with one line the first time a level offers it', async ({ page }) => {
  await openLevel(page, '02-first-spike');
  await expect(page.getByRole('list', { name: 'New components' })).toContainText('Load balancer');
  await openLevel(page, '04-flash-sale');
  await expect(page.getByRole('list', { name: 'New components' })).toContainText('Cache');
  await openLevel(page, '06-server-goes-down');
  await expect(page.getByRole('list', { name: 'New components' })).toHaveCount(0);
});

test('levels 7 and 8 are playable', async ({ page }) => {
  await openLevel(page, '07-tight-budget');
  await expect(page.getByRole('heading', { name: 'Tight budget', level: 1 })).toBeVisible();
  await openLevel(page, '08-black-friday');
  await expect(page.getByRole('heading', { name: 'Black Friday', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Incidents' })).toContainText('goes down at 35 s');
});
