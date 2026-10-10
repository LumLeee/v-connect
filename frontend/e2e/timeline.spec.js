import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

test('Chương trình: tạo, sửa, kiểm tra lịch, công khai và xóa mốc', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  expect((await page.request.post('/api/v1/auth/register/', { headers: { 'X-CSRFToken': csrfToken }, data: {
    full_name: 'Tổ chức chương trình', role: 'organizer', email: `timeline.${randomUUID()}@example.invalid`,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  } })).status()).toBe(201)
  const day = `${new Date().getFullYear() + 1}-10-10`
  const title = `Ngày cộng đồng ${randomUUID()}`
  await page.goto('/nha-to-chuc/hoat-dong/tao')
  await page.getByLabel('Tên hoạt động', { exact: true }).fill(title)
  await page.getByLabel('Mô tả hoạt động').fill('Chương trình cộng đồng với các hoạt động chia sẻ.')
  await page.getByLabel('Địa chỉ hoạt động').fill('Huế')
  await page.getByLabel('Thời gian bắt đầu', { exact: true }).fill(`${day}T08:00`)
  await page.getByLabel('Thời gian kết thúc', { exact: true }).fill(`${day}T12:00`)
  for (const [index, name, start, end] of [[1, 'Chia sẻ kỹ năng', '10:00', '11:00'], [2, 'Đón tiếp', '08:00', '09:00']]) {
    await page.getByRole('button', { name: 'Thêm mốc chương trình' }).click()
    await page.getByLabel(`Tên mốc ${index}`, { exact: true }).fill(name)
    await page.getByLabel(`Bắt đầu mốc ${index}`, { exact: true }).fill(`${day}T${start}`)
    await page.getByLabel(`Kết thúc mốc ${index}`, { exact: true }).fill(`${day}T${end}`)
    await page.getByLabel(`Mô tả mốc ${index}`, { exact: true }).fill('Gặp gỡ và trao đổi cùng cộng đồng.')
  }
  await page.getByRole('button', { name: 'Lưu bản nháp', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await expect(page.locator('.activity-timeline h3')).toHaveText(['Đón tiếp', 'Chia sẻ kỹ năng'])
  const id = new URL(page.url()).pathname.split('/').at(-1)
  await page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true }).click()
  await page.getByLabel('Kết thúc mốc 2', { exact: true }).fill(`${day}T13:00`)
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page.getByText('Tất cả mốc chương trình phải nằm trong thời gian hoạt động. Hãy điều chỉnh các mốc khi đổi lịch.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Tên mốc 2', { exact: true })).toHaveValue('Chia sẻ kỹ năng')
  await page.getByLabel('Kết thúc mốc 2', { exact: true }).fill(`${day}T11:30`)
  await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Công khai hoạt động', exact: true })).toHaveCount(0)
  const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    const guest = await context.newPage()
    await guest.goto(`/hoat-dong/${id}`)
    await expect(guest.locator('.activity-timeline h3')).toHaveText(['Đón tiếp', 'Chia sẻ kỹ năng'])
    await expect(guest.getByRole('button', { name: 'Thêm mốc chương trình' })).toHaveCount(0)
    for (const width of [320, 390, 768, 1280]) {
      await guest.setViewportSize({ width, height: 900 })
      expect(await guest.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await guest.setViewportSize(info.project.use.viewport)
    await guest.evaluate(() => window.scrollTo(0, 0))
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await guest.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-timeline.png`), fullPage: true })
    await page.getByRole('link', { name: 'Chỉnh sửa hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xóa mốc 2', exact: true }).click()
    await page.getByRole('button', { name: 'Xóa mốc 1', exact: true }).click()
    await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
    await expect(page.getByText('Nhà tổ chức chưa cập nhật chương trình chi tiết.', { exact: true })).toBeVisible()
    await guest.reload()
    await expect(guest.locator('.activity-timeline li')).toHaveCount(0)
  } finally { await context.close() }
})
