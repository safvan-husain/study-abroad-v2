import { expect, test } from '@playwright/test';

test('direct advisor turn publishes progressive search and independent course fits', async ({ page }) => {
  test.setTimeout(90_000);
  const transcriptRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/.*\/(messages|turns)/.test(request.url())) transcriptRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Study planning workspace' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Study advisor' })).toBeVisible();
  await expect(page.getByText('Tell me about your background and interests.')).toBeVisible();
  await expect(page.getByText('TRY ASKING')).toHaveCount(0);

  const composer = page.getByLabel('Message your advisor');
  await expect(composer).toBeEnabled({ timeout: 20_000 });
  await composer.fill('I am interested in programming and want help getting started.');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('I am interested in programming and want help getting started.')).toBeVisible();
  await expect(page.getByText('Your workspace is ready')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Course matches for you' })).toHaveCount(0);
  const openSummary = page.getByRole('button', { name: 'Open summary' }).first();
  await expect(openSummary).toBeVisible({ timeout: 60_000 });
  await openSummary.click();
  await expect(page.getByRole('heading', { name: 'Course matches for you' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Showing courses related to/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Computer Science|Computer Systems|indicative fit/i).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('complementary', { name: 'Study advisor' }).getByText(/Computer Science|indicative fit/i)).toHaveCount(0);

  await page.goBack();
  await expect(page.getByText('Your workspace is ready')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  expect(transcriptRequests).toEqual([]);
});
