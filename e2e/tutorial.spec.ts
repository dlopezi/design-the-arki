import { expect, test } from '@playwright/test';
import { connect, node, select } from './helpers';

test('a new player learns the controls in a guided tutorial on level 1, which unlocks every mode', async ({ page }) => {
  await page.goto('/#01-hello-world');
  const modes = page.getByRole('list', { name: 'Modes' });
  await expect(modes.getByRole('link')).toHaveText([/Guided/]);
  await expect(modes.getByRole('listitem').filter({ hasText: 'God' })).toContainText('Finish the tutorial first');
  await modes.getByRole('link', { name: /Guided/ }).click();

  const tutorial = page.getByRole('region', { name: 'Tutorial' });
  await expect(tutorial).toContainText('Step 1 of 4');
  await expect(tutorial).toContainText('Select the app server');
  await expect(node(page, 'App server').locator('.tutorial-target')).toHaveCount(1);

  await select(page, 'App server');
  await expect(tutorial).toContainText('Step 2 of 4');
  await expect(node(page, 'Database').locator('.tutorial-target')).toHaveCount(1);

  await connect(page, { label: 'App server' }, { label: 'Database' });
  await expect(tutorial).toContainText('Step 3 of 4');
  await expect(page.getByRole('button', { name: 'Play' })).toHaveClass(/tutorial-target/);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(tutorial).toContainText('Step 4 of 4');
  await page.getByRole('button', { name: 'Skip to results' }).click();
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
  await expect(tutorial).toContainText('Tutorial complete');

  await page.goto('/#01-hello-world');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveText([/Guided/, /Normal/, /Hard/, /God/]);
  await page.reload();
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveCount(4);
});

test('modes other than guided cannot be opened by link before the tutorial', async ({ page }) => {
  await page.goto('/#01-hello-world/god');
  await expect(page.getByRole('list', { name: 'Modes' })).toBeVisible();
});

test('the tutorial can be skipped, which also unlocks every mode', async ({ page }) => {
  await page.goto('/#01-hello-world/guided');
  await page.getByRole('region', { name: 'Tutorial' }).getByRole('button', { name: 'Skip tutorial' }).click();
  await expect(page.getByRole('region', { name: 'Tutorial' })).toHaveCount(0);
  await page.goto('/#01-hello-world');
  await expect(page.getByRole('list', { name: 'Modes' }).getByRole('link')).toHaveCount(4);
});
