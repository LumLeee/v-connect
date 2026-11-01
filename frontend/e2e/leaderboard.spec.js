import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, identifier, password = process.env.E2E_ATTENDANCE_PASSWORD) {
  expect((await post(request, '/api/v1/auth/login/', { identifier, password })).status()).toBe(200)
}
async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `${name} ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Top 20, cấp bậc cá nhân, đồng hạng và cập nhật khi Nhà tổ chức sửa điểm', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const fixture = JSON.parse(process.env.E2E_LEADERBOARD_FIXTURES)[info.project.name]
  expect((await page.request.get('/api/v1/leaderboard/')).status()).toBe(401)
  await page.goto('/bang-xep-hang')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await login(page.request, fixture.email)
  await page.route('**/api/v1/leaderboard/', route => route.abort())
  await page.goto('/bang-xep-hang')
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await page.unroute('**/api/v1/leaderboard/')
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  const personal = page.getByRole('article', { name: 'Thứ hạng của tôi' })
  await expect(personal.getByRole('heading', { name: fixture.name, exact: true })).toBeVisible()
  await expect(personal).toContainText('20 điểm')
  await expect(personal.locator('.lb-level')).toHaveText('Đồng hành')
  await expect(page.locator('.lb-row')).toHaveCount(20)
  const data = await (await page.request.get('/api/v1/leaderboard/')).json()
  expect(Object.keys(data.results[0]).sort()).toEqual(['rank', 'full_name', 'avatar_url', 'total_score', 'level', 'is_me'].sort())
  expect(data.results.filter(row => row.total_score === 8).every(row => row.rank === data.results.find(other => other.total_score === 8).rank)).toBe(true)
  await capture(page, info, 'leaderboard-volunteer')
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await login(context.request, process.env.E2E_ATTENDANCE_ORGANIZER)
    expect((await post(context.request, `/api/v1/organizer/activities/${fixture.activity}/contributions/${fixture.attendance}/`, {
      score: 8, revision: 1, reason: 'Đối chiếu điểm xếp hạng',
    })).status()).toBe(200)
    await page.getByRole('button', { name: 'Cập nhật bảng xếp hạng', exact: true }).click()
    await expect(personal).toContainText('18 điểm')
    await expect(personal.locator('.lb-level')).toHaveText('Khởi đầu')
    await expect(personal).toContainText('Còn 2 điểm để đạt cấp Đồng hành.')
    const latest = await (await page.request.get('/api/v1/leaderboard/')).json()
    expect(latest.me.rank).toBeGreaterThan(1)
    await expect(personal).toContainText(`#${latest.me.rank}`)
    await page.reload()
    await expect(personal).toContainText('18 điểm')
  } finally { await context.close() }
})

test('Admin xem bảng trống; người chưa có điểm có cấp Khởi đầu và chưa xếp hạng', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  await login(page.request, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
  // The runner's guarded, per-request clock makes every seeded activity not yet ended.
  await page.setExtraHTTPHeaders({ 'X-E2E-Time': new Date(Date.now() - 5 * 86400000).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
  await page.goto('/bang-xep-hang')
  await expect(page.getByText('Chưa có tình nguyện viên có điểm đóng góp để xếp hạng.', { exact: false })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Thứ hạng của tôi' })).toHaveCount(0)
  await capture(page, info, 'leaderboard-empty')
  await page.setExtraHTTPHeaders({})
  await page.getByRole('button', { name: 'Cập nhật bảng xếp hạng', exact: true }).click()
  await expect(page.locator('.lb-row')).toHaveCount(20)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    await login(context.request, process.env.E2E_PENDING_VOLUNTEER)
    const volunteer = await context.newPage()
    await volunteer.goto('/bang-xep-hang')
    const personal = volunteer.getByRole('article', { name: 'Thứ hạng của tôi' })
    await expect(personal).toContainText('0 điểm')
    await expect(personal).toContainText('Chưa xếp hạng')
    await expect(personal.locator('.lb-level')).toHaveText('Khởi đầu')
    await capture(volunteer, info, 'leaderboard-new-volunteer')
  } finally { await context.close() }
})
