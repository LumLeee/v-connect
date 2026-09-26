import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function register(page, role = 'organizer') {
  const { csrfToken } = await (await page.request.get('/api/v1/auth/csrf/')).json()
  const result = await page.request.post('/api/v1/auth/register/', {
    headers: { 'X-CSRFToken': csrfToken },
    data: { email: `activity.${randomUUID()}@example.invalid`, full_name: 'Nhà tổ chức kiểm thử', role,
      password: 'River-Community-493!', password_confirm: 'River-Community-493!' },
  })
  expect(result.status()).toBe(201)
}

test('Organizer tạo, sửa, công khai, khách tìm xem và hủy hoạt động', async ({ page, browser }, info) => {
  page.on('pageerror', error => { throw error })
  await register(page)
  const title = `Trồng cây ${randomUUID()}`
  const year = new Date().getFullYear() + 1
  await page.goto('/nha-to-chuc')
  await page.getByRole('link', { name: 'Quản lý hoạt động', exact: true }).click()
  await page.getByRole('link', { name: 'Tạo hoạt động', exact: true }).click()
  await page.getByLabel('Tên hoạt động', { exact: true }).fill(title)
  await page.getByLabel('Mô tả hoạt động').fill('Cùng trồng cây và chăm sóc cộng đồng 🌱')
  await page.getByLabel('Địa chỉ hoạt động').fill('Công viên Đà Nẵng')
  await page.getByLabel('Thời gian bắt đầu').fill(`${year}-10-10T08:00`)
  await page.getByLabel('Thời gian kết thúc').fill(`${year}-10-10T07:00`)
  await page.getByLabel('Số lượng người cần tuyển').fill('20')
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click()
  await expect(page.getByText('Thời gian kết thúc phải sau thời gian bắt đầu.', { exact: true })).toBeVisible()
  await page.getByLabel('Thời gian kết thúc').fill(`${year}-10-10T12:00`)
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click()
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
  const id = new URL(page.url()).pathname.split('/').at(-1)
  const guest = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    expect((await guest.request.get(`/api/v1/activities/${id}/`)).status()).toBe(404)
    await page.getByRole('link', { name: 'Chỉnh sửa hoạt động' }).click()
    await expect(page.getByLabel('Thời gian bắt đầu')).toHaveValue(`${year}-10-10T08:00`)
    await page.getByLabel('Địa chỉ hoạt động').fill('Công viên Huế')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Công viên Huế', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hoàn thành hoạt động' })).toBeDisabled()
    const publicPage = await guest.newPage()
    await publicPage.goto('/hoat-dong')
    await publicPage.getByLabel('Tìm theo tên hoạt động').fill(title)
    await publicPage.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await publicPage.getByRole('link', { name: title, exact: true }).click()
    await expect(publicPage.getByText('Công viên Huế', { exact: true })).toBeVisible()
    await expect(publicPage.getByRole('link', { name: 'Chỉnh sửa hoạt động' })).toHaveCount(0)
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    await publicPage.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-activity-detail.png`), fullPage: true })
    for (const width of [320, 390, 768, 1280]) {
      await publicPage.setViewportSize({ width, height: 900 })
      expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
    }
    await page.getByRole('button', { name: 'Hủy hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByText('Hoạt động này đã bị hủy.', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Chỉnh sửa hoạt động' })).toHaveCount(0)
    await publicPage.reload()
    await expect(publicPage.getByText('Hoạt động này đã bị hủy.', { exact: true })).toBeVisible()
    await register(page)
    await page.goto(`/nha-to-chuc/hoat-dong/${id}`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0)
    expect((await page.request.get(`/api/v1/organizer/activities/${id}/`)).status()).toBe(404)
  } finally { await guest.close() }
})

test('Guest và Volunteer không vào trang tạo hoạt động; danh sách rỗng có hướng dẫn', async ({ page }) => {
  await page.goto('/nha-to-chuc/hoat-dong/tao')
  await expect(page).toHaveURL(/\/dang-nhap$/)
  await register(page, 'volunteer')
  await page.goto('/nha-to-chuc/hoat-dong/tao')
  await expect(page).toHaveURL(/\/tinh-nguyen-vien$/)
  await page.goto(`/hoat-dong?search=${randomUUID()}`)
  await expect(page.getByText('Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.')).toBeVisible()
})
