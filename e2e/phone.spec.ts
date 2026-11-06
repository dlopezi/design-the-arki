import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasSettled, node, openLevel } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error('element is not visible');
  return b;
};
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.width <= outer.x + outer.width + 1 && inner.y + inner.height <= outer.y + outer.height + 1;

const parts = (page: Page) => ({
  topBar: page.getByRole('banner'),
  diagram: page.locator('.react-flow'),
  sheet: page.getByRole('region', { name: 'Panels' }),
  bottomBar: page.locator('.bottom-bar'),
});

test('on a phone the diagram sits between the top bar, the tabbed sheet and the component bar', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  const { topBar, diagram, sheet, bottomBar } = parts(page);

  await expect(topBar.getByRole('link', { name: '← Levels' })).toBeVisible();
  await expect(topBar.getByRole('heading', { level: 1 })).toHaveText('Hello world');
  await expect(topBar.getByRole('meter', { name: 'Monthly cost' })).toBeVisible();
  await expect(bottomBar.getByRole('toolbar', { name: 'Components' })).toBeVisible();
  await expect(bottomBar.getByRole('button', { name: 'Play' })).toBeVisible();

  // The sheet opens on the mission.
  await expect(sheet.getByRole('tab', { name: 'Mission' })).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByRole('tabpanel')).toContainText('A small online shop');
  await expect(sheet.getByRole('list', { name: 'Objectives' })).toBeVisible();

  // Nothing covers anything else, nothing leaves the screen, and the diagram fits its area.
  const boxes = { topBar: await boxOf(topBar), diagram: await boxOf(diagram), sheet: await boxOf(sheet), bottomBar: await boxOf(bottomBar) };
  const names = Object.keys(boxes) as (keyof typeof boxes)[];
  for (const a of names) for (const b of names) if (a < b) expect(overlap(boxes[a], boxes[b]), `${a} overlaps ${b}`).toBe(false);
  for (const name of names) expect(inside(boxes[name], { x: 0, y: 0, width: 390, height: 844 }), `${name} leaves the screen`).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await canvasSettled(page);
  for (const label of ['Clients', 'App server', 'Database']) {
    expect(inside(await boxOf(node(page, label)), boxes.diagram), `${label} is outside the diagram`).toBe(true);
  }
});

test('on a phone tapping a component opens the inspector tab, and the sheet can be hidden', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  const { diagram, sheet } = parts(page);
  await canvasSettled(page);

  await node(page, 'App server').getByText('App server', { exact: true }).tap();
  await expect(sheet.getByRole('tab', { name: 'Inspector' })).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Add instance' })).toBeVisible();

  await sheet.getByRole('tab', { name: 'Results' }).tap();
  await expect(sheet.getByRole('tabpanel')).toContainText('Press Play to send traffic through your design.');

  const diagramHeight = (await boxOf(diagram)).height;
  await sheet.getByRole('button', { name: 'Hide panel' }).tap();
  await expect(sheet.getByRole('tabpanel')).toBeHidden();
  await expect.poll(async () => (await boxOf(diagram)).height).toBeGreaterThan(diagramHeight + 100);

  await sheet.getByRole('tab', { name: 'Mission' }).tap();
  await expect(sheet.getByRole('tabpanel')).toContainText('A small online shop');
});

test('on a phone a component is connected from the inspector tab and the level passes', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  const { sheet, bottomBar } = parts(page);
  await canvasSettled(page);

  await node(page, 'App server').getByText('App server', { exact: true }).tap();
  await sheet.getByRole('group', { name: 'Sends requests to' }).getByRole('radio', { name: 'Database' }).check();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await bottomBar.getByRole('button', { name: 'Play' }).tap();
  await bottomBar.getByRole('button', { name: 'Skip to results' }).tap();
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
});
