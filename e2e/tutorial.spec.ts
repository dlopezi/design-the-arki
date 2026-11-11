import { expect, test } from '@playwright/test';
import { dragConnect, playWave, startMission, unit } from './helpers';

test('a new player learns the controls in a guided tutorial on level 1, which unlocks every mode', async ({ page }) => {
  // Before the tutorial only Guided exists, so the mission opens in it without asking.
  await page.goto('/#01-hello-world');
  await expect(page).toHaveURL(/#01-hello-world\/guided$/);
  await startMission(page);

  const tutorial = page.getByRole('region', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Step 1 of 4');
  await expect(tutorial).toContainText('Select the app server');
  await expect(unit(page, 'app-1')).toHaveClass(/tutorial-target/);
  // The map already says what is wrong: the app server has no way out, the database no way in.
  await expect(unit(page, 'app-1')).toContainText('no way out');
  await expect(unit(page, 'Database')).toContainText('no way in');

  await unit(page, 'app-1').click();
  await expect(tutorial).toContainText('Step 2 of 4');
  await dragConnect(page, 'app-1', 'Database');
  await expect(tutorial).toContainText('Step 3 of 4');
  await expect(page.getByRole('button', { name: /Bring them now/ })).toHaveClass(/tutorial-target/);

  await page.getByRole('button', { name: /Bring them now/ }).click();
  await expect(tutorial).toContainText('Step 4 of 4');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
  await expect(tutorial).toContainText('Tutorial complete');

  await page.goto('/#01-hello-world');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveText([/Guided/, /Normal/, /Hard/, /God/]);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveCount(4);
});

test('modes other than guided cannot be opened by link before the tutorial', async ({ page }) => {
  await page.goto('/#01-hello-world/god');
  await startMission(page);
  await expect(page.getByText('Mode: Guided')).toBeVisible();
  await page.goto('/#mode');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('listitem').filter({ hasText: 'God' })).toContainText('Finish the tutorial first');
});

test('the tutorial can be skipped, which also unlocks every mode', async ({ page }) => {
  await page.goto('/#01-hello-world/guided');
  await startMission(page);
  await page.getByRole('region', { name: 'Tutorial' }).getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(page.getByRole('region', { name: 'Tutorial' })).toHaveCount(0);
  await page.goto('/#01-hello-world');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveCount(4);
});
