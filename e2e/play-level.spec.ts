import { expect, test } from '@playwright/test';

test('a player opens level 1, presses Play and passes it', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Hello world' })).toBeVisible();
  await expect(page.getByText('App server', { exact: true })).toBeVisible();
  await expect(page.getByText('Database', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();

  const report = page.getByRole('dialog', { name: 'Level passed' });
  await expect(report).toBeVisible();
  await expect(report).toContainText(/p95\s*\d+ ms/);
  await expect(report).toContainText(/Errors\s*0\.0%/);
});

test('cost, objectives and stars', async ({ page }) => {
  await page.goto('/');
  const objectives = page.getByRole('list', { name: 'Objectives' });

  // Before running: cost is live, budget is already judged, performance objectives are pending.
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuetext', '$90 of $150; ★★ at $120, ★★★ at $100');
  await expect(objectives.getByRole('listitem').filter({ hasText: 'Cost' })).toHaveAttribute('data-state', 'met');
  await expect(objectives.getByRole('listitem').filter({ hasText: 'p95' })).toHaveAttribute('data-state', 'pending');

  await page.getByRole('button', { name: 'Play' }).click();

  const report = page.getByRole('dialog', { name: 'Level passed' });
  await expect(report.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(report).toContainText('$90');
  await report.getByRole('button', { name: 'Back to design' }).click();
  await expect(report).toBeHidden();
  await expect(objectives.getByRole('listitem').filter({ hasText: 'p95' })).toHaveAttribute('data-state', 'met');
  await expect(objectives.getByRole('listitem').filter({ hasText: 'Errors' })).toHaveAttribute('data-state', 'met');
});
