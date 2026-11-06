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

test('on a phone the controls are made for touch: big targets, no key numbers, no drag or Delete in the hint', async ({ page }) => {
  await openLevel(page, '03-bigger-or-more', 'god');
  const { sheet, bottomBar } = parts(page);
  const minSize = async (l: Locator, name: string) => {
    const b = await boxOf(l);
    expect(Math.min(b.width, b.height), `${name} is too small for a finger`).toBeGreaterThanOrEqual(40);
  };

  await expect(sheet.getByRole('tabpanel')).not.toContainText(/drag|Delete/);
  await expect(sheet.getByRole('tabpanel')).toContainText('Sends requests to');
  await expect(bottomBar.locator('kbd').first()).toBeHidden();
  for (const name of ['Mission', 'Inspector', 'Results']) await minSize(sheet.getByRole('tab', { name }), `${name} tab`);

  await bottomBar.getByRole('button', { name: /App server/ }).tap();
  const inspector = sheet.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByRole('heading', { name: 'App server' })).toBeVisible();
  await minSize(inspector.getByRole('button', { name: 'Add instance' }), 'Add instance');
  await minSize(inspector.getByRole('spinbutton', { name: 'Instances' }), 'Instances field');
  await minSize(inspector.locator('label', { has: page.getByRole('radio', { name: 'Large' }) }), 'Large size');
  await minSize(inspector.getByRole('group', { name: 'Sends requests to' }).locator('label').first(), 'Sends requests to choice');

  await inspector.getByRole('button', { name: 'Add instance' }).tap();
  await expect(inspector.getByRole('spinbutton', { name: 'Instances' })).toHaveValue('2');
  await expect(node(page, 'app-2')).toBeVisible();

  await minSize(inspector.getByRole('button', { name: 'Remove component' }), 'Remove');
  await inspector.getByRole('button', { name: 'Remove component' }).tap();
  await expect(node(page, 'App server')).toHaveCount(0);
});

test('on a phone the component bar scrolls sideways when the components do not fit, and Play stays on screen', async ({ page }) => {
  await openLevel(page, '04-flash-sale', 'god');
  const { bottomBar } = parts(page);
  const hotbar = bottomBar.getByRole('toolbar', { name: 'Components' });
  await expect(hotbar.getByRole('button')).toHaveCount(4);
  expect(await hotbar.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(inside(await boxOf(bottomBar.getByRole('button', { name: 'Play' })), { x: 0, y: 0, width: 390, height: 844 })).toBe(true);
  await hotbar.getByRole('button', { name: /Database/ }).scrollIntoViewIfNeeded();
  await hotbar.getByRole('button', { name: /Database/ }).tap();
  await expect(node(page, 'Database')).toBeVisible();
});

const screen = { x: 0, y: 0, width: 390, height: 844 };

/** Level 2 in Hard mode with one app server instance: the design runs and the app server overloads. */
async function openFailingDesign(page: Page) {
  await openLevel(page, '02-first-spike', 'hard');
  await canvasSettled(page);
  await node(page, 'App server').getByText('App server', { exact: true }).tap();
  await parts(page).sheet.getByRole('button', { name: 'Remove instance' }).tap();
  await expect(node(page, 'app-2')).toHaveCount(0);
}

test('on a phone Play closes the sheet so the run can be watched, with the clock over the diagram', async ({ page }) => {
  await openFailingDesign(page);
  const { topBar, diagram, sheet, bottomBar } = parts(page);

  await bottomBar.getByRole('button', { name: 'Play' }).tap();
  await expect(sheet.getByRole('tabpanel')).toBeHidden();
  const clock = page.getByRole('timer', { name: 'Simulation clock' });
  await expect(clock).toBeVisible();
  expect(inside(await boxOf(clock), await boxOf(diagram)), 'the clock is outside the diagram').toBe(true);
  expect(overlap(await boxOf(clock), await boxOf(topBar))).toBe(false);

  // While the run plays, the bar offers Skip instead of components.
  await expect(bottomBar.getByRole('toolbar', { name: 'Components' })).toBeHidden();
  const skip = bottomBar.getByRole('button', { name: 'Skip to results' });
  expect(inside(await boxOf(skip), screen)).toBe(true);
  await skip.tap();
  await expect(page.getByRole('dialog', { name: 'Level failed' })).toBeVisible();
});

test('on a phone the report card fits, and View details opens the inspector on the bottleneck', async ({ page }) => {
  await openFailingDesign(page);
  const { sheet, bottomBar } = parts(page);
  await bottomBar.getByRole('button', { name: 'Play' }).tap();
  await bottomBar.getByRole('button', { name: 'Skip to results' }).tap();

  const report = page.getByRole('dialog', { name: 'Level failed' });
  await expect(report).toContainText('The app servers are saturated');
  expect(inside(await boxOf(report), screen), 'the report card leaves the screen').toBe(true);
  for (const name of ['Back to design', 'View details']) expect(inside(await boxOf(report.getByRole('button', { name })), screen)).toBe(true);

  await report.getByRole('button', { name: 'View details' }).tap();
  await expect(report).toBeHidden();
  await expect(sheet.getByRole('tab', { name: 'Inspector' })).toHaveAttribute('aria-selected', 'true');
  await expect(sheet.getByRole('complementary', { name: 'Inspector' }).getByRole('heading', { name: 'App server' })).toBeVisible();
  await expect(node(page, 'App server')).toContainText('Bottleneck');
});

test('on a phone the results tab shows the verdict, the hint and the charts one under another', async ({ page }) => {
  await openFailingDesign(page);
  const { sheet, bottomBar } = parts(page);
  await bottomBar.getByRole('button', { name: 'Play' }).tap();
  await bottomBar.getByRole('button', { name: 'Skip to results' }).tap();
  await page.getByRole('dialog', { name: 'Level failed' }).getByRole('button', { name: 'Back to design' }).tap();

  // After a run the sheet opens on the results.
  await expect(sheet.getByRole('tab', { name: 'Results' })).toHaveAttribute('aria-selected', 'true');
  const results = sheet.getByRole('region', { name: 'Results' });
  await expect(results).toContainText('Level failed');
  await expect(results).toContainText('The app servers are saturated');
  const charts = results.locator('.chart');
  await expect(charts).toHaveCount(3);
  const boxes = [await boxOf(charts.nth(0)), await boxOf(charts.nth(1)), await boxOf(charts.nth(2))];
  for (let i = 1; i < 3; i++) {
    expect(boxes[i]!.x).toBeCloseTo(boxes[0]!.x, 0);
    expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y + boxes[i - 1]!.height - 1);
  }
  const loads = results.getByRole('listitem').filter({ hasText: 'app-1' });
  await loads.scrollIntoViewIfNeeded();
  await expect(loads).toContainText('100%');
});

