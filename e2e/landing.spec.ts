import { expect, test } from '@playwright/test';

const demo = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Try it: a tiny simulation' });

test('a new visitor learns what the game is, tries the demo and starts the tutorial', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Watch your system break.');
  await expect(page.getByText('A puzzle game for system-design interviews')).toBeVisible();

  // 300 req/s is too much for one app server; a second one behind a load balancer holds.
  await expect(demo(page).getByRole('status')).toHaveText('✗ The app server is overloaded');
  await demo(page).getByRole('button', { name: 'Add an app server' }).click();
  await expect(demo(page).getByRole('status')).toHaveText('✓ Your system holds');
  await expect(demo(page).getByRole('img')).toHaveAttribute('aria-label', /a load balancer, 2 app servers/);

  // More traffic breaks it again.
  await demo(page).getByRole('slider').fill('700');
  await expect(demo(page).getByText('700 req/s')).toBeVisible();
  await expect(demo(page).getByRole('status')).toHaveText('✗ The app server is overloaded');

  await page.getByRole('link', { name: 'Play level 1' }).first().click();
  await expect(page).toHaveURL(/#01-hello-world\/guided$/);
  await expect(page.getByRole('region', { name: 'Tutorial' })).toContainText('Step 1 of 4');
});

test('a returning player continues at the next open level', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('archi-game:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: { '01-hello-world': { bestStars: 3 }, '02-first-spike': { bestStars: 2 } } }));
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Continue: level 3' }).first().click();
  await expect(page).toHaveURL(/#03-bigger-or-more$/);
  await expect(page.getByRole('heading', { name: 'Bigger or more?' })).toBeVisible();
});

test('the landing links to the level map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'All levels' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
});
