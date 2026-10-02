import { expect, test } from '@playwright/test';

test('sign up from the login page, land signed in, then sign back in', async ({ page }) => {
  const username = `Signup${Date.now()}@DAS`;
  const password = 'Signup@123';

  await page.goto('/login');
  await page.getByRole('link', { name: 'New to LexiPath? Create an account' }).click();
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill('signup@example.com');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill('Different@123');
  await expect(page.getByText('Passwords don’t match.')).toBeVisible();
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The same username can't be registered twice.
  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill('signup@example.com');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('That username is taken')).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/$/);
});
