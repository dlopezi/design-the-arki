import { expect, test } from '@playwright/test';
import { buildScaledOut, node, playAndSkip, openLevel } from './helpers';

test.beforeEach(async ({ page }) => {
  await openLevel(page, '02-first-spike', 'normal');
  await expect(page.getByRole('heading', { name: 'First spike' })).toBeVisible();
});

test('a failed run explains itself: hint, highlighted bottleneck, results drawer and per-instance stats', async ({ page }) => {
  await buildScaledOut(page, 1, { databasePlaced: true });
  await playAndSkip(page);

  const report = page.getByRole('dialog', { name: 'Level failed' });
  await expect(report).toContainText('The app servers are saturated');
  await report.getByRole('button', { name: 'View details' }).click();
  await expect(report).toBeHidden();

  await expect(node(page, 'App server')).toContainText('Bottleneck');

  const results = page.getByRole('region', { name: 'Results' });
  await expect(results).toContainText('Level failed');
  await expect(results).toContainText('The app servers are saturated');
  for (const chart of ['Requests per second', 'p95 latency', 'Error rate']) await expect(results.getByRole('img', { name: new RegExp(chart) })).toBeVisible();
  await expect(results.getByRole('listitem').filter({ hasText: 'app-1' })).toContainText('100%');

  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByRole('heading', { name: 'App server' })).toBeVisible();
  const row = inspector.getByRole('row').filter({ hasText: 'app-1' });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell').nth(3)).not.toHaveText('0');
});

test('the inspector is always shown; results can be hidden and shown with a button or the R key', async ({ page }) => {
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  const results = page.getByRole('region', { name: 'Results' });
  await expect(inspector).toBeVisible();
  await expect(results).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inspector' })).toHaveCount(0);

  await page.keyboard.press('i');
  await expect(inspector).toBeVisible();
  await page.keyboard.press('r');
  await expect(results).toHaveCount(0);
  await page.getByRole('button', { name: 'Results' }).click();
  await expect(results).toBeVisible();
});

test('a healthy run has no bottleneck', async ({ page }) => {
  await buildScaledOut(page, 2, { databasePlaced: true });
  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
  await expect(page.getByText('Bottleneck', { exact: true })).toHaveCount(0);
});
