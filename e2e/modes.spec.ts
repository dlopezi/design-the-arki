import { expect, test, type Page } from '@playwright/test';
import { canvasSettled, connect, node, openLevel, playAndSkip, select, skipTutorial } from './helpers';

const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

test('opening a level asks for a mode', async ({ page }) => {
  await skipTutorial(page);
  await page.goto('/#levels');
  await levelCard(page, 'Hello world').getByRole('button', { name: /Play/ }).click();
  const modes = page.getByRole('list', { name: 'Modes' });
  await expect(modes.getByRole('link')).toHaveText([/Guided/, /Normal/, /Hard/, /God/]);
  await modes.getByRole('link', { name: /Guided/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello world', level: 1 })).toBeVisible();
  await expect(page.getByText('Mode: Guided')).toBeVisible();
});

test('guided mode starts almost complete and shows its hint from the start', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  await expect(node(page, 'App server')).toBeVisible();
  await expect(node(page, 'Database')).toBeVisible();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await expect(page.getByRole('note')).toContainText('Connect the app server to the database');
});

test('normal mode starts partial and only hints after a failed run; god mode never shows the hint sentence', async ({ page }) => {
  await openLevel(page, '02-first-spike', 'normal');
  await expect(node(page, 'Database')).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);

  await openLevel(page, '02-first-spike', 'god');
  for (const key of ['1', '2', '3']) await page.keyboard.press(key);
  await connect(page, { label: 'Clients' }, { label: 'Load balancer' });
  await connect(page, { label: 'Load balancer' }, { label: 'App server' });
  await connect(page, { label: 'App server' }, { label: 'Database' });
  await playAndSkip(page);
  const report = page.getByRole('dialog', { name: 'Level failed' });
  await expect(report).not.toContainText('The app servers are saturated');
  await report.getByRole('button', { name: 'Back to design' }).click();
  await expect(node(page, 'App server')).toContainText('Bottleneck');
});

test('hard mode hands over a broken design to fix', async ({ page }) => {
  await openLevel(page, '02-first-spike', 'hard');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('alert')).toContainText('nothing spreads requests between them');
});

test('passing in hard mode earns the Hard badge, and each mode remembers its own design', async ({ page }) => {
  await skipTutorial(page);
  await page.goto('/#01-hello-world/hard');
  await canvasSettled(page);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await select(page, 'App server', 1);
  await page.keyboard.press('Delete');
  await expect(node(page, 'App server')).toHaveCount(1);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await connect(page, { label: 'App server' }, { label: 'Database' });
  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();

  await page.goto('/#levels');
  await expect(levelCard(page, 'Hello world')).toContainText('Hard');
  await expect(levelCard(page, 'Hello world').getByLabel('Hardest mode passed: Hard')).toBeVisible();

  await page.goto('/#01-hello-world/hard');
  await expect(node(page, 'App server')).toHaveCount(1);
  await page.goto('/#01-hello-world/normal');
  await expect(node(page, 'App server')).toHaveCount(0);
  await expect(node(page, 'Database')).toBeVisible();
});
