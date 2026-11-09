import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

async function requestMutation(request, url, data, method = 'POST') {
  const response = await request.get('/api/v1/auth/csrf/')
  expect(response.ok(), await response.text()).toBe(true)
  const { csrfToken } = await response.json()
  return request.fetch(url, { method, data, headers: { 'X-CSRFToken': csrfToken } })
}

async function get(request, url) {
  const response = await request.get(url)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function login(request) {
  const response = await requestMutation(request, '/api/v1/auth/login/', {
    identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD,
  })
  expect(response.status(), await response.text()).toBe(200)
}

async function evidence(page, info, label) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => scrollTo(0, 0))
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-flow'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-remaining-${label}.png`), fullPage: true })
}

test('Admin đợt cuối: tổng kết dùng số liệu thật, bản nháp theo nguồn và bản in chỉ chứa báo cáo gốc', async ({ page }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await login(page.request)
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  const original = await get(page.request, `/api/v1/reports/activities/${activity}/summary-document/`)
  await page.goto(`/bao-cao/hoat-dong/${activity}`)
  await page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true }).click()
  const root = page.locator('.ad-summary'), sheet = root.locator('.summary-sheet'), panel = root.locator('.report-ai-panel')
  await expect(root.getByRole('heading', { name: 'Mẫu báo cáo tổng kết', exact: true })).toBeVisible()
  await expect(sheet).toContainText(original.activity.title)
  await expect(sheet).toContainText(original.activity.organizer_name)
  await expect(sheet.locator('.summary-metric-list').first().locator('dd')).toHaveText([
    original.metrics.registered, original.metrics.approved, original.metrics.pending, original.metrics.rejected, original.metrics.cancelled,
  ].map(String))
  const posted = page.waitForResponse(response => response.url().endsWith(`/reports/activities/${activity}/ai-draft/`) && response.request().method() === 'POST')
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  const draftResponse = await posted
  expect(draftResponse.status(), await draftResponse.text()).toBe(200)
  const response = await draftResponse.json()
  expect(draftResponse.request().postDataJSON()).toEqual({ expected_source_fingerprint: original.source_fingerprint })
  expect(response.source.summary_fingerprint).toBe(original.source_fingerprint)
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeEnabled()
  const title = panel.getByLabel('Tiêu đề bản nháp', { exact: true })
  await title.fill(`Bản rà soát ${info.project.name}`)
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(title).toHaveValue(`Bản rà soát ${info.project.name}`)
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeEnabled()
  await evidence(page, info, 'summary')
  await page.emulateMedia({ media: 'print' })
  await expect(sheet).toBeVisible()
  await expect(panel).toBeHidden()
  await expect(page.locator('.od-sidebar')).toBeHidden()
  await expect(sheet.locator('.summary-print-time').first()).toBeVisible()
  await expect(sheet).not.toContainText(`Bản rà soát ${info.project.name}`)
  await page.emulateMedia({ media: 'screen' })
  await root.getByRole('link', { name: 'Kết quả hoạt động', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/bao-cao/hoat-dong/${activity}$`))
})

test('Admin đợt cuối: lọc báo cáo và xuất Excel cùng phạm vi, mở đúng chi tiết từng chỉ số hoạt động', async ({ page }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  await login(page.request)
  const { activity } = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
  const summary = await get(page.request, `/api/v1/reports/activities/${activity}/summary-document/`)
  const options = await get(page.request, '/api/v1/reports/organizers/?page_size=100')
  const owner = options.results.find(item => item.name === summary.activity.organizer_name)
  expect(owner).toBeTruthy()
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(summary.activity.starts_at)).map(item => [item.type, item.value]))
  const day = `${parts.year}-${parts.month}-${parts.day}`
  const filters = { search: summary.activity.title, status: 'completed', organizer: owner.id, date_from: day, date_to: day }
  const query = new URLSearchParams(filters)
  const expected = await get(page.request, `/api/v1/reports/analytics/?${query}`)
  expect(expected.activity_count).toBe(1)
  await page.goto('/bao-cao')
  await expect(page.getByRole('heading', { name: 'Báo cáo và thống kê', exact: true })).toBeVisible()
  const form = page.getByRole('form', { name: 'Bộ lọc báo cáo', exact: true })
  await form.getByLabel('Tên hoạt động', { exact: true }).fill(filters.search)
  await form.getByRole('combobox', { name: 'Trạng thái hoạt động', exact: true }).selectOption(filters.status)
  await form.getByRole('combobox', { name: 'Nhà tổ chức', exact: true }).selectOption(owner.id)
  await form.getByLabel('Ngày bắt đầu từ', { exact: true }).fill(day)
  await form.getByLabel('Ngày bắt đầu đến', { exact: true }).fill(day)
  await form.getByRole('button', { name: 'Áp dụng', exact: true }).click()
  const registered = page.locator('.ad-report-summary article').filter({ has: page.getByRole('heading', { name: 'Đơn đăng ký', exact: true }) })
  await expect(registered.locator('strong')).toHaveText(String(expected.metrics.registered))
  await expect(registered.getByRole('link')).toHaveCount(0)
  await expect(page.locator('.ad-report-context')).toContainText(owner.name)
  await page.getByRole('button', { name: 'Theo hoạt động', exact: true }).click()
  await expect(page.locator('.ad-report-row:visible')).toHaveCount(1)
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Nhà tổ chức', exact: true })).toHaveValue(owner.id)
  await expect(page.getByRole('button', { name: 'Theo hoạt động', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const downloadPromise = page.waitForEvent('download')
  const exportPromise = page.waitForRequest(request => request.url().includes('/reports/analytics/export/'))
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click()
  const download = await downloadPromise, exportRequest = await exportPromise
  expect(Object.fromEntries(new URL(exportRequest.url()).searchParams)).toEqual(filters)
  expect(download.suggestedFilename()).toBe('v-connect-bao-cao.xlsx')
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-remaining-flow'
  await mkdir(output, { recursive: true })
  await download.saveAs(path.join(output, `${info.project.name}-admin-filtered-report.xlsx`))
  await evidence(page, info, 'reports')
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.ad-report-filters')).toBeHidden()
  await expect(page.locator('.ad-report-row:visible')).toHaveCount(1)
  await page.emulateMedia({ media: 'screen' })
  await page.locator('.ad-report-row:visible').click()
  await expect(page).toHaveURL(new RegExp(`/bao-cao/hoat-dong/${activity}$`))
  await page.locator(`.ad-result-metric[href*="metric=registered&activity=${activity}"]`).click()
  await expect(page.getByRole('heading', { name: 'Chi tiết đăng ký', exact: true })).toBeVisible()
  const entries = await get(page.request, `/api/v1/reports/participations/?activity=${activity}&metric=registered`)
  await expect(page.locator('.ad-participation-results strong')).toHaveText(String(entries.count))
  await expect(page.locator('.ad-participation-row')).toHaveCount(entries.count)
  const entry = page.locator('.ad-participation-row').first()
  await entry.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(summary.activity.title)
  await page.keyboard.press('Escape')
  await expect(entry).toBeFocused()
  await page.getByRole('combobox', { name: 'Loại số liệu', exact: true }).selectOption('attended_completed')
  await page.getByRole('form', { name: 'Bộ lọc đăng ký', exact: true }).getByRole('button', { name: 'Áp dụng', exact: true }).click()
  const attended = await get(page.request, `/api/v1/reports/participations/?activity=${activity}&metric=attended_completed`)
  expect(new URL(page.url()).searchParams.get('activity')).toBe(activity)
  await expect(page.locator('.ad-participation-row')).toHaveCount(attended.count)
  await evidence(page, info, 'participations')
})

test('Admin đợt cuối: nhật ký đúng lý do, tùy chọn thông báo và hồ sơ chỉ sửa tài khoản hiện tại', async ({ page, browser }, info) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const outsider = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  const unique = randomUUID().slice(0, 8), email = `remaining.${unique}@example.invalid`
  let savedProfile, savedPreferences
  try {
    const response = await requestMutation(outsider.request, '/api/v1/auth/register/', {
      email, full_name: `Người kiểm tra ${unique}`, role: 'volunteer', password: 'River-Community-493!', password_confirm: 'River-Community-493!',
    })
    expect(response.status(), await response.text()).toBe(201)
    const { user } = await response.json()
    await login(page.request)
    const reason = `Đối chiếu nhật ký đợt cuối ${unique}`
    expect((await requestMutation(page.request, `/api/v1/admin/accounts/${user.id}/status/`, { is_active: false, reason })).ok()).toBe(true)
    const audits = await get(page.request, `/api/v1/admin/audit/?subject=${user.id}&action=account_locked`)
    expect(audits.count).toBe(1)
    await page.goto(`/quan-tri/nhat-ky?subject=${user.id}&action=account_locked`)
    const row = page.locator('.ad-audit-row').filter({ hasText: `Người kiểm tra ${unique}` })
    await expect(row).toHaveCount(1)
    await row.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Chi tiết thao tác', exact: true })).toBeVisible()
    await expect(page.getByText(reason, { exact: true })).toBeVisible()
    await evidence(page, info, 'audit-detail')
    expect((await outsider.request.get('/api/v1/admin/audit/')).status()).toBe(401)

    savedPreferences = await get(page.request, '/api/v1/notifications/preferences/')
    await page.goto('/thong-bao')
    await expect(page.locator('.ad-notifications').getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible()
    const notes = await get(page.request, '/api/v1/notifications/?state=all&page_size=12')
    await expect(page.locator('.ad-notification-count')).toContainText(`${notes.count} thông báo`)
    await page.locator('.ad-notification-preferences > summary').click()
    const preference = page.getByRole('checkbox', { name: 'Nhận thông báo qua email', exact: true })
    await expect(preference).toBeChecked({ checked: savedPreferences.email_enabled })
    const preferenceResponse = page.waitForResponse(response => response.url().endsWith('/notifications/preferences/') && response.request().method() === 'PATCH')
    await preference.click()
    expect((await preferenceResponse).status()).toBe(200)
    expect((await get(page.request, '/api/v1/notifications/preferences/')).email_enabled).toBe(!savedPreferences.email_enabled)
    await page.reload()
    await page.locator('.ad-notification-preferences > summary').click()
    await expect(page.getByRole('checkbox', { name: 'Nhận thông báo qua email', exact: true })).toBeChecked({ checked: !savedPreferences.email_enabled })
    await evidence(page, info, 'notifications')

    savedProfile = (await get(page.request, '/api/v1/auth/profile/')).profile
    await page.goto('/ho-so')
    const form = page.locator('.ad-profile-editor'), name = form.getByLabel('Họ và tên', { exact: true })
    await expect(name).toHaveValue(savedProfile.full_name)
    await expect(form.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeDisabled()
    await name.fill(`Quản trị kiểm tra ${unique}`)
    await form.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(name).toHaveValue(`Quản trị kiểm tra ${unique}`)
    await form.getByRole('button', { name: 'Hoàn tác', exact: true }).click()
    await expect(name).toHaveValue(savedProfile.full_name)
    await name.fill(`Quản trị kiểm tra ${unique}`)
    const patch = page.waitForResponse(response => response.url().endsWith('/auth/profile/') && response.request().method() === 'PATCH')
    await form.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click()
    const updated = await patch
    expect(updated.status(), await updated.text()).toBe(200)
    expect(updated.request().postDataJSON()).not.toHaveProperty('username')
    const current = (await get(page.request, '/api/v1/auth/profile/')).profile
    expect(current.id).toBe(savedProfile.id)
    expect(current.username).toBe(savedProfile.username)
    expect(current.full_name).toBe(`Quản trị kiểm tra ${unique}`)
    await evidence(page, info, 'profile')
  } finally {
    if (savedProfile) expect((await requestMutation(page.request, '/api/v1/auth/profile/', { full_name: savedProfile.full_name, phone: savedProfile.phone || '', bio: savedProfile.bio || '' }, 'PATCH')).ok()).toBe(true)
    if (savedPreferences) expect((await requestMutation(page.request, '/api/v1/notifications/preferences/', { email_enabled: savedPreferences.email_enabled }, 'PATCH')).ok()).toBe(true)
    await outsider.close()
  }
})

test('Admin đợt cuối: bảng xếp hạng dùng điểm đóng góp thật và giữ riêng tư tài khoản', async ({ page, browser }, info) => {
  page.on('pageerror', error => { throw error })
  const organizer = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    const response = await requestMutation(organizer.request, '/api/v1/auth/login/', {
      identifier: process.env.E2E_ATTENDANCE_ORGANIZER, password: process.env.E2E_ATTENDANCE_PASSWORD,
    })
    expect(response.status()).toBe(200)
    const fixture = JSON.parse(process.env.E2E_ATTENDANCE_FIXTURES)[info.project.name].feedback
    const contributions = await get(organizer.request, `/api/v1/organizer/activities/${fixture.activity}/contributions/`)
    expect(contributions.results).toHaveLength(1)
    const attended = contributions.results[0]
    const scored = await requestMutation(organizer.request, `/api/v1/organizer/activities/${fixture.activity}/contributions/${attended.id}/`, {
      score: 8, revision: attended.contribution?.revision || 0, reason: 'Đối chiếu bảng xếp hạng quản trị',
    })
    expect(scored.status(), await scored.text()).toBe(200)
    await login(page.request)
    const board = await get(page.request, '/api/v1/leaderboard/')
    expect(board.results.length).toBeGreaterThan(0)
    expect(JSON.stringify(board.results)).not.toContain(process.env.E2E_ATTENDANCE_VOLUNTEER)
    await page.goto('/bang-xep-hang')
    await expect(page.locator('.lb-admin').getByRole('heading', { name: 'Bảng xếp hạng tình nguyện viên', exact: true })).toBeVisible()
    await expect(page.locator('.lb-row')).toHaveCount(board.results.length)
    for (const [index, item] of board.results.entries()) {
      const row = page.locator('.lb-row').nth(index)
      await expect(row.locator('.lb-rank')).toHaveText(`#${item.rank}`)
      await expect(row.locator('.lb-score strong')).toHaveText(String(item.total_score))
      await expect(row.locator('.lb-name > strong')).toContainText(item.full_name)
    }
    await expect(page.locator('.lb-admin')).not.toContainText(process.env.E2E_ATTENDANCE_VOLUNTEER)
    await expect(page.locator('.lb-personal')).toHaveCount(0)
    await evidence(page, info, 'leaderboard')
  } finally { await organizer.close() }
})
