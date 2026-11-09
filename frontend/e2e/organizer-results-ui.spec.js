import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = 'stage4-activity'
const resultPath = `/bao-cao/hoat-dong/${id}`
const activity = { id, title: 'Kết nối số - Đồng hành cùng cộng đồng', organizer_name: 'Nhóm tình nguyện', status: 'completed',
  starts_at: '2026-11-01T01:00:00Z', ends_at: '2026-11-01T05:00:00Z', address: 'Sơn Trà, Đà Nẵng', capacity: 12, approved_count: 10,
  description: 'Hướng dẫn người lớn tuổi sử dụng điện thoại và nhận biết lừa đảo trực tuyến.',
  skill_details: [{ id: 1, name: 'Giao tiếp' }], timeline: Array.from({ length: 12 }, (_, index) => ({ title: `Mốc chương trình ${index + 1}`,
    starts_at: '2026-11-01T01:00:00Z', ends_at: '2026-11-01T01:15:00Z', description: 'Hướng dẫn, thực hành và giải đáp cùng người tham gia.' })) }
const metrics = { registered: 14, approved: 10, pending: 1, rejected: 1, cancelled: 2, attended_completed: 8, attended_ongoing: 0, attended_cancelled: 0, feedback: { count: 4, average_rating: 4.25 } }

async function fixtures(page, role = 'organizer') {
  const state = { resultCalls: 0, contributionCalls: 0, failResult: false, summaryError: 0, status: 'completed' }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: `stage4-${role}`, full_name: 'Người lập báo cáo', email: 'report@example.invalid', role } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/summary-document/')) {
      if (state.summaryError) return route.fulfill({ status: state.summaryError, json: {} })
      data = { activity, metrics, contributions: { score: 45, confirmed: 6, pending: 2 }, prepared_by: 'Người lập báo cáo', generated_at: new Date(Date.now() - 5 * 60000).toISOString() }
    } else if (url.pathname.endsWith(`/reports/activities/${id}/`)) {
      state.resultCalls++
      if (state.failResult) return route.abort()
      data = { activity: { ...activity, status: state.status }, metrics }
    } else if (url.pathname.endsWith('/contributions/')) { state.contributionCalls++; data = { count: 8, next: null, previous: null, results: [], summary: { total: 8, score: 45, confirmed: 6, pending: 2 } } }
    else if (url.pathname.endsWith('/reports/participations/')) data = { count: 14, next: null, previous: null, results: [] }
    else throw new Error(`Unexpected result UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Kết quả và tổng kết: nhóm số liệu, liên kết chi tiết, responsive và bản in A4 đầy đủ', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(resultPath)
  await expect(page.locator('.organizer-result-summary .lead')).toHaveText(['14', '10', '8', '4'])
  await expect(page.locator('.organizer-result-panel').filter({ has: page.getByRole('heading', { name: 'Điểm đóng góp', exact: true }) })).toContainText('45 điểm')
  await expect(page.getByText(activity.title, { exact: true })).toHaveCount(1)
  await expect(page.getByText('4,25/5', { exact: true })).toBeVisible()
  await expect(page.locator('.organizer-report-rules')).toHaveJSProperty('open', false)
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/stage4-report-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-result.png`), fullPage: true })
  await page.getByRole('link', { name: 'Tổng đơn đăng ký', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`metric=registered&activity=${id}`))
  await expect(page.getByText('14 đơn đăng ký.', { exact: true })).toBeVisible()
  await page.goto(resultPath)
  await expect(page.locator('.organizer-result-summary')).toBeVisible()
  const beforeResult = state.resultCalls, beforeContributions = state.contributionCalls
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect.poll(() => state.resultCalls).toBeGreaterThan(beforeResult)
  await expect.poll(() => state.contributionCalls).toBeGreaterThan(beforeContributions)
  await page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true }).click()
  await expect(page.locator('.summary-metric-group')).toHaveCount(3)
  await expect(page.locator('.summary-metrics')).toContainText('45 điểm')
  await expect(page.locator('.summary-timeline li')).toHaveCount(12)
  await expect(page.locator('.summary-footer .summary-screen-time')).toContainText('phút trước')
  await expect(page.locator('.summary-footer .summary-print-time')).toBeHidden()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.screenshot({ path: path.join(output, `${info.project.name}-summary.png`), fullPage: true })
  await page.evaluate(() => { window.print = () => { window.__summaryPrinted = true } })
  await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__summaryPrinted)).toBe(true)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.od-sidebar')).toBeHidden()
  await expect(page.locator('.summary-document-toolbar')).toBeHidden()
  await expect(page.locator('.summary-footer .summary-screen-time')).toBeHidden()
  await expect(page.locator('.summary-footer .summary-print-time')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'BÁO CÁO TỔNG KẾT HOẠT ĐỘNG', exact: true })).toBeVisible()
  await mkdir('../tmp/pdfs', { recursive: true })
  await page.pdf({ path: `../tmp/pdfs/stage4-${info.project.name}-summary.pdf`, preferCSSPageSize: true, printBackground: true })
})

test('Kết quả chưa hoàn thành, lỗi/thử lại và tổng kết của admin vẫn xử lý đúng', async ({ page }) => {
  const state = await fixtures(page)
  state.status = 'cancelled'; state.failResult = true
  await page.goto(resultPath)
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  state.failResult = false
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Đây là số liệu hiện tại. Hoạt động chưa hoàn thành hoặc đã bị hủy.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveCount(0)
  expect(state.contributionCalls).toBe(0)
  state.summaryError = 400
  await page.goto(`${resultPath}/tong-ket`)
  await expect(page.getByRole('alert')).toContainText('Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành')
  await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeDisabled()
  state.summaryError = 0
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeEnabled()
  await page.unroute('**/api/v1/**')
  await fixtures(page, 'admin')
  await page.goto(resultPath)
  await expect(page.locator('.report-metrics .activity-card')).toHaveCount(8)
  await expect(page.locator('.organizer-result-summary')).toHaveCount(0)
  await page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true }).click()
  await expect(page.locator('.summary-metrics')).toContainText('45 điểm')
})
