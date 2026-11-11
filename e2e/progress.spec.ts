import { expect, test, type Page } from '@playwright/test';
import { buildKeys, playWave, skipTutorial } from './helpers';

const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

async function play(page: Page, title: string, mode = 'God') {
  await levelCard(page, title).getByRole('button', { name: /Play/ }).click();
  await page.getByRole('list', { name: 'Modes' }).getByRole('link', { name: new RegExp(mode) }).click();
}

async function passLevel1(page: Page) {
  await play(page, 'Hello world');
  await expect(page.getByRole('region', { name: 'Mission' })).toBeVisible();
  await buildKeys(page, '12');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
}

test.beforeEach(async ({ page }) => { await skipTutorial(page); });

test('a new player starts at the level select with only level 1 open', async ({ page }) => {
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await expect(levelCard(page, 'Hello world').getByRole('button', { name: /Play/ })).toBeVisible();
  await expect(levelCard(page, 'First spike')).toContainText('Locked');
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toHaveCount(0);
});

test('passing a level saves its stars and unlocks the next one, across reloads', async ({ page }) => {
  await page.goto('/#levels');
  await passLevel1(page);
  await page.getByRole('dialog').getByRole('link', { name: 'Next level' }).click();
  await expect(page.getByRole('heading', { name: 'First spike', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: /[123] of 3 stars/ })).toBeVisible();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();

  await page.reload();
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: /[123] of 3 stars/ })).toBeVisible();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();
});

test('the level map has its own address, and the mode picker links back to it', async ({ page }) => {
  await page.goto('/#01-hello-world');
  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
});

test('a locked level opened by its link sends the player back to the level select', async ({ page }) => {
  await page.goto('/#02-first-spike');
  await expect(page).toHaveURL(/#levels$/);
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('First spike is locked');
});

test('progress can be reset after confirming in the page', async ({ page }) => {
  await page.goto('/#levels');
  await passLevel1(page);
  await page.getByRole('dialog').getByRole('link', { name: 'Level map' }).click();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset all progress?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await confirm.getByRole('button', { name: 'Reset' }).click();
  await expect(levelCard(page, 'First spike')).toContainText('Locked');
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: '0 of 3 stars' })).toBeVisible();
});
