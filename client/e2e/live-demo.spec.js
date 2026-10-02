import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const USERNAME = 'LiveDemo@DAS';
const ORIGINAL_PASSWORD = 'LiveDemo@123';
const UPDATED_PASSWORD = 'LiveDemo@456';
const API_URL = 'http://127.0.0.1:5001';
const CLEANUP_TOKEN = 'lexipath-live-demo-ephemeral-secret';

test.afterAll(async ({ request }) => {
  const response = await request.delete(`${API_URL}/api/live-demo/cleanup`, {
    headers: { 'x-live-demo-cleanup': CLEANUP_TOKEN },
  });
  expect(response.status()).toBe(204);
});

async function signIn(page, password) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(USERNAME);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function changePassword(page, currentPassword, newPassword) {
  await page.goto('/account');
  await page.getByLabel('Current password').fill(currentPassword);
  await page.getByLabel('New password', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated.', { exact: true })).toBeVisible();
}

test('live demo: Gemini analysis feeds trends, recommendations, and password persistence', async ({
  page,
}, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.setContent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="500">
      <rect width="100%" height="100%" fill="white"/>
      <text x="55" y="110" font-family="cursive" font-size="42" fill="black">
        Yesterday i goed to the park becos my frend was there.
      </text>
      <text x="55" y="190" font-family="cursive" font-size="42" fill="black">
        We dont recieve many chances to play together
      </text>
    </svg>
  `);
  const uploadPath = testInfo.outputPath('synthetic-writing.png');
  await page.locator('svg').screenshot({ path: uploadPath });
  const uploadBuffer = await fs.readFile(uploadPath);

  await signIn(page, ORIGINAL_PASSWORD);
  await page.getByRole('link', { name: /Live Demo Learner/ }).click();
  await page.getByRole('link', { name: 'Upload writing sample' }).click();
  await page.locator('.dropzone').evaluate(
    (dropzone, base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], 'synthetic-writing.png', { type: 'image/png' }));
      dropzone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    },
    uploadBuffer.toString('base64')
  );
  await expect.poll(() => pageErrors.map((error) => error.message)).toEqual([]);
  await expect(page.getByText('synthetic-writing.png', { exact: true })).toBeVisible();
  await page.getByLabel('Sample title').fill('Live Gemini synthetic writing');
  await page.getByRole('button', { name: 'Analyse sample' }).click();

  await expect(page.getByRole('heading', { name: 'Sample uploaded & analysed' })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole('link', { name: 'Open error report' }).click();
  await expect(page.getByText(/\d+ errors? tagged/)).toBeVisible();
  await expect(page.getByText(/analysed/i).first()).toBeVisible();

  await page.goto('/students/64b000000000000000000201/trends');
  await expect(page.getByRole('heading', { name: 'Live Demo Learner' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trend summary' })).toContainText(
    'Samples included2'
  );
  await expect(page.getByRole('heading', { name: 'Errors by category over time' })).toBeVisible();
  await expect(page.getByLabel('Category totals in the selected range')).toBeVisible();

  await page.getByRole('link', { name: 'View recommendations' }).click();
  await page.getByRole('button', { name: 'Generate recommendations' }).first().click();
  const strategies = page.getByRole('region', { name: 'Intervention strategies' });
  await expect(strategies).toBeVisible({ timeout: 120_000 });
  await expect(strategies.getByText(/Strategy 1/)).toBeVisible();
  await expect(strategies.getByText('Reviewed evidence', { exact: true }).first()).toBeVisible();
  await expect(strategies.getByText(/Suggested pages: \d+–\d+/).first()).toBeVisible();
  await expect(strategies.getByRole('link', { name: 'Open worksheet PDF' }).first()).toBeVisible();

  await changePassword(page, ORIGINAL_PASSWORD, UPDATED_PASSWORD);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, UPDATED_PASSWORD);
  await expect(page.getByText('Live Demo Educator').first()).toBeVisible();

  await changePassword(page, UPDATED_PASSWORD, ORIGINAL_PASSWORD);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, ORIGINAL_PASSWORD);
});