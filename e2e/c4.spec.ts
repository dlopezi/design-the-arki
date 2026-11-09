import { expect, test } from '@playwright/test';
import { buildScaledOut, node, openLevel } from './helpers';

test.beforeEach(async ({ page }) => {
  await openLevel(page, '02-first-spike');
  await expect(page.getByRole('heading', { name: 'First spike' })).toBeVisible();
});

test('the diagram can show the first three C4 layers: context, containers and components', async ({ page }) => {
  await buildScaledOut(page, 3);
  const instances = page.locator('.react-flow__node-instance');
  await expect(instances).toHaveCount(3);
  const c4 = page.getByRole('group', { name: 'C4 view' });

  await c4.getByRole('button', { name: /Containers/ }).click();
  await expect(instances).toHaveCount(0);
  await expect(node(page, 'App server')).toContainText('3 instances');

  await c4.getByRole('button', { name: /Context/ }).click();
  await expect(page.locator('.react-flow__node-component')).toHaveCount(0);
  await expect(page.locator('.react-flow__node-context')).toContainText('5 buildings');

  // Building something from layer 1 shows it in layer 3.
  await page.keyboard.press('2');
  await expect(c4.getByRole('button', { name: /Components/ })).toHaveAttribute('aria-pressed', 'true');
});
