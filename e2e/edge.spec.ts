import { expect, test, type Page } from '@playwright/test';
import { buildCard, buildKeys, openLevel, playWave } from './helpers';

const chapterOne = ['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down', '07-tight-budget', '08-black-friday'];
const chapterTwo = ['09-slow-processing', '10-watch-and-upload', '11-upload-rush', '12-worker-goes-down', '13-fresh-videos', '14-launch-day'];
const chapterThree = ['15-too-many-reads', '16-just-saved-not-there', '17-too-much-to-write', '18-hot-shard', '19-big-uploads', '20-release-day'];
const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

async function progressWith(page: Page, passed: string[]) {
  await page.addInitScript(ids => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'god', levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, passed);
}

test('chapter 4 is a new sector of the campaign map, locked until chapter 3 is finished', async ({ page }) => {
  await progressWith(page, [...chapterOne, ...chapterTwo, ...chapterThree.slice(0, 5)]);
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 4 · Edge' })).toBeVisible();
  await expect(levelCard(page, 'Far away videos')).toContainText('Locked');
  await progressWith(page, [...chapterOne, ...chapterTwo, ...chapterThree]);
  await page.reload();
  await expect(levelCard(page, 'Far away videos').getByRole('button', { name: /Play/ })).toBeVisible();
});

test('level 21: without a CDN the viral video loses, and the hint says to put a CDN in front of Object Storage', async ({ page }) => {
  await openLevel(page, '21-far-away-videos', 'normal');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('CDN');
});

test('level 21: building a CDN connects it by itself, and the base lasts the wave', async ({ page }) => {
  await openLevel(page, '21-far-away-videos', 'normal');
  await expect(buildCard(page, /CDN/)).toBeVisible();
  await buildKeys(page, '1'); // the CDN is the first card
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('the Manual: the CDN entry is locked until its level and says what it is in real life afterwards', async ({ page }) => {
  await progressWith(page, chapterOne);
  await page.goto('/#manual/buildings');
  await page.getByRole('button', { name: /CDN/ }).click();
  await expect(page.getByRole('region', { name: /CDN/ })).toContainText('Reach level 21 to unlock this building.');
  await progressWith(page, [...chapterOne, ...chapterTwo, ...chapterThree]);
  await page.reload();
  await page.getByRole('button', { name: /CDN/ }).click();
  await expect(page.getByText('Cloudflare · Amazon CloudFront')).toBeVisible();
});

test('level 22: the freshness limit is shown, and a TTL that is too long loses with a hint about old content', async ({ page }) => {
  await openLevel(page, '22-old-content', 'guided');
  await expect(page.getByRole('status', { name: 'Content age' })).toContainText('max 50 s');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('old content');
});

test('level 22: raising the TTL of a CDN that is too short, to a value under the limit, wins', async ({ page }) => {
  await openLevel(page, '22-old-content', 'normal');
  await page.locator('[data-node-id="cdn"]').first().click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Longer TTL' }).click(); // 10 → 40
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 23: without an API Gateway the junk fills the app servers, and the hint says to put an API Gateway at the door', async ({ page }) => {
  await openLevel(page, '23-one-door', 'normal');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('API Gateway');
});

test('level 23: building an API Gateway takes the users and passes the valid requests on, and the base lasts the wave', async ({ page }) => {
  await openLevel(page, '23-one-door', 'normal');
  await buildKeys(page, '1'); // the API Gateway is the first card of this level
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 24: with no way to stop the abusive clients the base loses, and the hint explains the Client Limit', async ({ page }) => {
  await openLevel(page, '24-abusive-client', 'normal');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Client Limit');
});

test('level 24: a Client Limit that is too low refuses normal clients and loses with its own hint, and a good one wins', async ({ page }) => {
  await openLevel(page, '24-abusive-client', 'hard'); // starts with a limit of 5, under what a normal client sends
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('normal clients too');

  await page.reload();
  await page.getByRole('button', { name: /Start building/ }).click();
  await page.locator('[data-node-id="gw"]').first().click();
  await page.getByRole('button', { name: 'Higher Client Limit' }).click(); // 5 → 10
  const win = await playWave(page);
  await expect(win).toContainText('Base defended');
});

test('level 25: the map shows two Regions and the DNS, and a building goes into the Region chosen in the build card', async ({ page }) => {
  await openLevel(page, '25-region-falls', 'normal');
  await expect(page.locator('[data-region="main"]')).toContainText('Region 1 · main');
  await expect(page.locator('[data-region="standby"]')).toContainText('Region 2 · standby');
  await expect(page.locator('[data-region="standby"]')).toContainText('Empty standby Region');
  await page.getByRole('group', { name: 'Build in' }).getByRole('button', { name: 'Region 2 · standby' }).click();
  await buildKeys(page, '2'); // the load balancer: the DNS is the first card
  await expect(page.locator('[data-region="standby"] .play-unit', { hasText: 'Load balancer' })).toBeVisible();
  await expect(page.locator('[data-region="main"] .play-unit', { hasText: 'Load balancer' })).toBeVisible(); // the one that was there
});

test('level 25: with no standby Region the whole base is lost when Region 1 falls, and the hint says to build one and a DNS', async ({ page }) => {
  await openLevel(page, '25-region-falls', 'normal');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('standby Region');
});

test('level 25: a DNS with a long TTL switches too late and loses; a shorter TTL wins, and the gauge counts the switch', async ({ page }) => {
  await openLevel(page, '25-region-falls', 'guided');
  await expect(page.getByRole('status', { name: 'DNS' })).toContainText('DNS TTL 30 s');
  const lost = await playWave(page);
  await expect(lost).toContainText('Base lost');
  await expect(lost).toContainText('DNS TTL');

  await page.reload();
  await page.getByRole('button', { name: /Start building/ }).click();
  await page.locator('[data-node-id="dns"]').first().click();
  await page.getByRole('button', { name: 'Shorter TTL' }).click(); // 30 → 10
  await expect(page.getByRole('status', { name: 'DNS' })).toContainText('DNS TTL 10 s');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  await expect(page.getByRole('status', { name: 'DNS' })).toContainText('Failover in', { timeout: 20_000 });
  const won = page.getByRole('dialog');
  await expect(won).toBeVisible({ timeout: 40_000 });
  await expect(won).toContainText('Base defended');
});
