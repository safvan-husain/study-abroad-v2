import { expect, test } from '@playwright/test';

test('agent navigation is safe, permanent, and preserves browser history', async ({ page }) => {
  test.setTimeout(120_000);
  const transcriptRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/.*\/(messages|turns)/.test(request.url())) transcriptRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Study planning workspace' })).toBeVisible();
  await expect(page.getByText('Tell me about your background and interests.')).toBeVisible();

  const composer = page.getByLabel('Message your advisor');
  await expect(composer).toBeEnabled({ timeout: 20_000 });
  await composer.fill('I am interested in programming and want help getting started.');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('I am interested in programming and want help getting started.')).toBeVisible();
  // The catalogue action safely auto-applies because the originating tab is unchanged.
  await expect(page.getByRole('heading', { name: 'Course matches for you' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('5 course matches ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();

  // Independent summaries finish after the first navigation revision and therefore
  // remain offered instead of repeatedly stealing focus.
  const openSummary = page.getByRole('button', { name: 'Open summary' }).first();
  await expect(openSummary).toBeVisible({ timeout: 90_000 });
  const summaryLabel = await openSummary.locator('xpath=..').locator('strong').textContent().catch(() => null);
  await openSummary.click();
  await expect(page.locator('.breadcrumb')).toHaveText('YOUR JOURNEY / EXPLORE / COURSE SUMMARY');
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  if (summaryLabel) await expect(page.getByText(summaryLabel, { exact: true }).first()).toBeVisible();

  // Back returns to the catalogue, then the prior home workspace, while cards remain.
  await page.goBack();
  await expect(page.locator('.breadcrumb')).toHaveText('YOUR JOURNEY / EXPLORE');
  await expect(page.getByRole('heading', { name: 'Course matches for you' })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Your workspace is ready')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open summary' }).first()).toBeVisible();
  expect(transcriptRequests).toEqual([]);
});
