import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
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

test('Nhật ký nâng cao: bộ lọc kết hợp, chi tiết trước–sau, giữ bộ lọc và lỗi mạng', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const email = `audit.${randomUUID()}@example.invalid`
  expect((await mutate(page.request, '/api/v1/auth/register/', {
    email, full_name: 'Nhà tổ chức nhật ký', role: 'organizer', password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  })).status()).toBe(201)
  const start = new Date(Date.now() + 3 * 86400000)
  const created = await mutate(page.request, '/api/v1/organizer/activities/', {
    title: 'Chương trình ban đầu', description: 'Nội dung', address: 'Huế', capacity: 20,
    starts_at: start.toISOString(), ends_at: new Date(+start + 7200000).toISOString(),
  })
  expect(created.status()).toBe(201)
  const activity = await created.json()
  const title = `Chương trình đã cập nhật ${randomUUID().slice(0, 8)}`
  expect((await mutate(page.request, `/api/v1/organizer/activities/${activity.id}/`, {
    title, timeline: [{ title: 'Đón tiếp', description: 'Giới thiệu chương trình', starts_at: start.toISOString(), ends_at: new Date(+start + 3600000).toISOString() }],
  }, 'patch')).status()).toBe(200)
  expect((await page.request.get('/api/v1/admin/audit/')).status()).toBe(403)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    expect((await mutate(context.request, '/api/v1/auth/login/', { identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD })).status()).toBe(200)
    const admin = await context.newPage()
    admin.on('pageerror', error => { throw error })
    await admin.goto('/quan-tri/nhat-ky')
    await admin.getByLabel('Người thực hiện', { exact: true }).fill(email)
    await admin.getByLabel('Tên hoạt động', { exact: true }).fill(title)
    const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
    await admin.getByLabel('Từ ngày', { exact: true }).fill(day)
    await admin.getByLabel('Đến ngày', { exact: true }).fill(day)
    await admin.getByLabel('Loại thao tác', { exact: true }).selectOption('activity_updated')
    await expect(admin.locator('.ad-audit-row')).toHaveCount(1)
    await capture(admin, info, 'advanced-audit-list')
    const filteredUrl = admin.url()
    await admin.getByRole('link', { name: 'Xem chi tiết thao tác', exact: true }).click()
    await expect(admin.getByRole('heading', { name: 'Chi tiết thao tác', exact: true })).toBeVisible()
    await expect(admin.locator('.audit-changes')).toContainText('Chương trình ban đầu')
    await expect(admin.locator('.audit-changes')).toContainText(title)
    await expect(admin.locator('.audit-changes')).toContainText('Đón tiếp')
    await capture(admin, info, 'advanced-audit-detail')
    const detailUrl = admin.url()
    await admin.route('**/api/v1/admin/audit/*/', route => route.abort())
    await admin.reload()
    await expect(admin.getByRole('alert')).toContainText('Không kết nối được máy chủ')
    await admin.unroute('**/api/v1/admin/audit/*/')
    await admin.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(admin.locator('.audit-changes')).toContainText('Đón tiếp')
    await admin.getByRole('link', { name: '← Về nhật ký thao tác', exact: true }).click()
    await expect(admin).toHaveURL(filteredUrl)
    await expect(admin.getByLabel('Người thực hiện', { exact: true })).toHaveValue(email)
    await admin.getByLabel('Tên hoạt động', { exact: true }).fill(randomUUID())
    await admin.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
    await expect(admin.getByText('Chưa có thao tác phù hợp.', { exact: true })).toBeVisible()
    await admin.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
    await expect(admin.getByLabel('Người thực hiện', { exact: true })).toHaveValue('')
    await admin.getByLabel('Từ ngày', { exact: true }).fill(`${new Date().getFullYear() + 1}-12-31`)
    await admin.getByLabel('Đến ngày', { exact: true }).fill(day)
    await admin.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click()
    await expect(admin.getByRole('alert')).toContainText('Ngày kết thúc bộ lọc phải bằng hoặc sau ngày bắt đầu.')
    await expect(admin.locator('.ad-audit-row')).toHaveCount(0)
    const detailId = new URL(detailUrl).pathname.split('/').at(-1)
    expect((await page.request.get(`/api/v1/admin/audit/${detailId}/`)).status()).toBe(403)
  } finally { await context.close() }
})
