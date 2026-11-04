import { expect, test, type Page } from '@playwright/test';
import { connect, playAndSkip, select } from './helpers';

const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

/** Builds Clients → Load balancer → App server (3) → Cache → Database. */
async function buildWithCache(page: Page) {
  for (const key of ['1', '2', '3', '4']) await page.keyboard.press(key);
  await connect(page, { label: 'Clients' }, { label: 'Load balancer' });
  await connect(page, { label: 'Load balancer' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Cache' });
  await connect(page, { label: 'Cache' }, { label: 'Database' });
  await select(page, 'App server');
  for (let i = 0; i < 2; i++) await inspector(page).getByRole('button', { name: 'Add instance' }).click();
}

test('level 4: a cache in front of the database earns 3 stars, and its hit rate shows after the run', async ({ page }) => {
  await page.goto('/#04-flash-sale');
  await expect(page.getByRole('heading', { name: 'Flash sale' })).toBeVisible();
  await buildWithCache(page);

  await select(page, 'Cache');
  await expect(inspector(page).getByRole('spinbutton', { name: 'TTL (seconds)' })).toHaveValue('10');
  for (let i = 0; i < 5; i++) await inspector(page).getByRole('button', { name: 'Longer TTL' }).click();
  await expect(inspector(page).getByRole('spinbutton', { name: 'TTL (seconds)' })).toHaveValue('60');
  await expect(inspector(page)).toContainText('Expected hit rate ≈ 67%');
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '220');

  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' }).getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to design' }).click();
  await expect(inspector(page)).toContainText(/Observed hit rate\s*6\d\.\d%/);
});

test('level 4: the database tier can be raised instead, at a higher cost', async ({ page }) => {
  await page.goto('/#04-flash-sale');
  await expect(page.getByRole('heading', { name: 'Flash sale' })).toBeVisible();
  await page.keyboard.press('4');
  await select(page, 'Database');
  const tier = inspector(page).getByRole('group', { name: 'Tier' });
  await expect(tier.getByRole('radio')).toHaveCount(3);
  await tier.getByRole('radio', { name: 'Medium' }).check();
  await expect(inspector(page)).toContainText('16 connections');
  await expect(inspector(page)).toContainText('Capacity ≈ 800 req/s');
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '150');
});

test('level 5: the TTL is capped by the level and the database tier is fixed', async ({ page }) => {
  await page.goto('/#05-popular-content');
  await expect(page.getByRole('heading', { name: 'Popular content' })).toBeVisible();
  await page.keyboard.press('3');
  await select(page, 'Cache');
  for (let i = 0; i < 8; i++) {
    const longer = inspector(page).getByRole('button', { name: 'Longer TTL' });
    if (await longer.isDisabled()) break;
    await longer.click();
  }
  await expect(inspector(page).getByRole('spinbutton', { name: 'TTL (seconds)' })).toHaveValue('60');
  await expect(inspector(page).getByRole('button', { name: 'Longer TTL' })).toBeDisabled();

  await page.keyboard.press('4');
  await select(page, 'Database');
  await expect(inspector(page).getByRole('group', { name: 'Tier' })).toHaveCount(0);
});
