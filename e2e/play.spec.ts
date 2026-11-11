import { expect, test } from '@playwright/test';
import { buildCard, buildKeys, dragConnect, internet, openLevel, playWave, unit } from './helpers';

test('the map starts empty; built components connect themselves and a well-built base survives the wave', async ({ page }) => {
  await openLevel(page, '02-first-spike');
  await expect(page.getByText('Construction zone')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Users arrive in' })).toBeVisible();

  // 1 load balancer, 3 app server instances, 1 database: the cards follow the level's order.
  await buildKeys(page, '12223');
  await expect(unit(page, 'Load balancer')).toBeVisible();
  for (const name of ['app-1', 'app-2', 'app-3']) await expect(unit(page, name)).toBeVisible();
  await expect(page.locator('[data-container]')).toContainText('3 instances');
  await expect(internet(page)).toBeVisible();

  // Building takes time: the app server card shows it, and an instance under construction says so.
  await expect(buildCard(page, /App server/)).toContainText('5s');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
  await expect(end.getByRole('img', { name: /stars/ })).toBeVisible();
});

test('without a load balancer only the first instance gets traffic; the base is lost and the hint names the cause', async ({ page }) => {
  // Normal mode starts with the database built, and shows the hint after a lost wave.
  await openLevel(page, '02-first-spike', 'normal');
  await buildKeys(page, '222');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Bring them now/ }).click();
  await expect(unit(page, 'app-2')).toContainText('no traffic', { timeout: 10_000 });
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('The app servers are saturated');
});

test('a connection can be made by dragging, selected with a click and removed with Delete', async ({ page }) => {
  await openLevel(page, '02-first-spike');
  await page.getByRole('button', { name: /Auto-connect/ }).click(); // off: the player wires everything
  await buildKeys(page, '23');
  await expect(unit(page, 'app-1')).toContainText('no way in', { timeout: 10_000 });
  await dragConnect(page, 'app-1', 'Database');
  await expect(page.locator('.play-log')).toContainText('Connected: App server → Database');
  await expect(unit(page, 'app-1')).toContainText('no way in');
  await expect(unit(page, 'Database')).not.toContainText('no way in');

  // A connection out of the database is refused.
  await dragConnect(page, 'Database', 'app-1');
  await expect(page.locator('.play-log')).toContainText('Cannot connect: the database does not send requests.');

  // Click the line between them and delete it.
  const a = (await unit(page, 'app-1').locator('svg').boundingBox())!, b = (await unit(page, 'Database').locator('svg').boundingBox())!;
  await page.mouse.click((a.x + a.width + b.x) / 2, (a.y + a.height * 0.62 + b.y + b.height * 0.62) / 2);
  await expect(page.getByRole('region', { name: 'Inspector' })).toContainText('Connection');
  await page.keyboard.press('Delete');
  await expect(page.locator('.play-log')).toContainText('Connection removed: App server → Database');
});

test('the map shows the first three C4 layers: context, containers and components', async ({ page }) => {
  await openLevel(page, '02-first-spike');
  await buildKeys(page, '1223');
  const c4 = page.getByRole('group', { name: 'C4 view' });
  await expect(unit(page, 'app-2')).toBeVisible();

  await c4.getByRole('button', { name: /Containers/ }).click();
  await expect(unit(page, 'app-2')).toHaveCount(0);
  await expect(page.locator('.play-unit', { hasText: 'App server × 2' })).toBeVisible();

  await c4.getByRole('button', { name: /Context/ }).click();
  await expect(page.locator('[data-node="system"]')).toContainText('4 buildings');

  // Building from layer 1 shows the new building in layer 3.
  await page.keyboard.press('2');
  await expect(c4.getByRole('button', { name: /Components/ })).toHaveAttribute('aria-pressed', 'true');
});

test('the inspector changes a cache\'s TTL, and a new component is introduced in the mission', async ({ page }) => {
  await openLevel(page, '04-flash-sale');
  await expect(page.getByRole('region', { name: 'Mission' })).toContainText('New: Cache');
  await buildKeys(page, '3');
  await unit(page, 'Cache').click();
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toContainText('25%');
  for (let i = 0; i < 5; i++) await inspector.getByRole('button', { name: 'Longer TTL' }).click();
  await expect(inspector).toContainText('67%');
});

test('a scripted incident takes an instance down during the wave', async ({ page }) => {
  await openLevel(page, '06-server-goes-down');
  await expect(page.getByRole('region', { name: 'Mission' })).toContainText('10 s into the wave, one App server instance goes down.');
  await buildKeys(page, '12222');
  await page.waitForTimeout(6000);
  await page.getByRole('button', { name: /Bring them now/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  await expect(page.locator('.play-log')).toContainText('App server went down!', { timeout: 15_000 });
  await expect(page.locator('.play-unit.down')).toHaveCount(1);
});
