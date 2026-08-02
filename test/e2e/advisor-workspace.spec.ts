import { expect, test } from '@playwright/test';

test('direct advisor turn publishes transcript and independent workspace results', async ({ page }) => {
  const transcriptRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/.*\/(messages|turns)/.test(request.url())) transcriptRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Study planning workspace' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Study advisor' })).toBeVisible();
  const composer = page.getByLabel('Message your advisor');
  await expect(composer).toBeEnabled({ timeout: 20_000 });
  await composer.fill('I am interested in software engineering and want help getting started.');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('I am interested in software engineering and want help getting started.')).toBeVisible();
  await expect(page.getByText(/opened a planning space/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Academic starting point' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Study ambition' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('completed', { exact: true })).toBeVisible();
  expect(transcriptRequests).toEqual([]);
});
