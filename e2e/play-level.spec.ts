import { expect, test, type Page } from '@playwright/test';

const node = (page: Page, label: string, nth = 0) => page.locator('.react-flow__node', { hasText: label }).nth(nth);

/** Waits until the canvas stops reframing (it refits after components are added). */
async function canvasSettled(page: Page) {
  const transform = () => page.locator('.react-flow__viewport').evaluate(el => (el as HTMLElement).style.transform);
  await expect.poll(async () => {
    const before = await transform();
    await page.waitForTimeout(100);
    return before === (await transform());
  }).toBe(true);
}

async function connect(page: Page, from: { label: string; nth?: number }, to: { label: string; nth?: number }) {
  const edges = page.locator('.react-flow__edge');
  const before = await edges.count();
  await canvasSettled(page);
  await node(page, from.label, from.nth).locator('.react-flow__handle.source')
    .dragTo(node(page, to.label, to.nth).locator('.react-flow__handle.target'));
  await expect(edges).toHaveCount(before + 1);
}

/** Builds Clients → App server → Database from the hotbar. */
async function buildServerAndDatabase(page: Page) {
  await page.keyboard.press('1');
  await page.getByRole('toolbar', { name: 'Components' }).getByRole('button', { name: /Database/ }).click();
  await connect(page, { label: 'Clients' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Database' });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello world' })).toBeVisible();
});

test('a player builds level 1 from an empty canvas and passes it', async ({ page }) => {
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.getByRole('toolbar', { name: 'Components' }).getByRole('button')).toHaveText([/App server/, /Database/]);

  await buildServerAndDatabase(page);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '90');

  await page.keyboard.press('Space');

  const report = page.getByRole('dialog', { name: 'Level passed' });
  await expect(report.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(report).toContainText(/p95\s*\d+ ms/);
  await report.getByRole('button', { name: 'Back to design' }).click();
  const objectives = page.getByRole('list', { name: 'Objectives' });
  await expect(objectives.getByRole('listitem').filter({ hasText: 'p95' })).toHaveAttribute('data-state', 'met');
});

test('a component can be dragged from the bar onto the canvas', async ({ page }) => {
  await page.getByRole('toolbar', { name: 'Components' }).getByRole('button', { name: /Database/ })
    .dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: 900, y: 420 } });
  await expect(node(page, 'Database')).toHaveCount(1);
});

test('a design that cannot serve traffic is explained instead of run', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert')).toContainText('Connect Clients to a component');

  await page.keyboard.press('1');
  await connect(page, { label: 'Clients' }, { label: 'App server' });
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert')).toContainText('App server has nowhere to send requests');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('components and connections can be removed', async ({ page }) => {
  await buildServerAndDatabase(page);

  await node(page, 'Database').click();
  await page.keyboard.press('Delete');
  await expect(node(page, 'Database')).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '40');

  await page.locator('.react-flow__edge').first().click({ force: true });
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(node(page, 'Clients')).toHaveCount(1);
});

test('a passing design that is too expensive for 3 stars says what cost to aim for', async ({ page }) => {
  await page.keyboard.press('1');
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await connect(page, { label: 'Clients' }, { label: 'App server', nth: 0 });
  await connect(page, { label: 'App server', nth: 0 }, { label: 'App server', nth: 1 });
  await connect(page, { label: 'App server', nth: 1 }, { label: 'Database' });

  await page.getByRole('button', { name: 'Play' }).click();

  const report = page.getByRole('dialog', { name: 'Level passed' });
  await expect(report.getByRole('img', { name: '1 of 3 stars' })).toBeVisible();
  await expect(report).toContainText('Get the cost down to $120/month for ★★.');
});
