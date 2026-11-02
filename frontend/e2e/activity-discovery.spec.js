import { test, expect } from '@playwright/test'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
}

test('Khám phá ẩn hoạt động đã bắt đầu, đã kết thúc hoặc đủ chỗ', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  const fixtures = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name]
  const activity = fixtures.upcoming.activity
  const details = await (await page.request.get(`/api/v1/activities/${activity}/`)).json()
  const list = await (await page.request.get('/api/v1/activities/?search=Hoạt%20động%20điểm%20danh')).json()
  expect(list.results.some(row => row.id === fixtures.ongoing.activity || row.id === fixtures.ended.activity || row.id === fixtures.feedback.activity)).toBe(false)
  const url = `/hoat-dong?search=${encodeURIComponent(details.title)}`
  await page.goto(url)
  await expect(page.getByRole('link', { name: details.title, exact: true })).toBeVisible()
  await expect(page.getByText('Chỉ hiển thị hoạt động Công khai còn mở đăng ký', { exact: false })).toBeVisible()
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    expect((await mutate(context.request, '/api/v1/auth/login/', {
      identifier: process.env.E2E_ATTENDANCE_ORGANIZER, password: process.env.E2E_ATTENDANCE_PASSWORD,
    })).status()).toBe(200)
    expect((await mutate(context.request, `/api/v1/organizer/activities/${activity}/`, { capacity: 1 }, 'patch')).status()).toBe(200)
    await page.reload()
    await expect(page.getByText('Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: details.title, exact: true })).toHaveCount(0)
    expect((await mutate(context.request, `/api/v1/organizer/activities/${activity}/`, { capacity: 2 }, 'patch')).status()).toBe(200)
    await page.reload()
    await expect(page.getByRole('link', { name: details.title, exact: true })).toBeVisible()
    await page.setExtraHTTPHeaders({ 'X-E2E-Time': new Date(+new Date(details.starts_at) + 60000).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY })
    await page.reload()
    await expect(page.getByText('Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.', { exact: true })).toBeVisible()
    expect((await page.request.get(`/api/v1/activities/${activity}/`)).status()).toBe(200)
  } finally { await context.close() }
})
