import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}

for (const [label, offset] of [['lịch đã qua', -48], ['lịch tương lai', 48]]) {
  test(`Chế độ thử: công khai, đăng ký, QR và hoàn thành không chờ ${label}`, async ({ page, browser }) => {
    test.skip(process.env.E2E_DEMO_TIME !== 'true', 'Run with --demo-time')
    test.setTimeout(120000)
    page.on('pageerror', error => { throw error })
    expect((await post(page.request, '/api/v1/auth/login/', {
      identifier: process.env.E2E_ATTENDANCE_ORGANIZER, password: process.env.E2E_ATTENDANCE_PASSWORD,
    })).status()).toBe(200)
    const starts = new Date(Date.now() + offset * 3600000)
    const created = await post(page.request, '/api/v1/organizer/activities/', {
      title: `Thử thời gian ${randomUUID()}`, description: 'Thử không chờ thời gian', address: 'Huế', capacity: 3,
      starts_at: starts.toISOString(), ends_at: new Date(+starts + 3600000).toISOString(),
    })
    expect(created.status()).toBe(201)
    const activity = await created.json()
    expect(activity.time_checks_disabled).toBe(true)
    await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}`)
    await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Xác nhận chuyển trạng thái' })
    await expect(dialog).toBeVisible()
    const box = await dialog.boundingBox()
    const viewport = page.viewportSize()
    expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(2)
    expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(2)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Công khai hoạt động', exact: true })).toBeFocused()
    await page.getByRole('button', { name: 'Công khai hoạt động', exact: true }).click()
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hoàn thành hoạt động', exact: true })).toBeEnabled()
    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
    try {
      expect((await post(context.request, '/api/v1/auth/register/', {
        email: `demo.time.${randomUUID()}@example.invalid`, full_name: 'Người thử không chờ', role: 'volunteer',
        password: 'River-Community-493!', password_confirm: 'River-Community-493!',
      })).status()).toBe(201)
      const volunteer = await context.newPage()
      await volunteer.goto(`/hoat-dong/${activity.id}`)
      await volunteer.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
      await expect(volunteer.getByText('Trạng thái: Chờ duyệt', { exact: true })).toBeVisible()
      await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}/dang-ky`)
      await page.getByRole('link', { name: 'Xem hồ sơ', exact: true }).click()
      const applicant = page.getByRole('region', { name: 'Thông tin hồ sơ ứng viên', exact: true })
      await expect(applicant).toContainText('Email:')
      await expect(applicant).toContainText('@example.invalid')
      await expect(applicant).toContainText('Kỹ năng:')
      await expect(applicant).toContainText('Sở thích:')
      await expect(applicant.locator('input, textarea, select, button[type="submit"]')).toHaveCount(0)
      await page.getByRole('link', { name: 'Quay lại danh sách đăng ký', exact: true }).click()
      await page.getByRole('button', { name: 'Duyệt', exact: true }).click()
      await page.getByRole('button', { name: 'Xác nhận xét duyệt', exact: true }).click()
      await expect(page.getByText('Đã cập nhật kết quả xét duyệt.', { exact: true })).toBeVisible()
      await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}/diem-danh`)
      await page.getByRole('button', { name: 'Tạo mã mới', exact: true }).click()
      const code = await page.getByTestId('attendance-code').textContent()
      await volunteer.goto(`/hoat-dong/${activity.id}/check-in`)
      await volunteer.getByLabel('Mã check-in (8 chữ số)', { exact: true }).fill(code)
      await volunteer.getByRole('button', { name: 'Xác nhận check-in', exact: true }).click()
      await expect(volunteer.getByText('Bạn đã check-in thành công.', { exact: true })).toBeVisible()
      await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}`)
      await page.getByRole('button', { name: 'Hoàn thành hoạt động', exact: true }).click()
      await page.getByRole('button', { name: 'Xác nhận', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Hoàn thành hoạt động', exact: true })).toHaveCount(0)
      await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}/dong-gop`)
      await page.getByRole('button', { name: 'Xác nhận đóng góp', exact: true }).click()
      await page.getByLabel('Điểm đóng góp', { exact: true }).fill('8')
      await page.getByRole('button', { name: 'Lưu đóng góp', exact: true }).click()
      await expect(page.getByText('Đã lưu điểm đóng góp và lịch sử xác nhận.', { exact: true })).toBeVisible()
      await volunteer.goto('/tinh-nguyen-vien/dong-gop')
      await expect(volunteer.locator('.contribution-summary')).toContainText('8 điểm')
    } finally { await context.close() }
  })
}
