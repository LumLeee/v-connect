import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function post(request, url, data) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { headers: { 'X-CSRFToken': csrfToken }, data })
}
async function login(request, identifier, password = process.env.E2E_ATTENDANCE_PASSWORD) {
  expect((await post(request, '/api/v1/auth/login/', { identifier, password })).status()).toBe(200)
}

test('Gửi phản hồi, Organizer xem điểm và Admin ẩn có lý do', async ({ page, browser }, info) => {
  page.on('pageerror', error => { throw error })
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  const title = `Hoạt động điểm danh feedback ${info.project.name}`
  const content = `Trải nghiệm ${info.project.name} rất hữu ích. <script>window.feedbackInjected = true</script>`
  await login(page.request, process.env.E2E_ATTENDANCE_VOLUNTEER)
  await page.goto('/tinh-nguyen-vien/lich-su')
  await page.locator('article').filter({ has: page.getByRole('link', { name: title, exact: true }) }).getByRole('link', { name: 'Gửi hoặc xem phản hồi của tôi' }).click()
  await page.getByLabel('Điểm đánh giá (1–5)', { exact: true }).fill('5')
  await page.getByLabel('Nội dung phản hồi', { exact: true }).fill(content)
  await page.getByRole('button', { name: 'Gửi phản hồi', exact: true }).click()
  await expect(page.getByText('Bạn đã gửi phản hồi cho hoạt động này.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Gửi phản hồi', exact: true })).toHaveCount(0)
  expect((await post(page.request, `/api/v1/activities/${activity}/feedback/`, { rating: 1, content: 'Gửi lại' })).status()).toBe(400)
  expect(await page.evaluate(() => window.feedbackInjected)).toBeUndefined()
  const ownerContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  const adminContext = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: page.viewportSize() })
  try {
    await login(ownerContext.request, process.env.E2E_ATTENDANCE_ORGANIZER)
    const owner = await ownerContext.newPage()
    await owner.goto(`/nha-to-chuc/hoat-dong/${activity}`)
    await owner.getByRole('link', { name: 'Xem phản hồi hoạt động' }).click()
    await expect(owner.getByText('1 phản hồi hợp lệ. Điểm trung bình: 5/5.', { exact: true })).toBeVisible()
    await expect(owner.getByText(content, { exact: true })).toBeVisible()
    expect(await owner.evaluate(() => window.feedbackInjected)).toBeUndefined()
    await login(adminContext.request, process.env.E2E_ADMIN_USERNAME, process.env.E2E_ADMIN_PASSWORD)
    const admin = await adminContext.newPage()
    await admin.goto('/quan-tri')
    await admin.getByRole('link', { name: 'Quản lý phản hồi', exact: true }).click()
    await admin.locator('article').filter({ hasText: content }).getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
    await expect(admin.getByRole('button', { name: 'Xác nhận ẩn phản hồi' })).toBeDisabled()
    await admin.getByLabel('Lý do ẩn phản hồi', { exact: true }).fill('Nội dung không phù hợp với hoạt động.')
    await admin.getByRole('button', { name: 'Xác nhận ẩn phản hồi' }).click()
    await expect(admin.getByText('Đã ẩn phản hồi và lưu thông tin xử lý.', { exact: true })).toBeVisible()
    await admin.getByRole('button', { name: 'Đã ẩn', exact: true }).click()
    await expect(admin.locator('article').filter({ hasText: content }).getByText('Người xử lý: Quản trị kiểm thử', { exact: true })).toBeVisible()
    await owner.reload()
    await expect(owner.getByText('0 phản hồi hợp lệ. Điểm trung bình: Chưa có đánh giá.', { exact: true })).toBeVisible()
    await expect(owner.getByText(content, { exact: true })).toHaveCount(0)
    await page.reload()
    await expect(page.getByText('Lý do: Nội dung không phù hợp với hoạt động.', { exact: true })).toBeVisible()
    await mkdir(process.env.E2E_ARTIFACT_DIR, { recursive: true })
    for (const [name, target] of [['feedback-own', page], ['feedback-admin', admin], ['feedback-organizer', owner]]) {
      for (const width of [320, 390, 768, 1280]) {
        await target.setViewportSize({ width, height: 900 })
        expect(await target.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
      }
      await target.setViewportSize(info.project.use.viewport)
      await target.screenshot({ path: path.join(process.env.E2E_ARTIFACT_DIR, `${info.project.name}-${name}.png`), fullPage: true })
    }
  } finally { await ownerContext.close(); await adminContext.close() }
})

test('Người chưa được điểm danh không gửi phản hồi và không vào trang Admin', async ({ page }, info) => {
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  await login(page.request, process.env.E2E_PENDING_VOLUNTEER)
  await page.goto(`/hoat-dong/${activity}/phan-hoi`)
  await expect(page.getByText('Bạn chỉ có thể gửi phản hồi khi đã được xác nhận có mặt và hoạt động đã Hoàn thành.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gửi phản hồi' })).toHaveCount(0)
  expect((await post(page.request, `/api/v1/activities/${activity}/feedback/`, { rating: 5, content: 'Không tham gia' })).status()).toBe(400)
  await page.goto('/quan-tri/phan-hoi')
  await expect(page).toHaveURL(/\/tinh-nguyen-vien$/)
})
