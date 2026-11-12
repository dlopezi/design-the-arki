import { expect, test, type Page } from '@playwright/test';
import { buildKeys, dragConnect, openLevel, playWave, skipTutorial, startMission, unit } from './helpers';

const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

test('the difficulty is asked once, then every mission opens in it', async ({ page }) => {
  await skipTutorial(page);
  await page.goto('/#levels');
  await levelCard(page, 'Hello world').getByRole('button', { name: /Play/ }).click();
  const modes = page.getByRole('list', { name: 'Modes' });
  await expect(modes.getByRole('link')).toHaveText([/Guided/, /Normal/, /Hard/, /God/]);
  await modes.getByRole('link', { name: /Normal/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello world', level: 1 })).toBeVisible();
  await startMission(page);
  await expect(page.getByText('Mode: Normal')).toBeVisible();

  // Next time the map plays straight away, in the same mode.
  await page.goto('/#levels');
  await levelCard(page, 'Hello world').getByRole('button', { name: /Play/ }).click();
  await expect(page).toHaveURL(/#01-hello-world\/normal$/);
});

test('the briefing holds the clock until the player starts building', async ({ page }) => {
  await skipTutorial(page);
  await page.goto('/#01-hello-world/normal');
  const briefing = page.getByRole('dialog', { name: 'Hello world' });
  await expect(briefing).toContainText('The clock waits until you start');
  await page.waitForTimeout(1500);
  await expect(page.locator('.play-phase')).toHaveText('Build 0:30');
  await startMission(page);
  await expect(page.locator('.play-phase')).not.toHaveText('Build 0:30', { timeout: 3000 });

  // The mission can be read again later; the clock stops while it is open.
  await page.getByRole('button', { name: /Mission/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Game paused');
  await page.getByRole('button', { name: /Resume/ }).click();
  await page.getByRole('button', { name: /Manual/ }).click();
  await expect(page.getByRole('dialog', { name: 'Manual' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('guided mode starts almost complete, already built, and shows its hint from the start', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  await expect(unit(page, 'app-1')).toBeVisible();
  await expect(unit(page, 'Database')).toBeVisible();
  await expect(unit(page, 'app-1')).not.toContainText('building');
  await expect(page.getByRole('note')).toContainText('Connect the app server to the database');
});

test('normal mode starts partial without the hint; god mode starts with an empty construction zone', async ({ page }) => {
  await openLevel(page, '02-first-spike', 'normal');
  await expect(unit(page, 'Database')).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);

  await openLevel(page, '02-first-spike', 'god');
  await expect(page.getByText('Construction zone')).toBeVisible();
  await expect(page.locator('.play-unit')).toHaveCount(0);
});

test('hard mode hands over a broken design; fixing it earns the Hard badge', async ({ page }) => {
  await skipTutorial(page);
  await page.goto('/#01-hello-world/hard');
  await startMission(page);
  // Two separate app servers, the second one a dead end.
  await expect(page.locator('.play-unit', { hasText: 'no way out' })).toHaveCount(1);
  await dragConnect(page, 'app-2', 'Database');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');

  await page.goto('/#levels');
  await expect(levelCard(page, 'Hello world').getByLabel('Hardest mode passed: Hard')).toBeVisible();
});

test('the game screen links back to the mode picker and the level map', async ({ page }) => {
  await openLevel(page, '02-first-spike', 'god');
  await buildKeys(page, '1');
  await page.getByRole('link', { name: 'Change mode' }).click();
  await expect(page.getByRole('list', { name: 'Modes' })).toBeVisible();
});
