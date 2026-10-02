import { expect, test } from '@playwright/test';

const STUDENT = '64b000000000000000000001';
const SAMPLE = '64b000000000000000000101';
const cases = [
  'E2E-UC1-01',
  'E2E-UC1-02',
  'E2E-UC1-03',
  'E2E-UC2-01',
  'E2E-UC2-02',
  'E2E-UC3-01',
  'E2E-UC3-02',
  'E2E-UC3-03',
  'E2E-UC4-01',
  'E2E-UC4-02',
  'E2E-UC4-03',
  'E2E-UC5-01',
  'E2E-UC5-02',
  'E2E-UC5-03',
  'E2E-UC5-04',
  'E2E-UC6-01',
  'E2E-UC6-02',
  'E2E-UC6-03',
  'E2E-UC6-04',
  'E2E-UC7-01',
  'E2E-UC7-02',
  'E2E-UC7-03',
  'E2E-UC8-01',
  'E2E-UC8-02',
  'E2E-UC8-03',
  'E2E-UC9-01',
  'E2E-UC9-02',
  'E2E-UC9-03',
  'E2E-UC9-04',
];

async function withSession(page) {
  const response = await page.request.post('http://127.0.0.1:5000/api/auth/login', {
    data: { username: 'Synthetic@DAS', password: 'Pass@123' },
  });
  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  await page.addInitScript((value) => {
    window.localStorage.setItem('lexipath.session', JSON.stringify(value));
  }, session);
}

async function runCase(page, id) {
  const [, useCase, suffix] = id.match(/^E2E-(UC\d+)-(\d+)$/);
  const number = Number(suffix);

  if (useCase === 'UC1') {
    await withSession(page);
    await page.goto(`/students/${STUDENT}/upload`);
    await expect(page.getByRole('heading', { name: 'Synthetic Learner' })).toBeVisible();
    const analyse = page.getByText('Analyse sample', { exact: true });
    await expect(analyse).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyse sample' })).toHaveCount(0);
    if (number === 2) {
      await page.getByLabel('Sample title').fill('Synthetic browser upload');
      await expect(page.getByRole('button', { name: 'Analyse sample' })).toHaveCount(0);
    }
    if (number === 3) {
      await page.goto('/students/64b000000000000000000099/upload');
      await expect(page.getByRole('heading', { name: 'Student not found' })).toBeVisible();
    }
    return;
  }

  if (useCase === 'UC2') {
    await withSession(page);
    await page.goto(number === 2 ? '/samples/64b000000000000000000099' : `/samples/${SAMPLE}`);
    if (number === 2) {
      await expect(page.getByRole('heading', { name: 'Sample not found' })).toBeVisible();
    } else {
      await expect(page.getByText('becos', { exact: true })).toBeVisible();
      await expect(page.getByText(/Phonological/i).first()).toBeVisible();
    }
    return;
  }

  if (useCase === 'UC3') {
    await withSession(page);
    await page.goto(`/students/${STUDENT}/recommendations`);
    await expect(page.getByRole('heading', { name: 'Synthetic Learner' })).toBeVisible();
    await expect(page.getByText('Practise sound-to-letter mapping')).toBeVisible();
    if (number === 3) await expect(page.getByText(/Generated/)).toBeVisible();
    return;
  }

  if (useCase === 'UC4') {
    await withSession(page);
    await page.goto(`/students/${STUDENT}/trends`);
    await expect(page.getByRole('heading', { name: 'Synthetic Learner' })).toBeVisible();
    await expect(page.getByText('Most frequent category')).toBeVisible();
    if (number === 2) {
      await page.locator('#trend-range').selectOption('custom');
      await expect(page.locator('#trend-custom-from')).toBeVisible();
      await expect(page.locator('#trend-custom-to')).toBeVisible();
    }
    if (number === 3) await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
    return;
  }

  if (useCase === 'UC5') {
    await withSession(page);
    await page.goto(`/samples/${SAMPLE}`);
    await expect(page.getByText('becos', { exact: true })).toBeVisible();
    await expect(page.getByText(/Phonological/i).first()).toBeVisible();
    if (number === 2) await expect(page.getByText(/1 error/i).first()).toBeVisible();
    if (number === 3)
      await expect(page.getByRole('button', { name: /Mark review done/i })).toBeVisible();
    if (number === 4) await expect(page.getByText(/Add an error the AI missed/i)).toBeVisible();
    return;
  }

  if (useCase === 'UC6') {
    await withSession(page);
    await page.goto(`/students/${STUDENT}/recommendations`);
    await expect(page.getByRole('region', { name: 'Intervention strategies' })).toBeVisible();
    await expect(page.getByText('Grounded rationale', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Refresh recommendations/i })).toBeVisible();
    if (number === 4) await expect(page.getByText(/phonological/i).first()).toBeVisible();
    return;
  }

  if (useCase === 'UC7') {
    await page.goto(number === 3 ? `/samples/${SAMPLE}` : '/login');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Username').fill(number === 2 ? 'Unknown@DAS' : 'Synthetic@DAS');
    await page.getByLabel('Password').fill(number === 2 ? 'Wrong@123' : 'Pass@123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    if (number === 2) {
      await expect(page.getByText(/Incorrect username or password/i)).toBeVisible();
    } else if (number === 3) {
      await expect(page).toHaveURL(new RegExp(`/samples/${SAMPLE}$`));
    } else {
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText('Synthetic Educator').first()).toBeVisible();
    }
    return;
  }

  if (useCase === 'UC8') {
    await withSession(page);
    await page.goto('/account');
    await expect(page.getByRole('heading', { name: 'Synthetic Educator' })).toBeVisible();
    if (number === 2) {
      await page.getByRole('textbox', { name: 'New password', exact: true }).fill('weak');
      await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
    }
    if (number === 3) {
      await page.getByRole('textbox', { name: 'New password', exact: true }).fill('NewPass@456');
      await page
        .getByRole('textbox', { name: 'Confirm new password', exact: true })
        .fill('Different@456');
      await expect(page.getByText(/don’t match/i)).toBeVisible();
    }
    return;
  }

  const token = number === 1 ? 'unknown-token' : 'e2e-reset-token';
  await page.goto(`/reset-password/${token}`);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  if (number === 1) {
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('ValidPass@123');
    await page
      .getByRole('textbox', { name: 'Confirm new password', exact: true })
      .fill('ValidPass@123');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  } else if (number === 2) {
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('weak');
    await expect(page.getByRole('button', { name: 'Update password' })).toHaveCount(0);
  } else if (number === 3) {
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('ValidPass@123');
    await page
      .getByRole('textbox', { name: 'Confirm new password', exact: true })
      .fill('Different@123');
    await expect(page.getByText(/don’t match/i)).toBeVisible();
  } else {
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('ValidPass@123');
    await page
      .getByRole('textbox', { name: 'Confirm new password', exact: true })
      .fill('ValidPass@123');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  }
}

for (const id of cases) {
  test(`${id}: real browser, client, API, and isolated database`, async ({ page }) =>
    runCase(page, id));
}
