import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}

async function account(request, role, name) {
  const result = await post(request, '/api/v1/auth/register/', { email: `join.${randomUUID()}@example.invalid`, full_name: name, role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
  expect(result.status()).toBe(201)
}

async function activity(request) {
  const starts = Date.now() + 7 * 86400000
  const result = await post(request, '/api/v1/organizer/activities/', { title: `Cùng trồng cây ${randomUUID()}`, description: 'Cộng đồng xanh',
    address: 'Huế', starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + 7200000).toISOString(), capacity: 1 })
  expect(result.status()).toBe(201)
  const data = await result.json()
  expect((await post(request, `/api/v1/organizer/activities/${data.id}/status/`, { status: 'published' })).status()).toBe(200)
  return data.id
}

test('Volunteer đăng ký, Organizer duyệt, hủy và đăng ký lại, từ chối không cho gửi lại', async ({ page, browser }, info) => {
  await account(page.request, 'organizer', 'Nhóm Xanh')
  const id = await activity(page.request)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    const volunteer = await context.newPage()
    volunteer.on('pageerror', error => { throw error })
    await volunteer.goto(`/hoat-dong/${id}`)
    await expect(volunteer.getByText('bằng tài khoản Tình nguyện viên để đăng ký tham gia.', { exact: false })).toBeVisible()
    await account(context.request, 'volunteer', 'Tình nguyện viên An')
    await volunteer.reload()
    await volunteer.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Chờ duyệt')
    await volunteer.getByRole('link', { name: 'Xem các đăng ký của tôi' }).click()
    await expect(volunteer.getByText('Trạng thái đơn:', { exact: false })).toContainText('Chờ duyệt')
    await page.goto(`/nha-to-chuc/hoat-dong/${id}`)
    await page.getByRole('link', { name: 'Xem danh sách đăng ký' }).click()
    await page.getByRole('button', { name: 'Duyệt', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận xét duyệt' }).click()
    await expect(page.getByText('Đã cập nhật kết quả xét duyệt.')).toBeVisible()
    await volunteer.goto(`/hoat-dong/${id}`)
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Được duyệt')
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-applicants.png`), fullPage: true })
    await volunteer.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-participation.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      for (const target of [page, volunteer]) {
        await target.setViewportSize({ width, height: 900 })
        expect(await target.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
      }
    }
    await volunteer.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
    await volunteer.getByRole('button', { name: 'Xác nhận hủy đăng ký' }).click()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Đã hủy đăng ký')
    await volunteer.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Chờ duyệt')
    await page.reload()
    await page.getByRole('button', { name: 'Từ chối', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận xét duyệt' }).click()
    await expect(page.getByText('Đã cập nhật kết quả xét duyệt.')).toBeVisible()
    await volunteer.reload()
    await expect(volunteer.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Bị từ chối')
    await expect(volunteer.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  } finally { await context.close() }
})

test('Thay đổi địa điểm và hủy hoạt động hiển thị đúng cho người đăng ký', async ({ page, browser }) => {
  await account(page.request, 'organizer', 'Tổ chức')
  const id = await activity(page.request)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    await account(context.request, 'volunteer', 'Người tham gia')
    expect((await post(context.request, `/api/v1/activities/${id}/participation/`, {})).status()).toBe(201)
    await page.goto(`/nha-to-chuc/hoat-dong/${id}/sua`)
    await page.getByLabel('Địa chỉ hoạt động').fill('Đà Nẵng')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Đà Nẵng', { exact: true })).toBeVisible()
    const volunteer = await context.newPage()
    await volunteer.goto(`/hoat-dong/${id}`)
    await expect(volunteer.getByText('Thời gian hoặc địa điểm đã thay đổi từ lúc bạn đăng ký.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Hủy hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByText('Hoạt động này đã bị hủy.', { exact: true })).toBeVisible()
    await volunteer.goto('/tinh-nguyen-vien/dang-ky')
    await expect(volunteer.getByText('Đơn bị hủy do hoạt động bị hủy.', { exact: true })).toBeVisible()
    expect((await post(context.request, `/api/v1/activities/${id}/participation/`, {})).status()).toBe(400)
  } finally { await context.close() }
})
