import { expect, test } from '@playwright/test';
import { canvasSettled, connect, hotbarButton, node, playAndSkip, select } from './helpers';

test.describe('level 2: first spike', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#02-first-spike');
    await expect(page.getByRole('heading', { name: 'First spike' })).toBeVisible();
  });

  test('a player scales out behind a load balancer and passes', async ({ page }) => {
    await expect(page.getByRole('toolbar', { name: 'Components' }).getByRole('button')).toHaveText([/Load balancer/, /App server/, /Database/]);
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.keyboard.press('3');
    await connect(page, { label: 'Clients' }, { label: 'Load balancer' });
    await connect(page, { label: 'Load balancer' }, { label: 'App server' });
    await connect(page, { label: 'App server' }, { label: 'Database' });

    await select(page, 'App server');
    const inspector = page.getByRole('complementary', { name: 'Inspector' });
    await expect(inspector.getByRole('heading', { name: 'App server' })).toBeVisible();
    await expect(inspector.getByRole('group', { name: 'Instance size' })).toHaveCount(0);
    await inspector.getByRole('button', { name: 'Add instance' }).click();

    await expect(inspector.getByRole('spinbutton', { name: 'Instances' })).toHaveValue('2');
    await expect(node(page, 'app-1')).toBeVisible();
    await expect(node(page, 'app-2')).toBeVisible();
    await expect(inspector).toContainText('Capacity ≈ 400 req/s');
    await expect(inspector).toContainText('2 × $40 = $80/month');
    await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '150');

    await playAndSkip(page);
    await expect(page.getByRole('dialog', { name: 'Level passed' }).getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  });

  test('the diagram groups components C4-style inside the system boundary', async ({ page }) => {
    await page.keyboard.press('1');
    await page.keyboard.press('3');
    await canvasSettled(page);
    await expect(node(page, 'Software system')).toBeVisible();
    await expect(node(page, 'Edge')).toBeVisible();
    await expect(node(page, 'Data')).toBeVisible();
    await expect(node(page, 'Clients')).toContainText('Person');
  });

  test('several instances with no load balancer in front are explained instead of run', async ({ page }) => {
    await page.keyboard.press('2');
    await page.keyboard.press('3');
    await connect(page, { label: 'Clients' }, { label: 'App server' });
    await connect(page, { label: 'App server' }, { label: 'Database' });
    await select(page, 'App server');
    await page.getByRole('complementary', { name: 'Inspector' }).getByRole('button', { name: 'Add instance' }).click();

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('alert')).toContainText('nothing spreads requests between them');
  });
});

test('level 3: a player scales up with a large instance instead', async ({ page }) => {
  await page.goto('/#03-bigger-or-more');
  await expect(page.getByRole('heading', { name: 'Bigger or more?' })).toBeVisible();
  await hotbarButton(page, /App server/).click();
  await hotbarButton(page, /Database/).click();
  await connect(page, { label: 'Clients' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Database' });

  await select(page, 'App server');
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await inspector.getByRole('group', { name: 'Instance size' }).getByRole('radio', { name: 'Large' }).check();
  await expect(inspector).toContainText('4 vCPU · 8 workers · $80/month');
  await expect(inspector).toContainText('Capacity ≈ 400 req/s');
  await expect(page.getByRole('meter', { name: 'Monthly cost' })).toHaveAttribute('aria-valuenow', '130');

  await inspector.getByRole('button', { name: 'Remove component' }).click();
  await expect(node(page, 'App server')).toHaveCount(0);
});
