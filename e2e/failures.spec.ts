import { expect, test } from '@playwright/test';
import { buildScaledOut, node, playAndSkip } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/#06-server-goes-down');
  await expect(page.getByRole('heading', { name: 'A server goes down' })).toBeVisible();
});

test('the incident is announced before playing', async ({ page }) => {
  await expect(page.getByRole('list', { name: 'Incidents' })).toContainText('App server instance 1 goes down at 20 s');
});

test('two instances fail when one goes down: redundancy hint, and the instance shows as down', async ({ page }) => {
  await buildScaledOut(page, 2);
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(node(page, 'app-1')).toContainText('Down', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Skip to results' }).click();

  const report = page.getByRole('dialog', { name: 'Level failed' });
  await expect(report).toContainText('N+1');
  await report.getByRole('button', { name: 'View details' }).click();

  await expect(page.getByRole('region', { name: 'Results' }).getByRole('listitem').filter({ hasText: 'app-1' })).toContainText('Down');
  await expect(page.getByRole('complementary', { name: 'Inspector' }).getByRole('row').filter({ hasText: 'app-1' })).toContainText('down at 20 s');
});

test('three instances survive the failure', async ({ page }) => {
  await buildScaledOut(page, 3);
  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' }).getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
});
