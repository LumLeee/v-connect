import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = 'admin-summary-activity'
const target = `/bao-cao/hoat-dong/${id}/tong-ket`
const activity = { id, title: 'Kết nối số cùng cộng đồng', organizer_name: 'Nhóm cộng đồng Sơn Trà', status: 'completed', starts_at: '2026-10-01T01:00:00Z', ends_at: '2026-10-01T05:00:00Z', address: 'Sơn Trà, Đà Nẵng', description: 'Hướng dẫn người lớn tuổi sử dụng điện thoại.', skill_details: [{ id: 1, name: 'Công nghệ' }], timeline: [{ title: 'Thực hành', starts_at: '2026-10-01T02:00:00Z', ends_at: '2026-10-01T04:00:00Z', description: 'Thực hành gọi video.' }] }
const metrics = { registered: 12, approved: 10, pending: 0, rejected: 1, cancelled: 1, attended_completed: 8, feedback: { count: 2, average_rating: 3.5 } }
const generated = '2026-11-01T09:00:00Z'

async function setup(page, role = 'admin') {
  const user = { id: `summary-${role}`, username: 'admin', full_name: 'Người kiểm tra', role }
  const state = { data: { activity, metrics, contributions: { score: 48, confirmed: 6, pending: 2 }, prepared_by: 'Người lập báo cáo', generated_at: generated, source_fingerprint: 'first-source' }, gets: 0, posts: [], fail: 0, draftFail: 0, release: null }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copiedSummary = text } } })
  })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { ...user, avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'summary-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/summary-document/')) {
      state.gets++
      if (state.release) await new Promise(resolve => { state.resolve = resolve })
      if (state.fail) return route.fulfill({ status: state.fail, json: {} })
      data = state.data
    } else if (url.pathname.endsWith('/ai-draft/')) {
      state.posts.push(route.request().postDataJSON())
      if (state.draftFail) return route.fulfill({ status: state.draftFail, json: {} })
      data = { generated_at: generated, ai: { status: 'fallback', reason: 'disabled' }, source: { summary_fingerprint: state.data.source_fingerprint, feedback_count: 2, analyzed_count: 0 }, draft: { title: `Tổng kết ${activity.title}`, sections: [{ key: 'participation', title: 'Đăng ký và tham gia', text: `Có ${state.data.metrics.registered} đơn đăng ký.` }] }, evidence: [], limitations: [] }
    } else throw new Error(`Unexpected summary request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function capture(page, info, label) {
  const container = page.locator('.ad-summary')
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: ${width}px`).toBe(true)
    const refresh = await container.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox()
    const actions = await container.locator('.summary-document-actions').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - actions.x - actions.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-summary-${label}.png`), fullPage: true })
}

test('Tổng kết admin tách báo cáo gốc và nháp AI, giữ bản in chính xác trên mọi màn hình', async ({ page }, info) => {
  const state = await setup(page)
  await page.goto(target)
  const root = page.locator('.ad-summary'), sheet = root.locator('.summary-sheet'), panel = root.locator('.report-ai-panel')
  await expect(root.getByRole('heading', { name: 'Mẫu báo cáo tổng kết', exact: true })).toBeVisible()
  await expect(root.getByRole('link', { name: 'Kết quả hoạt động', exact: true })).toHaveAttribute('href', `/bao-cao/hoat-dong/${id}`)
  await expect(sheet).toContainText(activity.organizer_name)
  await expect(sheet).toContainText(activity.address)
  await expect(sheet).toContainText('48 điểm')
  await expect(sheet).toContainText('3.5/5')
  expect(state.posts).toEqual([])
  expect(await sheet.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.report-ai-panel')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
  await root.getByRole('link', { name: 'Bản nháp AI', exact: true }).click()
  await expect(page).toHaveURL(/#ban-nhap-ai$/)
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Có 12 đơn đăng ký.')
  await panel.getByLabel('Đăng ký và tham gia', { exact: true }).fill('Đây là bản nháp riêng đã chỉnh sửa.')
  await panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__copiedSummary)).toContain('Đây là bản nháp riêng đã chỉnh sửa.')
  await page.evaluate(() => { window.print = () => { window.__printedSummary = true } })
  await root.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  expect(await page.evaluate(() => window.__printedSummary)).toBe(true)
  await capture(page, info, 'ready')
  await page.emulateMedia({ media: 'print' })
  await expect(root.locator('.summary-document-toolbar')).toBeHidden()
  await expect(panel).toBeHidden()
  await expect(sheet).toBeVisible()
  await expect(sheet).not.toContainText('Đây là bản nháp riêng đã chỉnh sửa.')
  await expect(sheet.locator('.summary-print-time').first()).toBeVisible()
  await expect(sheet.locator('.summary-screen-time').first()).toBeHidden()
})

test('Tổng kết admin giữ chỉnh sửa khi lỗi, chặn sao chép nguồn cũ sau làm mới', async ({ page }) => {
  const state = await setup(page)
  await page.goto(target)
  const panel = page.locator('.report-ai-panel')
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Có 12 đơn đăng ký.')
  await panel.getByLabel('Đăng ký và tham gia', { exact: true }).fill('Nhận xét đã rà soát.')
  state.draftFail = 503
  await panel.getByRole('button', { name: 'Tạo lại bản nháp', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo lại bản nháp', exact: true })
  await dialog.getByRole('button', { name: 'Xác nhận tạo lại', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Máy chủ gặp lỗi')
  await dialog.getByRole('button', { name: 'Giữ bản đang sửa', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Nhận xét đã rà soát.')
  state.data = { ...state.data, metrics: { ...metrics, registered: 13 }, source_fingerprint: 'new-source' }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('alert').filter({ hasText: 'Số liệu đang xem đã thay đổi' })).toBeVisible()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Nhận xét đã rà soát.')
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeDisabled()
  state.draftFail = 0
  await panel.getByRole('button', { name: 'Tạo lại bản nháp', exact: true }).click()
  await dialog.getByRole('button', { name: 'Xác nhận tạo lại', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Có 13 đơn đăng ký.')
  expect(state.posts.at(-1)).toEqual({ expected_source_fingerprint: 'new-source' })
})

test('Tổng kết admin xử lý trạng thái tải, lỗi và thời gian thiếu mà không hiển thị số liệu cũ', async ({ page }) => {
  const state = await setup(page)
  state.release = true
  await page.goto(target)
  await expect(page.locator('.ad-summary')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeDisabled()
  await expect.poll(() => typeof state.resolve).toBe('function')
  state.fail = 400; state.release = false; state.resolve()
  await expect(page.getByRole('alert')).toContainText('Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành')
  await expect(page.locator('.summary-sheet')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Soạn bản nháp AI', exact: true })).toBeDisabled()
  state.fail = 0
  state.data = { ...state.data, activity: { ...activity, starts_at: null, ends_at: 'invalid', skill_details: null, timeline: null, address: '' }, generated_at: null }
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.locator('.summary-sheet')).toContainText('Chưa có thông tin')
  await expect(page.locator('.summary-sheet')).not.toContainText('Invalid Date')
  await expect(page.locator('.summary-activity-info')).not.toContainText('Địa điểm')
  await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeEnabled()
})

test('Nhà tổ chức giữ nguyên thứ tự nháp AI trước báo cáo và không có giao diện admin', async ({ page }) => {
  await setup(page, 'organizer')
  await page.goto(target)
  await expect(page.locator('.summary-sheet')).toBeVisible()
  await expect(page.locator('.ad-summary')).toHaveCount(0)
  await expect(page.locator('.summary-document-page').getByRole('link', { name: 'Kết quả hoạt động', exact: true })).toHaveCount(0)
  expect(await page.locator('.report-ai-panel').evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.summary-sheet')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)
})
