import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function register(request, role, name) {
  const response = await mutate(request, '/api/v1/auth/register/', {
    email: `invitation.${randomUUID()}@example.invalid`, full_name: name, role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  })
  expect(response.status()).toBe(201)
}
async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
}

test('Nhà tổ chức gửi lời mời, Tình nguyện viên xác nhận và được tự động duyệt', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await page.goto('/tinh-nguyen-vien/loi-moi')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await register(page.request, 'organizer', 'Nhà tổ chức lời mời')
  const title = `Môi trường ${randomUUID()}`
  const starts = new Date(Date.now() + 3 * 86400000)
  const created = await mutate(page.request, '/api/v1/organizer/activities/', {
    title, description: 'Bảo vệ môi trường', address: 'Huế', capacity: 1,
    starts_at: starts.toISOString(), ends_at: new Date(+starts + 3600000).toISOString(),
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  expect((await mutate(page.request, `/api/v1/organizer/activities/${id}/status/`, { status: 'published' })).status()).toBe(200)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    const name = `Người nhận ${randomUUID().slice(0, 8)}`
    await register(context.request, 'volunteer', name)
    expect((await mutate(context.request, '/api/v1/auth/profile/', {
      volunteer: { skills: [], interests: ['Môi trường'], availability: [], matching_visible: true },
    }, 'patch')).status()).toBe(200)
    const volunteer = await context.newPage()
    volunteer.on('pageerror', error => { throw error })
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/ghep-noi`)
    const card = page.locator('.matching-card').filter({ hasText: name })
    await card.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
    const invitationDialog = page.getByRole('dialog', { name: 'Xác nhận gửi lời mời', exact: true })
    await invitationDialog.getByLabel('Lời nhắn (không bắt buộc)').fill('Mời bạn đồng hành cùng chương trình.')
    await invitationDialog.getByRole('button', { name: 'Xác nhận gửi lời mời', exact: true }).click()
    await expect(card.getByRole('status')).toHaveText('Đã gửi lời mời')
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/loi-moi`)
    await expect(page.getByText('Chờ phản hồi', { exact: true })).toBeVisible()
    await capture(page, info, 'invitations-organizer')
    await volunteer.route('**/api/v1/invitations/?*', route => route.abort())
    await volunteer.goto('/tinh-nguyen-vien/loi-moi')
    await expect(volunteer.getByRole('alert')).toContainText('Không kết nối được máy chủ')
    await volunteer.unroute('**/api/v1/invitations/?*')
    await volunteer.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(volunteer.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(volunteer.getByText('Lời nhắn: Mời bạn đồng hành cùng chương trình.', { exact: true })).toBeVisible()
    await capture(volunteer, info, 'invitations-volunteer')
    await volunteer.getByRole('button', { name: 'Chấp nhận lời mời', exact: true }).click()
    await volunteer.getByRole('button', { name: 'Xác nhận tham gia', exact: true }).click()
    await expect(volunteer.getByText('Đã xác nhận tham gia. Đăng ký của bạn đã được tự động duyệt.', { exact: true })).toBeVisible()
    await expect(volunteer.locator('.invitation-row .vi-status')).toHaveText('Đã chấp nhận')
    const entries = await (await context.request.get('/api/v1/participations/')).json()
    expect(entries.results.find(row => row.activity.id === id).status).toBe('approved')
    await volunteer.reload()
    await expect(volunteer.locator('.invitation-row .vi-status')).toHaveText('Đã chấp nhận')
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(page.getByText('Đã chấp nhận', { exact: true })).toBeVisible()
  } finally { await context.close() }
})

test('Từ chối và thu hồi lời mời không tạo đăng ký', async ({ page, browser }) => {
  test.setTimeout(120000)
  await register(page.request, 'organizer', 'Nhà tổ chức thu hồi')
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await register(context.request, 'volunteer', 'Người nhận lời mời')
    expect((await mutate(context.request, '/api/v1/auth/profile/', {
      volunteer: { skills: [], interests: [], availability: [], matching_visible: true },
    }, 'patch')).status()).toBe(200)
    const { user } = await (await context.request.get('/api/v1/auth/me/')).json()
    const ids = []
    for (const title of ['Lời mời từ chối', 'Lời mời thu hồi']) {
      const start = new Date(Date.now() + 4 * 86400000)
      const response = await mutate(page.request, '/api/v1/organizer/activities/', {
        title, description: 'Cộng đồng', address: 'Huế', capacity: 2,
        starts_at: start.toISOString(), ends_at: new Date(+start + 3600000).toISOString(),
      })
      expect(response.status()).toBe(201)
      const { id } = await response.json()
      ids.push(id)
      expect((await mutate(page.request, `/api/v1/organizer/activities/${id}/status/`, { status: 'published' })).status()).toBe(200)
      expect((await mutate(page.request, `/api/v1/organizer/activities/${id}/invitations/`, { volunteer: user.id })).status()).toBe(201)
    }
    const volunteer = await context.newPage()
    await volunteer.goto('/tinh-nguyen-vien/loi-moi')
    const decline = volunteer.locator('.activity-card').filter({ has: volunteer.getByRole('heading', { name: 'Lời mời từ chối', exact: true }) })
    await decline.getByRole('button', { name: 'Từ chối lời mời', exact: true }).click()
    await volunteer.getByRole('button', { name: 'Xác nhận từ chối', exact: true }).click()
    await expect(decline.locator('.vi-status')).toHaveText('Đã từ chối')
    await page.goto(`/nha-to-chuc/hoat-dong/${ids[1]}/loi-moi`)
    await page.getByRole('button', { name: 'Thu hồi lời mời', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận thu hồi', exact: true }).click()
    await expect(page.getByText('Đã thu hồi', { exact: true })).toBeVisible()
    await volunteer.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(volunteer.locator('.invitation-row').filter({ hasText: 'Lời mời thu hồi' }).locator('.vi-status')).toHaveText('Đã thu hồi')
    expect((await (await context.request.get('/api/v1/participations/')).json()).count).toBe(0)
  } finally { await context.close() }
})
