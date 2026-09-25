import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data = {}) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, email) {
  const response = await post(request, '/api/v1/auth/login/', { identifier: email, password: process.env.E2E_ATTENDANCE_PASSWORD })
  expect(response.status()).toBe(200)
}

test('Điểm danh một lần, Volunteer xem lịch sử và giữ bản ghi khi hoạt động bị hủy', async ({ page, browser }, info) => {
  page.on('pageerror', error => { throw error })
  const fixture = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].ongoing
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  await page.goto(`/nha-to-chuc/hoat-dong/${fixture.activity}`)
  await page.getByRole('link', { name: 'Điểm danh người tham gia', exact: true }).click()
  await expect(page.getByText('Người chưa được duyệt', { exact: true })).toHaveCount(0)
  await expect(page.getByText('1 người trong danh sách.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ghi nhận có mặt', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận có mặt', exact: true }).click()
  await expect(page.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ghi nhận có mặt', exact: true })).toHaveCount(0)
  const retry = await post(page.request, `/api/v1/organizer/activities/${fixture.activity}/attendance/${fixture.entry}/`)
  expect(retry.status()).toBe(200)
  const original = await retry.json()
  await page.reload()
  await expect(page.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    await login(context.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
    const volunteer = await context.newPage()
    volunteer.on('pageerror', error => { throw error })
    await volunteer.goto('/tinh-nguyen-vien')
    await volunteer.getByRole('link', { name: 'Lịch sử tham gia', exact: true }).click()
    const card = volunteer.locator('article').filter({ has: volunteer.getByRole('link', { name: `Hoạt động điểm danh ongoing ${info.project.name}`, exact: true }) })
    await expect(card.getByText('Đã xác nhận có mặt', { exact: true })).toBeVisible()
    await expect(card.getByText('Người xác nhận: Nhà tổ chức điểm danh', { exact: true })).toBeVisible()
    for (const target of [page, volunteer]) {
      for (const width of [320, 390, 768, 1280]) {
        await target.setViewportSize({ width, height: 900 })
        expect(await target.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
      }
      await target.setViewportSize(info.project.use.viewport)
    }
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-attendance.png`), fullPage: true })
    await volunteer.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-history.png`), fullPage: true })
    expect((await post(page.request, `/api/v1/organizer/activities/${fixture.activity}/status/`, { status: 'cancelled' })).status()).toBe(200)
    await volunteer.reload()
    await expect(card.getByText('Hoạt động đã bị hủy sau khi ghi nhận có mặt. Bản ghi được giữ để đối chiếu.', { exact: true })).toBeVisible()
    const history = await (await context.request.get('/api/v1/participations/history/')).json()
    expect(history.results.find(entry => entry.id === fixture.entry).attendance).toEqual(original)
    expect((await post(context.request, `/api/v1/organizer/activities/${fixture.activity}/attendance/${fixture.entry}/`)).status()).toBe(403)
  } finally { await context.close() }
})

test('Không điểm danh trước giờ bắt đầu hoặc sau giờ kết thúc', async ({ page }, info) => {
  await login(page.request, process.env.E2E_ATTENDANCE_ORGANIZER)
  const fixtures = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name]
  for (const state of ['upcoming', 'ended']) {
    const fixture = fixtures[state]
    await page.goto(`/nha-to-chuc/hoat-dong/${fixture.activity}/diem-danh`)
    await expect(page.getByRole('button', { name: 'Ghi nhận có mặt', exact: true })).toBeDisabled()
    expect((await post(page.request, `/api/v1/organizer/activities/${fixture.activity}/attendance/${fixture.entry}/`)).status()).toBe(400)
    await expect(page.getByText('Chưa ghi nhận có mặt', { exact: true })).toBeVisible()
  }
})
