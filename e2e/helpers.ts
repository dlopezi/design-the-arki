import { expect, type Page } from '@playwright/test';

export const node = (page: Page, label: string, nth = 0) => page.locator('.react-flow__node', { hasText: label }).nth(nth);

/** Waits until the canvas stops reframing (it refits after components are added). */
export async function canvasSettled(page: Page) {
  const transform = () => page.locator('.react-flow__viewport').evaluate(el => (el as HTMLElement).style.transform);
  await expect.poll(async () => {
    const before = await transform();
    await page.waitForTimeout(100);
    return before === (await transform());
  }).toBe(true);
}

export async function connect(page: Page, from: { label: string; nth?: number }, to: { label: string; nth?: number }) {
  const edges = page.locator('.react-flow__edge');
  const before = await edges.count();
  await canvasSettled(page);
  await node(page, from.label, from.nth).locator('.react-flow__handle.source')
    .dragTo(node(page, to.label, to.nth).locator('.react-flow__handle.target'));
  await expect(edges).toHaveCount(before + 1);
}

export const hotbarButton = (page: Page, name: RegExp) => page.getByRole('toolbar', { name: 'Components' }).getByRole('button', { name });

/** Selects a component by clicking its title (a container's body is covered by its instances). */
export async function select(page: Page, label: string, nth = 0) {
  await node(page, label, nth).getByText(label, { exact: true }).click();
}
