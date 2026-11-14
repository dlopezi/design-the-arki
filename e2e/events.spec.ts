import { expect, test, type Page } from '@playwright/test';
import { dragConnect, levelIds, openLevel, playWave } from './helpers';

const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });
const before = (id: string) => levelIds.slice(0, levelIds.indexOf(id));

async function progressWith(page: Page, passed: string[]) {
  await page.addInitScript(ids => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'god', levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, passed);
}

test('chapter 5 is a new sector of the campaign map, locked until chapter 4 is finished', async ({ page }) => {
  const chapterFourDone = before('27-one-post-many-reactions');
  await progressWith(page, chapterFourDone.slice(0, -1));
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 5 · Events' })).toBeVisible();
  await expect(levelCard(page, 'One post, many reactions')).toContainText('Locked');
  await progressWith(page, chapterFourDone);
  await page.reload();
  await expect(levelCard(page, 'One post, many reactions').getByRole('button', { name: /Play/ })).toBeVisible();
});

test('level 27: a Message Queue gives each post to one Worker, so the Subscriptions fall behind; the hint says to use a Topic', async ({ page }) => {
  await openLevel(page, '27-one-post-many-reactions', 'normal');
  await expect(page.getByRole('status', { name: 'Consumer Lag' })).toContainText('/ 10 s');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Use a Topic');
});

test('level 27: connecting the app server to the Topic gives every Subscription its copy, and the base lasts the wave', async ({ page }) => {
  await openLevel(page, '27-one-post-many-reactions', 'guided');
  // Each Worker says which Subscription it serves and where its work goes.
  await expect(page.locator('.play-container').filter({ hasText: 'Notifications' })).toContainText('→ push service');
  await dragConnect(page, 'app-1', 'Topic');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 28: Notifications falls behind with one Worker; one more instance holds it, while Analytics may lag up to its own maximum', async ({ page }) => {
  await openLevel(page, '28-slow-subscriber', 'guided');
  const notifications = page.locator('.play-container').filter({ hasText: 'Notifications' });
  await notifications.locator('.play-unit').first().click();
  await page.getByRole('button', { name: /\+ Instance/ }).click();
  await expect(notifications).toContainText('2 instances');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 29: a Worker instance with no Partition stands idle; one more Partition, set in the build phase, lets all three work', async ({ page }) => {
  await openLevel(page, '29-too-much-for-one-worker', 'guided');
  await page.locator('.play-unit').filter({ hasText: 'Topic' }).click();
  await expect(page.locator('.play-unit').filter({ hasText: 'Topic' }).locator('.play-prow')).toHaveCount(2);
  await page.getByRole('button', { name: 'More Partitions' }).click();
  await expect(page.locator('.play-unit').filter({ hasText: 'Topic' }).locator('.play-prow')).toHaveCount(3);
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 30: the country key makes a Hot Partition; the user id key, picked in the build phase, spreads the posts', async ({ page }) => {
  await openLevel(page, '30-hot-partition', 'guided');
  const topic = page.locator('.play-unit').filter({ hasText: 'Topic' });
  await topic.click();
  await page.getByRole('group', { name: 'Partition Key' }).getByRole('button', { name: 'User id' }).click();
  await expect(page.getByRole('group', { name: 'Partition Key' }).getByRole('button', { name: 'User id' })).toHaveAttribute('aria-pressed', 'true');
  const end = await playWave(page);
  await expect(end).toContainText('Base defended');
});

test('level 30: left on the country key, the base is lost and the hint names the Hot Partition', async ({ page }) => {
  await openLevel(page, '30-hot-partition', 'normal');
  const end = await playWave(page);
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Hot Partition');
});
