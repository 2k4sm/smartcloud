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
  await expect(page.getByRole('button')).toBeVisible()
  await expect(page.locator('input[type="email"], input[type="password"]').first()).toBeVisible()
})

test('signup page is reachable', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.locator('form')).toBeVisible()
})

test('unauthenticated dashboard redirects to login', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
})
