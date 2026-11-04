import { expect, test } from '@playwright/test';

test('a player opens level 1, presses Play and passes it', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Hello world' })).toBeVisible();
  await expect(page.getByText('App server', { exact: true })).toBeVisible();
  await expect(page.getByText('Database', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();

  await expect(page.getByRole('status')).toContainText('Level passed');
  await expect(page.getByRole('status')).toContainText(/p95 \d+ ms/);
  await expect(page.getByRole('status')).toContainText(/errors 0\.0%/);
});
