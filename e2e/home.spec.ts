import { expect, test, type Page } from '@playwright/test';

const levelNode = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

test('the home map shows the mode each level was passed in, a legend, the next level and the star total', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('design-the-arki:progress', JSON.stringify({
    version: 1, tutorialDone: true,
    levels: { '01-hello-world': { bestStars: 3, bestMode: 'god' }, '02-first-spike': { bestStars: 2, bestMode: 'hard' }, '03-bigger-or-more': { bestStars: 1, bestMode: 'normal' } },
  })));
  await page.goto('/#levels');

  await expect(page.getByRole('img', { name: '6 of 24 stars collected' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Coin colour: hardest mode passed' })).toContainText('Guided');
  await expect(levelNode(page, 'Hello world').getByLabel('Hardest mode passed: God')).toBeVisible();
  await expect(levelNode(page, 'First spike').getByLabel('Hardest mode passed: Hard')).toBeVisible();
  await expect(levelNode(page, 'Bigger or more?').getByLabel('Hardest mode passed: Normal')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await expect(page.getByText('Level 4: Flash sale')).toBeVisible();
  await expect(levelNode(page, 'Popular content')).toContainText('Locked');

  await levelNode(page, 'Flash sale').getByRole('link', { name: /Play/ }).click();
  await expect(page.getByRole('list', { name: 'Modes' })).toBeVisible();
});