test('on a phone a design problem shows above the component bar', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'god');
  const { diagram, bottomBar } = parts(page);
  await bottomBar.getByRole('button', { name: 'Play' }).tap();
  const problem = page.getByRole('alert');
  await expect(problem).toContainText('Connect Clients to a component first');
  expect(inside(await boxOf(problem), await boxOf(diagram)), 'the problem is outside the diagram').toBe(true);
});

test('on a phone a new player finishes the level 1 tutorial with taps', async ({ page }) => {
  await page.goto('/#01-hello-world');
  await page.getByRole('list', { name: 'Modes' }).getByRole('link', { name: /Guided/ }).tap();
  const { topBar, diagram, sheet, bottomBar } = parts(page);
  const tutorial = page.getByRole('region', { name: 'Tutorial' });
  const clear = async () => {
    const card = await boxOf(tutorial);
    expect(inside(card, screen), 'the tutorial leaves the screen').toBe(true);
    for (const [name, other] of [['top bar', topBar], ['diagram', diagram], ['sheet', sheet], ['component bar', bottomBar]] as const) {
      expect(overlap(card, await boxOf(other)), `the tutorial covers the ${name}`).toBe(false);
    }
  };

  await expect(tutorial).toContainText('Step 1 of 4');
  await clear();
  await canvasSettled(page);
  await node(page, 'App server').getByText('App server', { exact: true }).tap();

  await expect(tutorial).toContainText('Step 2 of 4');
  await expect(tutorial).toContainText('Sends requests to');
  await expect(tutorial).not.toContainText(/drag/i);
  await clear();
  const sendsTo = sheet.getByRole('group', { name: 'Sends requests to' });
  await expect(sendsTo).toHaveClass(/tutorial-target/);
  await sendsTo.getByRole('radio', { name: 'Database' }).check();

  await expect(tutorial).toContainText('Step 3 of 4');
  await expect(bottomBar.getByRole('button', { name: 'Play' })).toHaveClass(/tutorial-target/);
  await bottomBar.getByRole('button', { name: 'Play' }).tap();

  await expect(tutorial).toContainText('Step 4 of 4');
  // The clock stays inside the diagram area, below the tutorial card.
  const clock = page.getByRole('timer', { name: 'Simulation clock' });
  expect(overlap(await boxOf(clock), await boxOf(tutorial)), 'the clock covers the tutorial').toBe(false);
  await bottomBar.getByRole('button', { name: 'Skip to results' }).tap();
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
  await expect(tutorial).toContainText('Tutorial complete');

  await page.goto('/#01-hello-world');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveText([/Guided/, /Normal/, /Hard/, /God/]);
});
