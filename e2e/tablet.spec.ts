import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasSettled, node, openLevel, playAndSkip, select } from './helpers';

type Box = { x: number; y: number; width: number; height: number };
const boxOf = async (l: Locator): Promise<Box> => {
  const b = await l.boundingBox();
  if (!b) throw new Error('element is not visible');
  return b;
};
const overlap = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const parts = (page: Page) => ({
  side: page.locator('.side-panel'),
  cost: page.locator('.cost-hud'),
  toggles: page.locator('.panel-toggles'),
  controls: page.locator('.controls'),
  results: page.getByRole('region', { name: 'Results' }),
});

/** Panels and controls never cover each other, and the diagram's components are clear of all of them. */
async function expectClearLayout(page: Page, extra: Record<string, Locator> = {}) {
  await canvasSettled(page);
  const panels: Record<string, Locator> = { ...parts(page), ...extra };
  const boxes: [string, Box][] = [];
  for (const [name, l] of Object.entries(panels)) if (await l.isVisible()) boxes.push([name, await boxOf(l)]);
  for (const [a, boxA] of boxes) for (const [b, boxB] of boxes) if (a < b) expect(overlap(boxA, boxB), `${a} overlaps ${b}`).toBe(false);
  const viewport = page.viewportSize()!;
  for (const [name, box] of boxes) expect(box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${name} leaves the screen`).toBe(true);
  for (const label of ['Clients', 'App server', 'Database']) {
    const nodeBox = await boxOf(node(page, label));
    for (const [name, box] of boxes) expect(overlap(nodeBox, box), `${name} covers ${label}`).toBe(false);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
}

const zoom = (page: Page) => page.locator('.react-flow__viewport').evaluate(el => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)?.[1]));

test.describe('portrait tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test('mission and inspector share a side panel with tabs, and the diagram has room', async ({ page }) => {
    await openLevel(page, '02-first-spike', 'hard');
    const { side } = parts(page);
    await expect(side.getByRole('heading', { level: 1 })).toHaveText('First spike');
    await expect(side.getByRole('tab', { name: 'Mission' })).toHaveAttribute('aria-selected', 'true');
    await expect(side.getByRole('tabpanel')).toContainText('The shop was mentioned in a newsletter');
    await expectClearLayout(page);
    // Today's wide layout leaves almost no room at this width: the diagram sits at React Flow's minimum zoom (0.5), under the panels.
    expect(await zoom(page)).toBeGreaterThan(0.5);

    await select(page, 'App server');
    await expect(side.getByRole('tab', { name: 'Inspector' })).toHaveAttribute('aria-selected', 'true');
    await expect(side.getByRole('complementary', { name: 'Inspector' }).getByRole('heading', { name: 'App server' })).toBeVisible();

    // I switches between the tabs; R hides and shows the results.
    await page.keyboard.press('i');
    await expect(side.getByRole('tab', { name: 'Mission' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('r');
    await expect(parts(page).results).toBeHidden();
    await expectClearLayout(page);
    await page.keyboard.press('r');
    await expect(parts(page).results).toBeVisible();
  });

  test('the results drawer shows its charts in two rows', async ({ page }) => {
    await openLevel(page, '02-first-spike', 'hard');
    // One instance without a load balancer runs (and fails).
    await select(page, 'App server');
    await page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Remove instance' }).click();
    await playAndSkip(page);
    await page.getByRole('button', { name: 'Back to design' }).click();
    const charts = parts(page).results.locator('.chart');
    const [rps, p95, errors] = [await boxOf(charts.nth(0)), await boxOf(charts.nth(1)), await boxOf(charts.nth(2))];
    expect(Math.abs(rps.y - p95.y)).toBeLessThan(2);
    expect(errors.y).toBeGreaterThan(rps.y + rps.height - 1);
    await expectClearLayout(page);
  });

  test('the tutorial card covers neither the panels nor the diagram', async ({ page }) => {
    await page.goto('/#01-hello-world/guided');
    const tutorial = page.getByRole('region', { name: 'Tutorial' });
    await expect(tutorial).toContainText('Step 1 of 4');
    await expectClearLayout(page, { tutorial });
  });
});

test.describe('landscape tablet', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('the side panel layout also fits a short screen', async ({ page }) => {
    await openLevel(page, '02-first-spike', 'hard');
    await expect(parts(page).side.getByRole('tablist', { name: 'Panels' })).toBeVisible();
    await expectClearLayout(page);
  });
});
