import { expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';

/** A building (or one instance) on the map, by the name shown under it: "app-1", "Database", "Load balancer"… */
export const unit = (page: Page, name: string) => page.locator('.play-unit').filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
export const internet = (page: Page) => page.locator('[data-node-id="client"]');
export const buildCard = (page: Page, name: RegExp) => page.getByRole('toolbar', { name: 'Components' }).getByRole('button', { name });

/** Builds with the number keys, in the level's card order (1 = first card). */
export async function buildKeys(page: Page, keys: string) {
  for (const key of keys) await page.keyboard.press(key);
}

/** Drags from one building to another to connect them, the way a player does. */
export async function dragConnect(page: Page, from: string, to: string) {
  const a = await unit(page, from).first().locator('svg').boundingBox();
  const b = await unit(page, to).first().locator('svg').boundingBox();
  if (!a || !b) throw new Error(`Cannot find ${from} or ${to}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

/** Calls the users now (when still possible) and plays at 4× until the wave ends; returns the end dialog. */
export async function playWave(page: Page) {
  const call = page.getByRole('button', { name: /Bring them now/ });
  if (await call.isVisible()) await call.click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 25_000 });
  return end;
}

const levelIds = readdirSync('src/levels').filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();

/** Opens a level in a mode (God, the empty map, by default) with every level unlocked, for tests not about progress. */
export async function openLevel(page: Page, id: string, mode: 'guided' | 'normal' | 'hard' | 'god' = 'god') {
  await page.addInitScript(ids => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, levelIds);
  await page.goto(`/#${id}/${mode}`);
  await expect(page.locator('.play-screen')).toBeVisible();
  await startMission(page);
}

/** Closes the briefing that opens every mission; the clock starts only then. */
export async function startMission(page: Page) {
  await page.getByRole('button', { name: /Start building/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Marks the tutorial as done for a fresh player, so every mode is available. */
export async function skipTutorial(page: Page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem('design-the-arki:progress')) localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, levels: {} }));
  });
}
