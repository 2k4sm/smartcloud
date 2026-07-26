import { test, expect } from '@playwright/test'

// Golden-path smoke tests that don't require an authenticated session. Deeper
// authenticated flows (create project → add secret → recompute risk → rotate)
// require seeded Supabase credentials via env and run in the full CI matrix.

test('health endpoint reports ok', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.status).toBe('ok')
})

test('landing page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})

test('login page renders a sign-in form', async ({ page }) => {
  await page.goto('/login')
  // Name the controls rather than asserting on "the button" — the page has
  // several (OAuth, reveal password, submit), so an unnamed role query is a
  // strict-mode violation regardless of the design.
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  // `exact` matters: the reveal toggle is labelled "Show password", which a
  // substring match would also pick up.
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
})

test('signup page is reachable', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('form')).toBeVisible()
})

test('unauthenticated dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
