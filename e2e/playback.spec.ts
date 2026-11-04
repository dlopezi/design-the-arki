import { expect, test } from '@playwright/test';
import { buildScaledOut, node } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/#02-first-spike');
  await expect(page.getByRole('heading', { name: 'First spike' })).toBeVisible();
  await buildScaledOut(page);
});

test('pressing Play replays the run: a clock, live numbers, per-instance load, then the report', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();

  const clock = page.getByRole('timer', { name: 'Simulation clock' });
  await expect(clock).toContainText(/t = \d+ s/);
  await expect(clock).toContainText(/\d+ req\/s/);
  await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
  await expect(node(page, 'app-1')).toContainText(/\d+%/);
  await expect(page.locator('.flow-dot').first()).toBeAttached();

  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible({ timeout: 12_000 });
  await expect(clock).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
});

test('the playback can be skipped', async ({ page }) => {
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: 'Skip to results' }).click();
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('numbers still update but no dots travel along connections', async ({ page }) => {
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('timer', { name: 'Simulation clock' })).toContainText(/t = \d+ s/);
    await expect(node(page, 'app-1')).toContainText(/\d+%/);
    await expect(page.locator('.flow-dot')).toHaveCount(0);
  });
});
