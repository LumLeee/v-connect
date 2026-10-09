import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function register(request, role, name) {
  expect((await post(request, '/api/v1/auth/register/', {
    email: `matching.${randomUUID()}@example.invalid`, full_name: name, role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  })).status()).toBe(201)
}
async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Ghép nối hai chiều, tự nguyện xuất hiện và thu hồi quyền', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await page.goto('/tinh-nguyen-vien/ghep-noi')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await register(page.request, 'organizer', 'Nhà tổ chức ghép nối')
  const title = `Môi trường ${randomUUID()}`
  const starts = new Date(Date.now() + 3 * 86400000)
  const created = await post(page.request, '/api/v1/organizer/activities/', {
    title, description: 'Cùng bảo vệ môi trường', address: 'Huế', capacity: 20,
    starts_at: starts.toISOString(), ends_at: new Date(+starts + 3600000).toISOString(),
  })
  expect(created.status()).toBe(201)
  const body = await created.json()
  const id = body.id || body.activity?.id
  expect(id).toBeTruthy()
  expect((await post(page.request, `/api/v1/organizer/activities/${id}/status/`, { status: 'published' })).status()).toBe(200)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    const name = `Tình nguyện viên ${randomUUID().slice(0, 8)}`
    await register(context.request, 'volunteer', name)
    const volunteer = await context.newPage()
    volunteer.on('pageerror', error => { throw error })
    await volunteer.goto('/ho-so')
    const consent = volunteer.getByRole('checkbox', { name: 'Cho phép Nhà tổ chức tìm thấy tôi trong gợi ý', exact: true })
    await expect(consent).not.toBeChecked()
    await volunteer.getByLabel('Sở thích', { exact: true }).fill('Môi trường')
    await volunteer.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    await expect(volunteer.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/ghep-noi`)
    await expect(page.locator('.matching-card').filter({ hasText: name })).toHaveCount(0)
    await consent.check()
    await volunteer.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    await expect(volunteer.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cập nhật gợi ý', exact: true }).click()
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
    const response = await (await page.request.get(`/api/v1/organizer/activities/${id}/matching/`)).json()
    const candidate = response.results.find(row => row.volunteer.full_name === name)
    expect(Object.keys(candidate.volunteer).sort()).toEqual(['full_name', 'id'])
    expect(candidate.score).toBe(20)
    await capture(page, info, 'matching-organizer')
    await volunteer.route('**/api/v1/matching/activities/?*', route => route.abort())
    await volunteer.goto('/tinh-nguyen-vien/ghep-noi')
    await expect(volunteer.getByRole('alert')).toContainText('Không kết nối được máy chủ')
    await volunteer.unroute('**/api/v1/matching/activities/?*')
    await volunteer.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(volunteer.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await capture(volunteer, info, 'matching-volunteer')
    await volunteer.goto('/ho-so')
    await consent.uncheck()
    await volunteer.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    await expect(volunteer.getByText('Đã lưu hồ sơ của bạn.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Cập nhật gợi ý', exact: true }).click()
    await expect(page.getByRole('heading', { name, exact: true })).toHaveCount(0)
  } finally { await context.close() }
})
