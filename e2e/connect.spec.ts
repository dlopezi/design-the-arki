import { expect, test } from '@playwright/test';
import { hotbarButton, node, openLevel, playAndSkip, select } from './helpers';

const sendsTo = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Inspector' }).getByRole('group', { name: 'Sends requests to' });

test('a component can be connected from the inspector, without dragging', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'guided');
  const edges = page.locator('.react-flow__edge');
  await expect(edges).toHaveCount(1);

  await select(page, 'App server');
  await expect(sendsTo(page).getByRole('radio', { name: 'None' })).toBeChecked();
  await sendsTo(page).getByRole('radio', { name: 'Database' }).check();
  await expect(edges).toHaveCount(2);
  await expect(sendsTo(page).getByRole('radio', { name: 'Database' })).toBeChecked();

  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to design' }).click();

  await select(page, 'App server');
  await sendsTo(page).getByRole('radio', { name: 'None' }).check();
  await expect(edges).toHaveCount(1);
});

test('the clients can be connected from the inspector too, and a database sends nowhere', async ({ page }) => {
  await openLevel(page, '01-hello-world', 'god');
  await hotbarButton(page, /App server/).click();
  await hotbarButton(page, /Database/).click();

  await node(page, 'Clients').getByText('Clients', { exact: true }).click();
  const inspector = page.getByRole('complementary', { name: 'Inspector' });
  await expect(inspector.getByRole('heading', { name: 'Clients' })).toBeVisible();
  await expect(sendsTo(page).getByRole('radio')).toHaveCount(3);
  await sendsTo(page).getByRole('radio', { name: 'App server' }).check();

  await select(page, 'App server');
  await sendsTo(page).getByRole('radio', { name: 'Database' }).check();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await select(page, 'Database');
  await expect(sendsTo(page)).toHaveCount(0);

  await playAndSkip(page);
  await expect(page.getByRole('dialog', { name: 'Level passed' })).toBeVisible();
});
