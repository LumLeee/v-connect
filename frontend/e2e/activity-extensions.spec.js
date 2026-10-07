import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

test('Kỹ năng, ảnh bìa và bộ lọc kết hợp hoạt động', async ({ page, browser }, info) => {
  page.on('pageerror', error => { throw error })
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  const result = await page.request.post('/api/v1/auth/register/', {
    headers: { 'X-CSRFToken': csrfToken },
    data: { email: `extensions.${randomUUID()}@example.invalid`, full_name: 'Nhóm Kết Nối', role: 'organizer',
      password: 'River-Community-493!', password_confirm: 'River-Community-493!' },
  })
  expect(result.status()).toBe(201)
  const title = `Ngày xanh ${randomUUID()}`
  const day = `${new Date().getFullYear() + 1}-10-10`
  await page.goto('/nha-to-chuc/hoat-dong/tao')
  await page.getByLabel('Tên hoạt động', { exact: true }).fill(title)
  await page.getByLabel('Mô tả hoạt động').fill('Cùng chăm sóc cây xanh và chia sẻ kỹ năng với cộng đồng.')
  await page.getByLabel('Địa chỉ hoạt động').fill('Công viên Huế')
  await page.getByLabel('Thời gian bắt đầu').fill(`${day}T08:00`)
  await page.getByLabel('Thời gian kết thúc').fill(`${day}T12:00`)
  await page.getByLabel('Số lượng người cần tuyển').fill('20')
  await page.getByRole('checkbox', { name: 'Giao tiếp', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Tổ chức sự kiện', exact: true }).check()
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.locator('.activity-skill-tags')).toContainText('Giao tiếp')
  const id = new URL(page.url()).pathname.split('/').at(-1)
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 600
    const context = canvas.getContext('2d'); context.fillStyle = '#d9eee0'; context.fillRect(0, 0, 1200, 600)
    context.fillStyle = '#276650'; context.font = '60px sans-serif'; context.fillText('Ngày xanh cộng đồng', 150, 320)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.getByLabel('Chọn ảnh bìa hoạt động').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await expect(page.getByRole('img', { name: 'Ảnh bìa hoạt động' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Xóa ảnh bìa' })).toBeVisible()
  const guest = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    expect((await guest.request.get(`/api/v1/activities/${id}/cover/`)).status()).toBe(404)
    await page.getByRole('link', { name: 'Chỉnh sửa hoạt động' }).click()
    await expect(page.getByRole('checkbox', { name: 'Giao tiếp', exact: true })).toBeChecked()
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Công khai hoạt động', exact: true })).toHaveCount(0)
    const publicPage = await guest.newPage()
    await publicPage.goto('/hoat-dong')
    await publicPage.getByLabel('Tìm theo tên hoạt động').fill(title)
    await expect(publicPage.getByLabel('Trạng thái hoạt động')).toHaveCount(0)
    await publicPage.getByLabel('Ngày bắt đầu từ').fill(day)
    await publicPage.getByLabel('Ngày bắt đầu đến').fill(day)
    await publicPage.getByLabel('Địa điểm', { exact: true }).fill('Huế')
    await publicPage.getByLabel('Kỹ năng yêu cầu', { exact: true }).selectOption({ label: 'Giao tiếp' })
    await publicPage.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await expect(publicPage.locator('.activity-card')).toHaveCount(1)
    await expect(publicPage.getByRole('img', { name: 'Ảnh bìa hoạt động' })).toBeVisible()
    await publicPage.reload()
    await expect(publicPage.getByLabel('Kỹ năng yêu cầu', { exact: true })).toContainText('Giao tiếp')
    const skill = (await (await publicPage.request.get('/api/v1/skills/?page_size=100')).json()).results.find(item => item.name === 'Giao tiếp')
    await expect(publicPage.getByLabel('Kỹ năng yêu cầu', { exact: true })).toHaveValue(String(skill.id))
    for (const width of [320, 390, 768, 1280]) {
      await publicPage.setViewportSize({ width, height: 900 })
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await publicPage.setViewportSize(info.project.use.viewport)
    await publicPage.evaluate(() => window.scrollTo(0, 0))
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await publicPage.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-activity-extensions.png`), fullPage: true })
    await publicPage.getByLabel('Địa điểm', { exact: true }).fill('Không có địa điểm')
    await publicPage.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await expect(publicPage.locator('.activity-card')).toHaveCount(0)
    await publicPage.goBack()
    await expect(publicPage.getByLabel('Địa điểm', { exact: true })).toHaveValue('Huế')
    await expect(publicPage.locator('.activity-card')).toHaveCount(1)
    await publicPage.getByRole('link', { name: 'Xem chi tiết', exact: true }).click()
    await expect(publicPage.locator('.activity-skill-tags')).toContainText('Tổ chức sự kiện')
    await expect(publicPage.getByRole('img', { name: 'Ảnh bìa hoạt động' })).toBeVisible()
    await page.getByRole('button', { name: 'Xóa ảnh bìa' }).click()
    await expect(page.getByRole('img', { name: 'Ảnh bìa hoạt động' })).toHaveCount(0)
    await publicPage.reload()
    await expect(publicPage.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(publicPage.getByRole('img', { name: 'Ảnh bìa hoạt động' })).toHaveCount(0)
  } finally { await guest.close() }
})
