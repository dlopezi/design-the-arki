import { expect, test } from '@playwright/test';

const demo = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Training: a tiny simulation' });

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

  // A new player first reads the briefing: what each building is for.
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Play level 1' }).click();
  await expect(page).toHaveURL(/#briefing$/);
  await expect(page.getByRole('heading', { name: 'Before your first mission' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Factory' })).toBeVisible();
  await expect(page.getByText('Runs your application code')).toBeVisible();
  await page.getByRole('button', { name: /Relay tower/ }).click();
  await expect(page.getByRole('heading', { name: 'Relay tower' })).toBeVisible();
  await page.getByRole('link', { name: 'Start level 1' }).click();
  await expect(page).toHaveURL(/#01-hello-world\/guided$/);
  await expect(page.getByRole('region', { name: 'Tutorial' })).toContainText('Step 1 of 4');
});

test('a returning player continues at the next open level', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: { '01-hello-world': { bestStars: 3 }, '02-first-spike': { bestStars: 2 } } }));
  });
  await page.goto('/');
  await expect(page.getByRole('img', { name: '5 of 24 stars collected' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Chapter 1 · Core: 2 of 8 levels passed' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue: level 3' }).click();
  await expect(page).toHaveURL(/#03-bigger-or-more$/);
  await expect(page.getByRole('heading', { name: 'Bigger or more?' })).toBeVisible();
});

test('the title screen menu links to the level map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Level map' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
});

test('the menu works from the keyboard like a game menu', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  await expect(menu.getByRole('link', { name: 'Play level 1' })).toHaveAttribute('data-selected', 'true');

  // ↓ ↓ selects "How to play"; Enter opens the steps, Escape closes them and keeps the selection.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('button', { name: 'How to play' })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await expect(dialog).toContainText('1 · Build');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(menu.getByRole('button', { name: 'How to play' })).toBeFocused();

  // ↑ goes back to "Level map"; Enter opens it.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#levels$/);
});

test('Enter on a fresh title screen starts the selected first item', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Play level 1' })).toHaveAttribute('data-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#briefing$/);
});

test('the title screen menu opens the building archive and the player\'s base', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: { '01-hello-world': { bestStars: 1 } } }));
  });
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  await menu.getByRole('link', { name: /Building archive/ }).click();
  await expect(page.getByRole('heading', { name: 'Building archive' })).toBeVisible();
  // The load balancer arrives in level 2, which is open; the cache, in a later level, is still locked.
  await expect(page.getByRole('button', { name: /Relay tower/ })).not.toContainText('Locked');
  await expect(page.getByRole('button', { name: /Generator/ })).toContainText('Locked');

  await page.goto('/');
  await menu.getByRole('link', { name: /Your base/ }).click();
  await expect(page.getByRole('heading', { name: 'Your base' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('1 district');
  await expect(page.getByRole('heading', { name: 'Level 1 · Hello world' })).toBeVisible();
});
