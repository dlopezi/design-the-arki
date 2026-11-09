import { expect, test, type Page } from '@playwright/test';
import { connect, node, playAndSkip, skipTutorial } from './helpers';

const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

async function play(page: Page, title: string, mode = 'God') {
  await levelCard(page, title).getByRole('button', { name: /Play/ }).click();
  await page.getByRole('list', { name: 'Modes' }).getByRole('link', { name: new RegExp(mode) }).click();
}

async function passLevel1(page: Page) {
  await play(page, 'Hello world');
  await expect(page.getByText('Mode: God')).toBeVisible();
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await connect(page, { label: 'Clients' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Database' });
  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await skipTutorial(page); });

test('a new player starts at the level select with only level 1 open', async ({ page }) => {
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await expect(levelCard(page, 'Hello world').getByRole('button', { name: /Play/ })).toBeVisible();
  await expect(levelCard(page, 'First spike')).toContainText('Locked');
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toHaveCount(0);
});

test('passing a level saves its stars, unlocks the next one and keeps the design, across reloads', async ({ page }) => {
  await page.goto('/#levels');
  await passLevel1(page);
  await page.getByRole('dialog').getByRole('link', { name: 'Next level' }).click();
  await expect(page.getByRole('heading', { name: 'First spike', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page).toHaveURL(/#levels$/);
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();

  await page.reload();
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();

  await play(page, 'Hello world');
  await expect(node(page, 'App server')).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
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
  await page.getByRole('dialog').getByRole('button', { name: 'Back to design' }).click();
  await page.getByRole('link', { name: 'Levels' }).click();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  const confirm = page.getByRole('dialog', { name: 'Reset all progress?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await expect(levelCard(page, 'First spike').getByRole('button', { name: /Play/ })).toBeVisible();

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await confirm.getByRole('button', { name: 'Reset' }).click();
  await expect(levelCard(page, 'First spike')).toContainText('Locked');
  await expect(levelCard(page, 'Hello world').getByRole('img', { name: '0 of 3 stars' })).toBeVisible();
});
