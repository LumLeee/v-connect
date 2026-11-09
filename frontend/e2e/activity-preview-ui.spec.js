import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const base = '/nha-to-chuc/hoat-dong'
const original = { id: 'preview-ui-activity', title: 'Hoạt động đang sửa', description: 'Mô tả ban đầu.', address: 'Huế',
  starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', capacity: 12, approved_count: 3,
  required_skills: ['communication'], skill_details: [{ id: 'communication', name: 'Giao tiếp' }], timeline: [],
  status: 'published', organizer_name: 'Nhóm cộng đồng', cover_url: '/preview-ui-cover.png' }

async function fixtures(page) {
  const state = { writes: 0 }
  page.on('pageerror', error => { throw error })
  await page.route('**/preview-ui-cover.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vFkAAAAASUVORK5CYII=', 'base64') }))
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    if (request.method() !== 'GET') state.writes++
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'preview-ui-owner', role: 'organizer', full_name: 'Nhóm cộng đồng', email: 'preview@example.invalid' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/skills/')) data = { count: 1, results: [{ id: 'communication', name: 'Giao tiếp' }], next: null, previous: null }
    else if (url.pathname.endsWith(`/activities/${original.id}/`)) data = original
    else throw new Error(`Unexpected preview request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Xem trước nội dung chưa lưu, đúng ảnh/kỹ năng/chương trình và không thực hiện ghi dữ liệu', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(`${base}/${original.id}/sua`)
  await page.getByLabel('Tên hoạt động', { exact: true }).fill('Kết nối số - Nội dung mới')
  await page.getByLabel('Mô tả hoạt động', { exact: true }).fill('Nội dung mới đang nhập trước khi lưu.')
  await page.getByLabel('Địa chỉ hoạt động', { exact: true }).fill('Sơn Trà, Đà Nẵng')
  await page.getByLabel('Số lượng người cần tuyển', { exact: true }).fill('20')
  for (const [index, title, start, end] of [[1, 'Thực hành', '14:30', '15:00'], [2, 'Đón tiếp', '14:00', '14:30']]) {
    await page.getByRole('button', { name: 'Thêm mốc chương trình', exact: true }).click()
    await page.getByLabel(`Tên mốc ${index}`, { exact: true }).fill(title)
    await page.getByLabel(`Bắt đầu mốc ${index}`, { exact: true }).fill(start)
    await page.getByLabel(`Kết thúc mốc ${index}`, { exact: true }).fill(end)
  }
  const previewButton = page.getByRole('button', { name: 'Xem trước', exact: true })
  await previewButton.click()
  const dialog = page.getByRole('dialog', { name: 'Xem trước hoạt động', exact: true })
  await expect(dialog.getByRole('heading', { name: 'Kết nối số - Nội dung mới', exact: true })).toBeVisible()
  await expect(dialog).toContainText('Nội dung mới đang nhập trước khi lưu.')
  await expect(dialog.getByText('Giao tiếp', { exact: true })).toBeVisible()
  await expect(dialog.locator('.activity-cover-image')).toHaveAttribute('src', original.cover_url)
  await expect(dialog.locator('.activity-logistics')).toContainText('Sơn Trà, Đà Nẵng')
  await expect(dialog.locator('.activity-logistics')).toContainText('20 người')
  await expect(dialog.locator('.activity-timeline h3')).toHaveText(['Đón tiếp', 'Thực hành'])
  await expect(dialog.getByRole('button', { name: 'Đăng ký tham gia', exact: true })).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/remaining-organizer-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-activity-preview.png`) })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(previewButton).toBeFocused()
  await expect(page.getByLabel('Tên mốc 1', { exact: true })).toHaveValue('Thực hành')
  await expect(page.getByLabel('Tên hoạt động', { exact: true })).toHaveValue('Kết nối số - Nội dung mới')
  await expect(page.locator('.om-editor-savebar')).toContainText('Có thay đổi chưa lưu')
  await previewButton.click()
  await dialog.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click()
  expect(state.writes).toBe(0)
  await expect(page).toHaveURL(`${base}/${original.id}/sua`)
})

test('Xem trước yêu cầu thông tin hợp lệ và giữ thanh lưu trên điện thoại', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(`${base}/tao`)
  await page.getByRole('button', { name: 'Xem trước', exact: true }).click()
  await expect(page.locator('.om-editor-errors')).toBeFocused()
  await expect(page.getByRole('heading', { name: 'Chưa thể xem trước hoạt động', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByRole('button', { name: 'Xem trước', exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Lưu bản nháp', exact: true })).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  expect(state.writes).toBe(0)
  await page.goto(`/hoat-dong/${original.id}`)
  await expect(page.getByRole('heading', { name: original.title, exact: true })).toBeVisible()
  await expect(page.getByText('Đăng ký tham gia dành cho tài khoản Tình nguyện viên.', { exact: true })).toBeVisible()
})
