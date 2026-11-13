import { expect, test, type Page } from '@playwright/test';
import { openLevel } from './helpers';

const chapterOne = ['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down', '07-tight-budget', '08-black-friday'];
const chapterTwo = ['09-slow-processing', '10-watch-and-upload', '11-upload-rush', '12-worker-goes-down', '13-fresh-videos', '14-launch-day'];
const LEVEL = '15-too-many-reads';
const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

async function progressWith(page: Page, passed: string[]) {
  await page.addInitScript(ids => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'god', levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, passed);
}

test('chapter 3 is a new sector of the campaign map, locked until chapter 2 is finished', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo.slice(0, 5)]);
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 3 · Data scale' })).toBeVisible();
  await expect(levelCard(page, 'Too many reads')).toContainText('Locked');
  await progressWith(page, [...chapterOne, ...chapterTwo]);
  await page.reload();
  await expect(levelCard(page, 'Too many reads').getByRole('button', { name: /Play/ })).toBeVisible();
});

test('level 15: with no Read Replica the primary database is full of reads, and the hint says to add Read Replicas', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo]);
  await openLevel(page, LEVEL, 'normal');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Add Read Replicas');
});

test('level 16: a design whose app server reaches only the Read Replicas loses, and the hint explains the stale read', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads']);
  await openLevel(page, '16-just-saved-not-there', 'hard');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('own change');
  await expect(end).toContainText('Read-your-writes');
});

test('level 17: one database cannot take the writes, the hint says to add Shards, and the Shard Key can be picked while building', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads', '16-just-saved-not-there']);
  await openLevel(page, '17-too-much-to-write', 'normal');
  await page.locator('[data-node-id="db"]').first().click();
  await expect(page.getByRole('group', { name: 'Shard Key' }).getByRole('button', { name: 'Video id' })).toBeEnabled();
  await page.getByRole('group', { name: 'Shard Key' }).getByRole('button', { name: 'Video id' }).click();
  await expect(page.getByRole('group', { name: 'Shard Key' }).getByRole('button', { name: 'Video id' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Add Shards');
});

test('level 18: a poor Shard Key makes a Hot Shard that is shown, the key cannot be changed during the wave, and the hint names the Hot Shard', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write']);
  await openLevel(page, '18-hot-shard', 'normal');
  await page.locator('[data-node-id="db"]').first().click();
  await page.getByRole('button', { name: /Release to production/ }).click();
  await expect(page.locator('.play-unit .sub', { hasText: 'Hot Shard' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('group', { name: 'Shard Key' }).getByRole('button', { name: 'User id' }).click();
  await expect(page.locator('.play-log')).toContainText('locked');
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Hot Shard');
});

test('level 19: files sent through the app server lose, and the hint names Object Storage and the pre-signed URL pattern', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write', '18-hot-shard']);
  await openLevel(page, '19-big-uploads', 'guided');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Object Storage');
  await expect(end).toContainText('pre-signed URL');
});

test('level 20: the Replication Lag is shown next to its maximum, and a Read Replica that is too small loses with a hint about the lag', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write', '18-hot-shard', '19-big-uploads']);
  await openLevel(page, '20-release-day', 'guided');
  await expect(page.getByRole('status', { name: 'Replication Lag' })).toContainText('max 2 s');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 40_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Replication Lag');
});

test('the Manual: the Read Replica and Object Storage entries are locked until their level, and the Concepts tab explains data scale', async ({ page }) => {
  await progressWith(page, chapterOne);
  await page.goto('/#manual/buildings');
  await page.getByRole('button', { name: /Read Replica/ }).click();
  await expect(page.getByRole('region', { name: /Read Replica/ })).toContainText('Reach level 15 to unlock this building.');
  await page.getByRole('button', { name: /Object Storage/ }).click();
  await expect(page.getByRole('region', { name: /Object Storage/ })).toContainText('Reach level 19 to unlock this building.');
  await page.goto('/#manual/concepts');
  for (const title of ['Replication Lag', 'Read-your-writes', 'Sharding', 'Shard Key', 'Hot Shard', 'Pre-signed URL', 'Failover']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
});

test('the Manual: once the levels are reached, the Read Replica and Object Storage entries say what they are in real life', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, '15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write', '18-hot-shard']);
  await page.goto('/#manual/buildings');
  await page.getByRole('button', { name: /Read Replica/ }).click();
  await expect(page.getByText('PostgreSQL or MySQL read replicas')).toBeVisible();
  await page.getByRole('button', { name: /Object Storage/ }).click();
  await expect(page.getByText('Amazon S3 · Google Cloud Storage')).toBeVisible();
});
