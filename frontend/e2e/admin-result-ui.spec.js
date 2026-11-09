import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = 'activity-result-ui'
async function fixtures(page, { status = 'completed', hold = false } = {}) {
  const state = { fail: false, data: { activity: { id, title: 'Kết nối số – Hướng dẫn sử dụng điện thoại', description: 'Mô tả riêng không phải địa chỉ', address: 'Phòng sinh hoạt cộng đồng tại Sơn Trà, Đà Nẵng', organizer_name: 'Nhóm cộng đồng Đà Nẵng', status, starts_at: '2026-02-03T02:00:00Z', ends_at: '2026-02-03T05:00:00Z', capacity: 12, approved_count: 5 }, metrics: { registered: 9, pending: 2, approved: 5, rejected: 1, cancelled: 1, attended_completed: 4, attended_ongoing: 0, attended_cancelled: 0, feedback: { count: 3, average_rating: 4.33 } } } }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-result-ui', full_name: 'Quản trị kiểm thử', username: 'admin', role: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith(`/reports/activities/${id}/`)) { await gate; if (state.fail) return route.abort(); data = state.data }
    else throw new Error(`Unexpected admin result UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Admin kết quả: đúng ngữ cảnh, số liệu và đường dẫn chi tiết theo hoạt động', async ({ page }, info) => {
  await fixtures(page)
  await page.goto(`/bao-cao/hoat-dong/${id}`)
  const result = page.locator('.ad-activity-result')
  await expect(result.getByRole('heading', { name: 'Kết quả hoạt động', exact: true })).toBeVisible()
  await expect(result.locator('.ad-result-context h2')).toHaveText('Kết nối số – Hướng dẫn sử dụng điện thoại')
  await expect(result.locator('.ad-result-context')).toContainText('Phòng sinh hoạt cộng đồng tại Sơn Trà, Đà Nẵng')
  await expect(result).not.toContainText('Mô tả riêng không phải địa chỉ')
  await expect(result.locator('.ad-result-metric strong')).toHaveText(['9', '5', '4'])
  for (const [index, metric] of ['registered', 'approved', 'attended_completed'].entries()) await expect(result.locator('.ad-result-metric').nth(index)).toHaveAttribute('href', `/bao-cao/dang-ky?metric=${metric}&activity=${id}`)
  await expect(result.locator('.ad-result-feedback dd')).toHaveText(['3', '4,33/5'])
  await expect(result.getByRole('link', { name: 'Kiểm duyệt phản hồi', exact: true })).toHaveAttribute('href', `/quan-tri/phan-hoi?activity=${id}&status=visible`)
  await expect(result.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveAttribute('href', `/bao-cao/hoat-dong/${id}/tong-ket`)
  await expect(result.getByRole('link', { name: 'Soạn bản nháp AI', exact: true })).toHaveAttribute('href', `/bao-cao/hoat-dong/${id}/tong-ket#ban-nhap-ai`)
  await expect(result.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveCount(0)
  await expect(result.locator('a[href^="/nha-to-chuc/"]')).toHaveCount(0)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Result at ${width}px`).toBe(true)
    const refresh = await result.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox(), actions = await result.locator('.ad-result-heading-actions').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - actions.x - actions.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage2-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-activity-result.png`), fullPage: true })
  await result.getByText('Quy tắc tính số liệu', { exact: true }).click()
  await expect(result.locator('.ad-result-rules')).toHaveAttribute('open', '')
})

test('Admin kết quả: điều kiện công khai/hoàn thành và dữ liệu trống không gây lỗi', async ({ page }) => {
  const state = await fixtures(page, { status: 'published' })
  await page.goto(`/bao-cao/hoat-dong/${id}`)
  const result = page.locator('.ad-activity-result')
  await expect(result.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveAttribute('href', `/hoat-dong/${id}`)
  await expect(result.locator('.ad-result-notice')).toContainText('công khai')
  await expect(result.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveCount(0)
  await expect(result.getByRole('link', { name: 'Soạn bản nháp AI', exact: true })).toHaveCount(0)
  state.data.activity = { ...state.data.activity, status: 'cancelled', starts_at: null, ends_at: 'invalid-date', address: '', organizer_name: '' }
  state.data.metrics.feedback = { count: 0, average_rating: null }
  await result.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(result.locator('.ad-result-notice')).toContainText('đã hủy')
  await expect(result.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveCount(0)
  await expect(result.locator('.ad-result-context time')).toHaveCount(0)
  await expect(result.locator('.ad-result-context')).toContainText('Chưa có thông tin')
  await expect(result.locator('.ad-result-feedback dd')).toHaveText(['0', 'Chưa có đánh giá'])
  state.data.activity.status = 'draft'; state.data.metrics.feedback = null
  await result.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(result.locator('.ad-result-feedback')).toContainText('Chưa có dữ liệu phản hồi')
  await expect(result.locator('.ad-result-notice')).toContainText('nháp')
  state.data.activity = { ...state.data.activity, status: 'completed', ends_at: '2099-01-01T05:00:00Z', time_checks_disabled: false }
  await result.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(result.locator('.ad-result-report')).toContainText('điều kiện thời gian kết thúc')
  await expect(result.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveCount(0)
  state.data.activity.time_checks_disabled = true
  await result.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(result.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toBeVisible()
  await expect(result.getByRole('link', { name: 'Soạn bản nháp AI', exact: true })).toBeVisible()
})

test('Admin kết quả: ẩn số cũ khi tải lại, báo lỗi và thử lại', async ({ page }) => {
  const state = await fixtures(page, { hold: true })
  await page.goto(`/bao-cao/hoat-dong/${id}`)
  const result = page.locator('.ad-activity-result')
  await expect(result).toHaveAttribute('aria-busy', 'true')
  await expect(result.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(result.locator('.ad-result-metric')).toHaveCount(0)
  state.release()
  await expect(result.locator('.ad-result-metric strong')).toHaveText(['9', '5', '4'])
  state.fail = true
  await result.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(result.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(result.locator('.ad-result-metric, .ad-result-context')).toHaveCount(0)
  state.fail = false; state.data.metrics.registered = 10
  await result.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(result.locator('.ad-result-metric strong')).toHaveText(['10', '5', '4'])
  await expect(result.getByRole('alert')).toHaveCount(0)
})
