import { expect, test, type Page } from '@playwright/test';
import { buildKeys, internet, openLevel, unit } from './helpers';

const MISSION = '09-slow-processing';
const chapterOne = ['01-hello-world', '02-first-spike', '03-bigger-or-more', '04-flash-sale', '05-popular-content', '06-server-goes-down', '07-tight-budget', '08-black-friday'];
const levelCard = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

async function progressWith(page: Page, passed: string[]) {
  await page.addInitScript(ids => {
    localStorage.setItem('design-the-arki:progress', JSON.stringify({ version: 1, tutorialDone: true, mode: 'god', levels: Object.fromEntries(ids.map(i => [i, { bestStars: 1 }])) }));
  }, passed);
}

test('chapter 2 is a new sector of the campaign map, locked until chapter 1 is finished', async ({ page }) => {
  await progressWith(page, chapterOne.slice(0, 7));
  await page.goto('/#levels');
  await expect(page.getByRole('heading', { name: 'Chapter 2 · Async' })).toBeVisible();
  await expect(levelCard(page, 'Slow processing')).toContainText('Locked');
  await expect(levelCard(page, 'Black Friday').getByRole('button', { name: /Play/ })).toBeVisible();
});

test('the last mission of chapter 1 opens mission 1 of chapter 2, which names its new buildings', async ({ page }) => {
  await progressWith(page, chapterOne);
  await page.goto('/#levels');
  await expect(levelCard(page, 'Slow processing').getByRole('button', { name: /Play/ })).toBeVisible();
  // The next mission to play is already selected, so its briefing is shown.
  await expect(page.getByRole('complementary')).toContainText('Slow processing');
  await expect(page.getByRole('complementary')).toContainText('Message queue');
  await expect(page.getByRole('complementary')).toContainText('Worker');
});

test('mission 1: a queue answers at once, the Drain Phase empties the Backlog, and the mission is won', async ({ page }) => {
  await progressWith(page, chapterOne);
  await openLevel(page, MISSION);
  // The cards follow the level's order: app server, database, message queue, Worker. They connect themselves.
  await buildKeys(page, '1234');
  for (const name of ['app-1', 'Database', 'Message queue', 'worker-1']) await expect(unit(page, name)).toBeVisible();
  await expect(unit(page, 'Message queue')).toContainText('Backlog: 0');

  await expect(internet(page)).toBeVisible();

  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  // The wave brings more jobs than one Worker takes: the Backlog grows, and after the wave the Drain Phase starts.
  await expect(page.locator('.play-phase')).toContainText('Drain', { timeout: 20_000 });
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 25_000 });
  await expect(end).toContainText('Base defended');
});

test('mission 1: a Worker called straight from the app server is slow, and the hint says to put a queue in between', async ({ page }) => {
  await progressWith(page, chapterOne);
  await openLevel(page, MISSION, 'normal');
  await page.getByRole('button', { name: /Release to production/ }).click();
  await page.getByRole('button', { name: '4×' }).click();
  const end = page.getByRole('dialog');
  await expect(end).toBeVisible({ timeout: 30_000 });
  await expect(end).toContainText('Base lost');
  await expect(end).toContainText('Put a Message Queue in between');
});

test('finishing the last mission shows chapter 2 as complete on the campaign map', async ({ page }) => {
  const all = [...chapterOne, '09-slow-processing', '10-watch-and-upload', '11-upload-rush', '12-worker-goes-down', '13-fresh-videos', '14-launch-day'];
  await progressWith(page, all);
  await page.goto('/#levels');
  await expect(page.getByText('Chapter complete')).toHaveCount(2);
  await progressWith(page, all.slice(0, -1));
  await page.reload();
  await expect(page.getByText('Chapter complete')).toHaveCount(1);
});

test('the Manual: the Message queue and Worker entries are locked until their mission, and the Concepts tab explains async', async ({ page }) => {
  await progressWith(page, chapterOne.slice(0, 3));
  await page.goto('/#manual/buildings');
  await page.getByRole('button', { name: /Message queue/ }).click();
  await expect(page.getByRole('region', { name: /Message queue/ })).toContainText('Reach level 9 to unlock this building.');
  await page.goto('/#manual/concepts');
  for (const title of ['Async processing', 'Backlog and consumer lag', 'Queue Age', 'Load leveling', 'Competing consumers', 'At-least-once delivery and idempotency', 'Dead-letter queue', 'Autoscaling Workers']) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
});

test('the Manual: once the mission is reached, the Message queue and Worker entries say what they are in real life', async ({ page }) => {
  await progressWith(page, chapterOne);
  await page.goto('/#manual/buildings');
  await page.getByRole('button', { name: /Message queue/ }).click();
  await expect(page.getByText('Amazon SQS · RabbitMQ · Apache Kafka')).toBeVisible();
  await expect(page.getByText(/video file does not go in the queue/)).toBeVisible();
  await page.getByRole('button', { name: /Worker/ }).click();
  await expect(page.getByText('Celery · Sidekiq')).toBeVisible();
});
