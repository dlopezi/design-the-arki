import { expect, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';

export const node = (page: Page, label: string, nth = 0) => page.locator('.react-flow__node', { hasText: label }).nth(nth);

/** Waits until the canvas stops reframing (it refits after components are added). */
export async function canvasSettled(page: Page) {
  const transform = () => page.locator('.react-flow__viewport').evaluate(el => (el as HTMLElement).style.transform);
  await expect.poll(async () => {
    const before = await transform();
    await page.waitForTimeout(100);
    return before === (await transform());
  }).toBe(true);
}

export async function connect(page: Page, from: { label: string; nth?: number }, to: { label: string; nth?: number }) {
  const edges = page.locator('.react-flow__edge');
  const before = await edges.count();
  await canvasSettled(page);
  await node(page, from.label, from.nth).locator('.react-flow__handle.source')
    .dragTo(node(page, to.label, to.nth).locator('.react-flow__handle.target'));
  await expect(edges).toHaveCount(before + 1);
}

export const hotbarButton = (page: Page, name: RegExp) => page.getByRole('toolbar', { name: 'Components' }).getByRole('button', { name });

/** Selects a component by clicking its title (a container's body is covered by its instances). */
export async function select(page: Page, label: string, nth = 0) {
  await node(page, label, nth).getByText(label, { exact: true }).click();
}

/** Presses Play and skips the playback straight to the report. */
export async function playAndSkip(page: Page, how: 'button' | 'space' = 'button') {
  if (how === 'space') await page.keyboard.press('Space');
  else await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Skip to results' }).click();
}

/** Builds Clients → Load balancer → App server (n instances) → Database on level 2. */
export async function buildScaledOut(page: Page, instances = 2) {
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await page.keyboard.press('3');
  await connect(page, { label: 'Clients' }, { label: 'Load balancer' });
  await connect(page, { label: 'Load balancer' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Database' });
  await select(page, 'App server');
  for (let i = 1; i < instances; i++) await page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Add instance' }).click();
}

const levelIds = readdirSync('src/levels').filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();

/** Opens a level directly, with every level unlocked (for tests that are not about progress). */
export async function openLevel(page: Page, id: string) {
  await page.addInitScript(ids => {
    localStorage.setItem('archi-game:progress', JSON.stringify({ version: 1, levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, levelIds);
  await page.goto(`/#${id}`);
}
