import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const metric = registered => ({ registered, pending: 1, approved: Math.max(0, registered - 1), rejected: 0, cancelled: 0, attended_completed: Math.max(0, registered - 1), attended_ongoing: 0, attended_cancelled: 0 })
const row = index => ({ id: `report-${index}`, title: `Chương trình cộng đồng ${String(index).padStart(2, '0')}`, status: index % 2 ? 'completed' : 'published', organizer_name: 'Nhóm cộng đồng', starts_at: '2026-02-03T02:00:00Z', metrics: metric(index), feedback: { count: index % 3 } })
async function fixtures(page, { hold = false } = {}) {
  const state = { rows: Array.from({ length: 14 }, (_, index) => row(index + 1)), requests: [], exports: [], fail: false, exportFail: false, failOrganizers: false }
  const gate = hold ? new Promise(resolve => { state.release = resolve }) : Promise.resolve()
  await page.addInitScript(() => { window.printCalls = 0; window.print = () => { window.printCalls++ } })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()); let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'admin-report-ui', full_name: 'Quản trị giao diện', role: 'admin', username: 'admin' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/reports/organizers/')) {
      if (state.failOrganizers) return route.abort()
      data = { results: [{ id: 'owner-one', name: 'Nhóm cộng đồng', is_active: true }, { id: 'owner-two', name: 'Nhà tổ chức bị khóa', is_active: false }], next: null }
    } else if (url.pathname.endsWith('/reports/analytics/export/')) {
      state.exports.push(url.search)
      if (state.exportFail) return route.fulfill({ status: 400, json: { detail: 'Xuất báo cáo thất bại. Hãy thử lại.' } })
      return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from('fixture-xlsx') })
    } else if (url.pathname.endsWith('/reports/analytics/')) {
      state.requests.push(url.search); await gate
      if (state.fail) return route.abort()
      const keyword = url.searchParams.get('search') || '', status = url.searchParams.get('status')
      const rows = state.rows.filter(item => (!keyword || item.title.includes(keyword)) && (!status || item.status === status))
      data = { activity_count: rows.length, generated_at: '2026-02-05T02:00:00Z', scope: url.searchParams.get('organizer') ? 'Nhóm cộng đồng' : 'Toàn hệ thống', filters: Object.fromEntries(url.searchParams), metrics: metric(rows.reduce((total, item) => total + item.metrics.registered, 0)), feedback: { count: rows.reduce((total, item) => total + item.feedback.count, 0), average_rating: rows.length ? 4.5 : null, distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 2 } }, activity_statuses: { completed: rows.filter(item => item.status === 'completed').length, published: rows.filter(item => item.status === 'published').length, draft: 0, cancelled: 0 }, months: rows.length ? [{ month: '2026-02', registered: 20 }] : [], rows }
    } else if (/\/reports\/activities\/report-\d+\/$/.test(url.pathname)) {
      const activity = state.rows.find(item => item.id === url.pathname.split('/').at(-2))
      data = { activity, metrics: { ...activity.metrics, feedback: { ...activity.feedback, average_rating: null } } }
    } else throw new Error(`Unexpected admin report UI request: ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

test('Báo cáo admin: URL, quay lại, phạm vi Excel và bản in chứa toàn bộ hoạt động', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto('/bao-cao?status=completed&organizer=owner-one&date_from=2026-02-01&date_to=2026-02-28')
  const form = page.getByRole('form', { name: 'Bộ lọc báo cáo' })
  await expect(form.getByLabel('Nhà tổ chức', { exact: true })).toHaveValue('owner-one')
  await expect(page.locator('.ad-report-summary article').first()).toContainText('7')
  await expect(page.locator('.ad-report-context')).toContainText('Nhóm cộng đồng')
  await form.getByLabel('Tên hoạt động', { exact: true }).fill('13')
  await form.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  await expect(page.locator('.ad-report-summary article').first()).toContainText('1')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('v-connect-bao-cao.xlsx')
  expect(Object.fromEntries(new URLSearchParams(state.exports.at(-1)))).toEqual(Object.fromEntries(new URLSearchParams(state.requests.at(-1))))
  await page.goBack()
  await expect(form.getByLabel('Tên hoạt động', { exact: true })).toHaveValue('')
  await expect(form.getByLabel('Trạng thái hoạt động', { exact: true })).toHaveValue('completed')
  await page.goForward()
  await expect(form.getByLabel('Tên hoạt động', { exact: true })).toHaveValue('13')
  await page.getByRole('button', { name: 'Bỏ bộ lọc Tìm: 13', exact: true }).click()
  await form.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click()
  await page.getByRole('navigation', { name: 'Chế độ báo cáo' }).getByRole('button', { name: 'Theo hoạt động', exact: true }).click()
  await expect(page.locator('.ad-report-row:visible')).toHaveCount(12)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.ad-report-row:visible')).toHaveCount(2)
  await page.getByRole('button', { name: 'In / Lưu PDF', exact: true }).click()
  expect(await page.evaluate(() => window.printCalls)).toBe(1)
  await page.emulateMedia({ media: 'print' })
  expect(await page.evaluate(() => getComputedStyle(document.body).page)).toBe('vconnect-admin-report')
  await expect(page.locator('.ad-report-row:visible')).toHaveCount(14)
  await expect(page.getByRole('region', { name: 'Tổng hợp báo cáo', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Biểu đồ báo cáo', exact: true })).toBeVisible()
  await expect(form).toBeHidden()
})

test('Báo cáo admin: chỉ số thực, nội dung an toàn, bố cục và điều hướng bằng bàn phím', async ({ page }, info) => {
  const state = await fixtures(page)
  state.rows[0].title = '<img src=x onerror="window.injected=true"> Hoạt động cộng đồng'
  await page.goto('/bao-cao/mo-rong?tab=activities')
  await expect(page.getByRole('heading', { name: 'Báo cáo mở rộng', exact: true })).toBeVisible()
  const first = page.locator('.ad-report-row').first()
  await expect(first).toContainText(state.rows[0].title)
  await expect(first.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => window.injected)).toBeUndefined()
  await expect(page.locator('.ad-report-summary article').nth(1).locator('strong')).toHaveText('105')
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Reports ${width}px`).toBe(true)
    const refresh = await page.getByRole('button', { name: 'Làm mới', exact: true }).boundingBox(), header = await page.locator('.ad-report-heading').boundingBox()
    expect(Math.abs(refresh.x + refresh.width - header.x - header.width)).toBeLessThan(2)
  }
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-preview'; await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-reports.png`), fullPage: true })
  await first.focus(); await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/bao-cao\/hoat-dong\/report-1$/)
  await expect(page.getByRole('heading', { name: 'Kết quả hoạt động', exact: true })).toBeVisible()
})

test('Báo cáo admin: tải, lỗi, thử lại, lỗi Excel và dữ liệu rỗng không giữ số liệu cũ', async ({ page }) => {
  const state = await fixtures(page, { hold: true })
  await page.goto('/bao-cao')
  await expect(page.locator('section.ad-reports')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Xuất Excel', exact: true })).toBeDisabled()
  state.release(); await expect(page.locator('.ad-report-summary article')).toHaveCount(4)
  state.exportFail = true
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Xuất báo cáo thất bại')
  state.fail = true
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Không kết nối được máy chủ')
  await expect(page.locator('.ad-report-summary article')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'In / Lưu PDF', exact: true })).toBeDisabled()
  state.fail = false; state.rows = []
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Không có dữ liệu phù hợp', exact: true })).toBeVisible()
  await expect(page.locator('.ad-report-summary article').first().locator('strong')).toHaveText('0')
  await expect(page.locator('.ad-report-row')).toHaveCount(0)
})
