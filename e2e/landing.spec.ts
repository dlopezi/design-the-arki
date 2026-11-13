import { expect, test } from '@playwright/test';

test('a new visitor learns what the game is and starts the tutorial', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Watch your system break.');

  // A new player first reads the briefing: what each building is for.
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name: 'Play level 1' }).click();
  await expect(page).toHaveURL(/#briefing$/);
  await expect(page.getByRole('heading', { name: 'Before your first mission' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'App server' })).toBeVisible();
  await expect(page.getByText('Runs your application code')).toBeVisible();
  await page.getByRole('button', { name: /Load balancer/ }).click();
  await expect(page.getByRole('heading', { name: 'Load balancer' })).toBeVisible();
  await page.getByRole('link', { name: 'Start level 1' }).click();
  await expect(page).toHaveURL(/#01-hello-world\/guided$/);
  await expect(page.getByRole('region', { name: 'Tutorial' })).toContainText('Step 1 of 4');
});

test('a returning player continues at the next open level', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: { '01-hello-world': { bestStars: 3 }, '02-first-spike': { bestStars: 2 } } }));
  });
  await page.goto('/');
  await expect(page.getByRole('img', { name: '5 of 42 stars collected' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Chapter 1 · Core: 2 of 8 levels passed' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue: level 3' }).click();
  await expect(page).toHaveURL(/#03-bigger-or-more$/);
  // No difficulty chosen yet: the game asks for it before the mission.
  await expect(page.getByText('Next mission: Bigger or more?')).toBeVisible();
});

test('the title screen menu links to the level map', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Level map' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  // …and the level map leads back to the title screen.
  await page.getByRole('link', { name: '← Home' }).click();
  await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeVisible();
});

test('the menu works from the keyboard like a game menu', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  await expect(menu.getByRole('link', { name: 'Play level 1' })).toHaveAttribute('data-selected', 'true');

  // ↓ ↓ selects the Manual; ↑ goes back to "Level map"; Enter opens it.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('link', { name: /^Manual/ })).toBeFocused();
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

test('the title screen menu opens the field manual, with how to play, the buildings and the concepts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: { '01-hello-world': { bestStars: 1 } } }));
  });
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Main menu' });
  await expect(menu.getByRole('link', { name: /Your base/ })).toHaveCount(0);
  await menu.getByRole('link', { name: /^Manual/ }).click();
  await expect(page.getByRole('heading', { name: 'Manual', level: 1 })).toBeVisible();
  await expect(page.getByRole('tabpanel')).toContainText('Bring the users');

  await page.getByRole('tab', { name: 'Buildings' }).click();
  await expect(page).toHaveURL(/#manual\/buildings$/);
  // The load balancer arrives in level 2, which is open; the cache, in a later level, is still locked.
  await expect(page.getByRole('button', { name: /Load balancer/ })).not.toContainText('Locked');
  await expect(page.getByRole('button', { name: /Cache/ })).toContainText('Locked');
  await expect(page.getByText('In real life')).toBeVisible();

  await page.getByRole('tab', { name: 'Concepts' }).click();
  await expect(page.getByRole('heading', { name: 'p95 latency' })).toBeVisible();

  // The old archive address opens the Buildings tab.
  await page.goto('/#archive');
  await expect(page.getByRole('tab', { name: 'Buildings' })).toHaveAttribute('aria-selected', 'true');
});
