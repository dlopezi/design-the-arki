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
