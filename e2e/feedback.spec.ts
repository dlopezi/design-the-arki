import { expect, test } from '@playwright/test';
import { WEB3FORMS_KEY } from '../src/feedback/feedback';

test('a player sends Feedback from the title screen', async ({ page }) => {
  test.skip(!WEB3FORMS_KEY, 'needs the Web3Forms access key in src/feedback/feedback.ts');
  const bodies: Record<string, string>[] = [];
  await page.route('https://api.web3forms.com/submit', async route => {
    bodies.push(route.request().postDataJSON() as Record<string, string>);
    await route.fulfill({ json: { success: true } });
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /Feedback/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Feedback' });
  await dialog.getByRole('textbox', { name: 'Your message' }).fill('The cache level is great');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Thanks! Your message was sent.');
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ message: 'The cache level is great', level: 'none', language: 'en' });
  expect(bodies[0]!.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test('a too short message is not sent', async ({ page }) => {
  let requests = 0;
  await page.route('https://api.web3forms.com/submit', route => { requests++; return route.fulfill({ json: { success: true } }); });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main menu' }).getByRole('button', { name: /Feedback/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Feedback' });
  await dialog.getByRole('textbox', { name: 'Your message' }).fill('hi');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Write at least 5 characters.');
  expect(requests).toBe(0);
});

test('the player switches the game to Spanish and the choice is kept', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'ES' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mira cómo se rompe tu sistema.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Menú principal' }).getByRole('link', { name: /Jugar nivel 1/ })).toBeVisible();
  await page.goto('/#01-hello-world/guided');
  await expect(page.getByRole('heading', { name: 'Hola, mundo' })).toBeVisible();
});

test('the title footer links to the release, the code and shows the ©', async ({ page }) => {
  await page.goto('/');
  const foot = page.getByRole('contentinfo');
  await expect(foot.getByRole('link', { name: /^Release notes for v\d+\.\d+\.\d+$/ })).toHaveAttribute('href', /github\.com\/dlopezi\/design-the-arki\/releases\/tag\/v\d/);
  await expect(foot.getByRole('link', { name: 'GitHub ↗' })).toHaveAttribute('href', 'https://github.com/dlopezi/design-the-arki');
  await expect(foot).toContainText('© 2026 thearki');
});
