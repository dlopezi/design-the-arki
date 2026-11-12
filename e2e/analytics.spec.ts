import { expect, test, type Page } from '@playwright/test';
import { buildKeys, openLevel, playWave } from './helpers';

type Recorded = [string, Record<string, unknown> | undefined];

/** Stands in for a cookieless analytics script (Plausible's `plausible(event, { props })`). */
async function recordAnalytics(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __events: unknown[]; plausible: (e: string, o?: { props?: unknown }) => void };
    w.__events = [];
    w.plausible = (event, options) => { w.__events.push([event, options?.props]); };
  });
}
const events = (page: Page) => page.evaluate(() => (window as unknown as { __events: Recorded[] }).__events);

test('playing a level reports started, run and passed, with level, mode and stars only', async ({ page }) => {
  await recordAnalytics(page);
  await openLevel(page, '01-hello-world');
  await expect(page.getByRole('heading', { name: 'Hello world', level: 1 })).toBeVisible();
  await buildKeys(page, '12');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');

  await expect.poll(() => events(page)).toEqual([
    ['Level started', { level: '01-hello-world', mode: 'god' }],
    ['Run', { level: '01-hello-world', mode: 'god', passed: 'yes' }],
    ['Level passed', { level: '01-hello-world', mode: 'god', stars: expect.any(Number) }],
  ]);
});

test('leaving a level without passing it reports it as abandoned', async ({ page }) => {
  await recordAnalytics(page);
  await openLevel(page, '02-first-spike');
  await expect(page.getByRole('heading', { name: 'First spike', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Levels' }).click();
  await expect.poll(() => events(page)).toContainEqual(['Level abandoned', { level: '02-first-spike', mode: 'god' }]);
});

test('without an analytics script the game still works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await openLevel(page, '02-first-spike');
  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Feedback opens from the level select and the game', async ({ page }) => {
  await openLevel(page, '01-hello-world');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('dialog', { name: 'Feedback' })).toBeVisible();
  // Keys typed in the message never reach the game's shortcuts (Delete removes the selection).
  await page.getByRole('textbox', { name: 'Your message' }).fill('Delete');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('link', { name: 'Levels' }).click();
  await expect(page.getByRole('heading', { name: 'Chapter 1 · Core' })).toBeVisible();
  await page.getByRole('button', { name: 'Send feedback' }).click();
  // The draft survives closing the dialog.
  await expect(page.getByRole('textbox', { name: 'Your message' })).toHaveValue('Delete');
});
