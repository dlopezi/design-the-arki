import { expect, test, type Page } from '@playwright/test';

const levelNode = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

test('the campaign map shows the mode each level was passed in, the star total, and no Base', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('design-the-arki:progress', JSON.stringify({
    version: 1, tutorialDone: true,
    levels: { '01-hello-world': { bestStars: 3, bestMode: 'god' }, '02-first-spike': { bestStars: 2, bestMode: 'hard' }, '03-bigger-or-more': { bestStars: 1, bestMode: 'normal' } },
  })));
  await page.goto('/#levels');

  await expect(page.getByRole('img', { name: '6 of 45 stars collected' })).toBeVisible();
  await expect(levelNode(page, 'Hello world').getByLabel('Hardest mode passed: God')).toBeVisible();
  await expect(levelNode(page, 'First spike').getByLabel('Hardest mode passed: Hard')).toBeVisible();
  await expect(levelNode(page, 'Bigger or more?').getByLabel('Hardest mode passed: Normal')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await expect(levelNode(page, 'Popular content')).toContainText('Locked');
  await expect(page.getByRole('link', { name: /Your base/ })).toHaveCount(0);

  // The next mission is selected: a second click on it plays it. No mode is chosen yet, so the difficulty comes first.
  await levelNode(page, 'Flash sale').getByRole('button', { name: 'Play Flash sale' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your difficulty' })).toBeVisible();
  await expect(page.getByText('Next mission: Flash sale')).toBeVisible();
});

test('the campaign briefing shows the objectives, the star rule and one Play button', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('design-the-arki:progress', JSON.stringify({
    version: 1, tutorialDone: true, mode: 'normal', levels: { '01-hello-world': { bestStars: 1, bestMode: 'guided' } },
  })));
  await page.goto('/#levels');
  const briefing = page.getByRole('complementary', { name: 'Mission briefing' });
  // The next mission is selected first; level 2 brings the load balancer.
  await expect(briefing.getByRole('heading', { name: 'First spike' })).toBeVisible();
  await expect(briefing).toContainText('New component: Load balancer');
  await expect(briefing.getByRole('list', { name: 'How to earn stars' })).toContainText('Survive the wave');
  await expect(briefing).toContainText('Mode: Normal');
  await expect(briefing.getByRole('link', { name: /Play mission/ })).toHaveAttribute('href', '#02-first-spike/normal');

  // One click on another mission only shows its briefing.
  await levelNode(page, 'Flash sale').getByRole('button').click();
  await expect(briefing.getByRole('heading', { name: 'Flash sale' })).toBeVisible();
  await expect(briefing).toContainText('Pass the mission before it');
  await expect(briefing.getByRole('link', { name: /Play mission/ })).toHaveCount(0);

  // Arrow keys move between missions; Enter plays the selected open one.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(briefing.getByRole('heading', { name: 'First spike' })).toBeVisible();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#02-first-spike\/normal$/);
  await expect(page.getByRole('dialog', { name: 'First spike' })).toBeVisible();
});

test('the campaign top bar opens the difficulty, the field manual and the options', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'hard', levels: {} })));
  await page.goto('/#levels');
  await page.getByRole('link', { name: /Mode: Hard/ }).click();
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link', { name: /God/ })).toBeVisible();
  await page.getByRole('list', { name: 'Modes' }).getByRole('link', { name: /God/ }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('link', { name: /Mode: God/ })).toBeVisible();

  await page.getByRole('link', { name: 'Manual' }).click();
  await expect(page.getByRole('heading', { name: 'Manual', level: 1 })).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Options' }).click();
  await expect(page.getByRole('heading', { name: 'Options' })).toBeVisible();
});
