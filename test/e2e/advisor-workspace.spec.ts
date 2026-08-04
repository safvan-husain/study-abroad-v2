import { expect, test } from '@playwright/test';

test('specialist discovery is complete, non-shortlisting, and preserves browser history', async ({ page }) => {
  test.setTimeout(120_000);
  const transcriptRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/conversations\/.*\/(messages|turns)/.test(request.url())) transcriptRequests.push(request.url());
  });

  await page.goto('/workspace');
  await expect(page.getByRole('main', { name: 'Study planning workspace' })).toBeVisible();
  await expect(page.getByText('Tell me about your background and interests.')).toBeVisible();
  await expect(page.getByText('Explore', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Discovery', { exact: true })).toHaveCount(0);

  const composer = page.getByLabel('Message your advisor');
  await expect(composer).toBeEnabled({ timeout: 20_000 });
  await composer.fill('I want computer science');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('I want computer science')).toBeVisible();
  // An interest statement opens every reviewed nearby course type and does not shortlist.
  await expect(page.getByRole('heading', { name: 'Course types in this area' })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('5 course matches ready', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Provisional course selection' })).toHaveCount(0);

  // Independent course-type cards remain permanent actions without stealing focus.
  const openFamily = page.getByRole('button', { name: 'Open course type' }).first();
  await expect(openFamily).toBeVisible({ timeout: 90_000 });
  const familyLabel = await openFamily.locator('xpath=..').locator('strong').textContent().catch(() => null);
  await openFamily.click();
  await expect(page.locator('.breadcrumb')).toHaveText('YOUR JOURNEY / EXPLORE / COURSE TYPE');
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  if (familyLabel) await expect(page.getByText(familyLabel, { exact: true }).first()).toBeVisible();

  // Back returns to the overview, then the prior home workspace, while actions remain.
  await page.goBack();
  await expect(page.locator('.breadcrumb')).toHaveText('YOUR JOURNEY / EXPLORE');
  await expect(page.getByRole('heading', { name: 'Course types in this area' })).toBeVisible();
  await page.goBack();
  await expect(page.getByText('Ready to explore')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open again' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open course type' }).first()).toBeVisible();
  expect(transcriptRequests).toEqual([]);
});
