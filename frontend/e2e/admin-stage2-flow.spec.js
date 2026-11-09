import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const password = 'River-Community-493!'

async function requestPost(request, url, data, instant) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { data, headers: {
    'X-CSRFToken': csrfToken,
    ...(instant ? { 'X-E2E-Time': new Date(instant).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY } : {}),
  } })
}

async function post(request, url, data, instant) {
  const response = await requestPost(request, url, data, instant)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function get(request, url) {
  const response = await request.get(url)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function account(request, role, fullName) {
  return post(request, '/api/v1/auth/register/', {
    email: `admin-stage2.${randomUUID()}@example.invalid`, full_name: fullName, role,
    password, password_confirm: password,
  })
}

async function adminLogin(request) {
  return post(request, '/api/v1/auth/login/', {
    identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD,
  })
}

async function activity(request, title, { start, end, before }) {
  return post(request, '/api/v1/organizer/activities/', {
    title, description: 'Hướng dẫn kỹ năng số cho cộng đồng và hỗ trợ người lớn tuổi sử dụng điện thoại.',
    address: 'Phòng sinh hoạt cộng đồng Sơn Trà, Đà Nẵng', capacity: 5, required_skills: [],
    starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
  }, before)
}

async function filterActivities(page, search, status = '') {
  const form = page.getByRole('form', { name: 'Bộ lọc hoạt động' })
  await form.getByLabel('Tìm hoạt động', { exact: true }).fill(search)
  await form.getByLabel('Trạng thái hoạt động', { exact: true }).selectOption(status)
  await form.getByRole('button', { name: 'Áp dụng', exact: true }).click()
}

async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: ${width}px`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => scrollTo(0, 0))
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/admin-stage2-flow'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-admin-stage2-${name}.png`), fullPage: true })
}

test('Admin đợt 2: danh sách thật, bộ lọc, phân trang và kết quả chỉ đọc đúng phạm vi', async ({ page, browser }, info) => {
  test.setTimeout(180000)
  page.on('pageerror', error => { throw error })
  const settings = { baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport }
  const organizer = await browser.newContext(settings)
  const outsider = await browser.newContext(settings)
  try {
    const unique = `stage2-${randomUUID().slice(0, 8)}`
    const organizerName = `Nhóm hoạt động ${unique}`
    await account(organizer.request, 'organizer', organizerName)
    await account(outsider.request, 'organizer', `Nhóm độc lập ${unique}`)
    const now = Date.now()
    const timing = { before: now - 4 * 3600000, start: now - 3 * 3600000, end: now - 2 * 3600000 }
    for (let index = 1; index <= 12; index += 1) await activity(organizer.request, `${unique} bản nháp ${index}`, timing)
    const published = await activity(organizer.request, `${unique} công khai`, timing)
    await post(organizer.request, `/api/v1/organizer/activities/${published.id}/status/`, { status: 'published' }, timing.before)
    const completed = await activity(organizer.request, `${unique} hoàn thành`, timing)
    await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/status/`, { status: 'published' }, timing.before)
    await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/status/`, { status: 'completed' })
    await adminLogin(page.request)
    await page.goto('/bao-cao/hoat-dong')
    await expect(page.getByRole('heading', { name: 'Hoạt động toàn hệ thống', exact: true })).toBeVisible()
    await filterActivities(page, unique)
    await expect(page.locator('.ad-system-activity-row')).toHaveCount(12)
    const filtered = await get(page.request, `/api/v1/reports/activities/?search=${unique}&page_size=12`)
    expect(filtered.count).toBe(14)
    await expect(page.locator('.ad-system-activity-results')).toContainText('14 hoạt động')
    await expect(page.locator('.ad-system-activity-row').first()).toContainText(organizerName)
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.locator('.ad-system-activity-row')).toHaveCount(2)
    await filterActivities(page, unique, 'published')
    await expect(page.locator('.ad-system-activity-row')).toHaveCount(1)
    await expect(page.locator('.ad-system-activity-row')).toContainText(published.title)
    expect(new URL(page.url()).searchParams.get('page')).not.toBe('2')
    await page.goBack()
    await expect(page.getByLabel('Trạng thái hoạt động', { exact: true })).toHaveValue('')
    await expect(page.locator('.ad-system-activity-row')).toHaveCount(2)
    await page.goForward()
    await expect(page.getByLabel('Trạng thái hoạt động', { exact: true })).toHaveValue('published')
    const row = page.locator('.ad-system-activity-row')
    await row.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/bao-cao/hoat-dong/${published.id}$`))
    await expect(page.getByRole('heading', { name: 'Kết quả hoạt động', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: published.title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Soạn bản nháp AI', exact: true })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveAttribute('href', `/hoat-dong/${published.id}`)
    for (const key of ['registered', 'approved', 'attended_completed']) {
      await expect(page.locator(`.ad-result-metric[href*="metric=${key}&activity=${published.id}"]`).locator('strong')).toHaveText('0')
    }
    await page.goto(`/bao-cao/hoat-dong?search=${unique}&status=completed`)
    await expect(page.locator('.ad-system-activity-row')).toHaveCount(1)
    await capture(page, info, 'activities-filtered')
    await page.locator('.ad-system-activity-row').click()
    await expect(page.getByRole('heading', { name: completed.title, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Mẫu báo cáo tổng kết', exact: true })).toHaveAttribute('href', `/bao-cao/hoat-dong/${completed.id}/tong-ket`)
    await expect(page.getByRole('link', { name: 'Soạn bản nháp AI', exact: true })).toHaveAttribute('href', `/bao-cao/hoat-dong/${completed.id}/tong-ket#ban-nhap-ai`)
    await expect(page.getByRole('link', { name: 'Xem hoạt động', exact: true })).toHaveCount(0)
    await capture(page, info, 'activity-result')
    const metric = page.locator(`.ad-result-metric[href*="metric=registered&activity=${completed.id}"]`)
    await metric.click()
    expect(new URL(page.url()).pathname).toBe('/bao-cao/dang-ky')
    expect(new URL(page.url()).searchParams.get('activity')).toBe(completed.id)
    expect((await get(page.request, `/api/v1/reports/participations/?metric=registered&activity=${completed.id}`)).count).toBe(0)
    expect((await organizer.request.get(`/api/v1/reports/activities/${completed.id}/`)).status()).toBe(200)
    expect((await outsider.request.get(`/api/v1/reports/activities/${completed.id}/`)).status()).toBe(404)
    const organizerPage = await organizer.newPage()
    await organizerPage.goto(`/bao-cao/hoat-dong/${completed.id}`)
    await expect(organizerPage.locator('.ad-activity-result')).toHaveCount(0)
    await expect(organizerPage.getByRole('heading', { name: 'Kết quả hoạt động', exact: true })).toBeVisible()
  } finally {
    await organizer.close()
    await outsider.close()
  }
})

test('Admin đợt 2: đọc và ẩn phản hồi đúng hoạt động, lưu lý do và làm mới nguồn phân tích', async ({ page, browser }, info) => {
  test.setTimeout(180000)
  page.on('pageerror', error => { throw error })
  const settings = { baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport }
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext(settings)))
  try {
    const [organizer, first, second] = contexts
    const unique = randomUUID().slice(0, 8)
    const author = `Người góp ý ${unique}`
    await account(organizer.request, 'organizer', `Nhóm phản hồi ${unique}`)
    await account(first.request, 'volunteer', `Người hỗ trợ ${unique}`)
    const secondAccount = await account(second.request, 'volunteer', author)
    const now = Date.now()
    const timing = { before: now - 4 * 3600000, start: now - 3 * 3600000, end: now - 2 * 3600000 }
    const completed = await activity(organizer.request, `Chương trình phản hồi đợt 2 ${unique}`, timing)
    await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/status/`, { status: 'published' }, timing.before)
    for (const context of [first, second]) {
      const { participation } = await post(context.request, `/api/v1/activities/${completed.id}/participation/`, {}, timing.before)
      await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/applicants/${participation.id}/review/`, { status: 'approved' }, timing.before)
      await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/attendance/${participation.id}/`, {}, timing.start + 60000)
    }
    await post(organizer.request, `/api/v1/organizer/activities/${completed.id}/status/`, { status: 'completed' })
    const positive = await post(first.request, `/api/v1/activities/${completed.id}/feedback/`, {
      rating: 5, content: 'Các bạn hướng dẫn tận tình và rõ ràng. Tôi đã biết gọi video để trò chuyện với gia đình.',
    })
    const improvement = await post(second.request, `/api/v1/activities/${completed.id}/feedback/`, {
      rating: 2, content: `Phòng sinh hoạt còn chật và đường truyền mạng thiếu ổn định. Mong nhóm kiểm tra thiết bị trước chương trình sau. Mã góp ý ${unique}.`,
    })
    const organizerUrl = `/api/v1/organizer/activities/${completed.id}/feedback/`
    expect((await get(organizer.request, organizerUrl)).summary).toEqual({ count: 2, average_rating: 3.5 })
    await adminLogin(page.request)
    await page.goto(`/bao-cao/hoat-dong/${completed.id}`)
    for (const key of ['registered', 'approved', 'attended_completed']) {
      await expect(page.locator(`.ad-result-metric[href*="metric=${key}&activity=${completed.id}"]`).locator('strong')).toHaveText('2')
    }
    const feedbackLink = page.locator(`a[href*="/quan-tri/phan-hoi?"][href*="activity=${completed.id}"][href*="status=visible"]`).first()
    await expect(feedbackLink).toBeVisible()
    await feedbackLink.click()
    await expect(page.getByRole('heading', { name: 'Kiểm duyệt phản hồi', exact: true })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('activity')).toBe(completed.id)
    expect(new URL(page.url()).searchParams.get('status')).toBe('visible')
    await expect(page.locator('.ad-feedback-results')).toContainText('2 phản hồi')
    await expect(page.locator('.ad-feedback-row')).toHaveCount(2)
    let row = page.locator('.ad-feedback-row').filter({ hasText: author })
    await expect(row).toContainText(completed.title)
    await expect(row).toContainText('Phòng sinh hoạt còn chật')
    await row.focus()
    await page.keyboard.press('Enter')
    const detail = page.getByRole('dialog', { name: `Phản hồi của ${author}`, exact: true })
    await expect(detail).toContainText(improvement.content)
    await expect(detail.getByRole('button', { name: 'Ẩn phản hồi', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(detail).toHaveCount(0)
    await expect(row).toBeFocused()

    const panel = page.locator('.feedback-ai-panel')
    const analysisUrl = '/api/v1/admin/feedback/ai-analysis/'
    const analysisResponse = page.waitForResponse(response => response.url().endsWith(analysisUrl) && response.request().method() === 'POST')
    await panel.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
    const originalResponse = await analysisResponse
    expect(originalResponse.request().postDataJSON()).toEqual({ status: 'visible', activity: completed.id })
    const originalAnalysis = await originalResponse.json()
    expect(originalAnalysis.scope.feedback_count).toBe(2)
    await expect(panel.getByRole('button', { name: 'Phân tích lại', exact: true })).toBeVisible()
    await capture(page, info, 'feedback-visible')
    await row.getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
    const hide = page.getByRole('dialog', { name: 'Ẩn phản hồi', exact: true })
    await expect(hide).toBeVisible()
    await expect(page.getByRole('dialog', { name: `Phản hồi của ${author}`, exact: true })).toHaveCount(0)
    const confirm = hide.getByRole('button', { name: 'Xác nhận ẩn phản hồi', exact: true })
    await expect(confirm).toBeDisabled()
    await hide.getByLabel('Lý do ẩn phản hồi', { exact: true }).fill('   ')
    await expect(confirm).toBeDisabled()
    const reason = `Đã đối chiếu nội dung với người gửi trong kiểm tra đợt 2 ${unique}.`
    await hide.getByLabel('Lý do ẩn phản hồi', { exact: true }).fill(`  ${reason}  `)
    const hideResponse = page.waitForResponse(response => response.url().endsWith(`/admin/feedback/${improvement.id}/hide/`) && response.request().method() === 'POST')
    await confirm.click()
    expect((await hideResponse).status()).toBe(200)
    await expect(hide).toHaveCount(0)
    await expect(page.locator('.ad-feedback-results')).toContainText('1 phản hồi')
    await expect(page.locator('.ad-feedback-row')).toHaveCount(1)
    await expect(page.locator('.ad-feedback-row')).toContainText(positive.volunteer_name)
    expect(new URL(page.url()).searchParams.get('activity')).toBe(completed.id)
    expect(new URL(page.url()).searchParams.get('status')).toBe('visible')
    await expect(panel.getByRole('button', { name: 'Phân tích AI', exact: true })).toBeVisible()
    const analysisAfterResponse = page.waitForResponse(response => response.url().endsWith(analysisUrl) && response.request().method() === 'POST')
    await panel.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
    const refreshedAnalysis = await (await analysisAfterResponse).json()
    expect(refreshedAnalysis.scope.feedback_count).toBe(1)
    expect(refreshedAnalysis.source_fingerprint).not.toBe(originalAnalysis.source_fingerprint)
    expect(JSON.stringify(refreshedAnalysis)).not.toContain(improvement.content)
    const current = await get(organizer.request, organizerUrl)
    expect(current.count).toBe(1)
    expect(current.summary).toEqual({ count: 1, average_rating: 5 })
    expect(current.results[0].id).toBe(positive.id)
    const own = await get(second.request, `/api/v1/activities/${completed.id}/feedback/`)
    expect(own.feedback).toMatchObject({ id: improvement.id, is_hidden: true, hidden_reason: reason })
    const audit = await get(page.request, `/api/v1/admin/audit/?action=feedback_hidden&object_id=${improvement.id}&activity=${completed.id}`)
    expect(audit.count).toBe(1)
    expect(audit.results[0]).toMatchObject({ reason, subject: secondAccount.user.id })
    const result = await get(page.request, `/api/v1/reports/activities/${completed.id}/`)
    expect(result.metrics.feedback).toEqual({ count: 1, average_rating: 5 })
    expect((await organizer.request.get('/api/v1/admin/feedback/')).status()).toBe(403)
    expect((await first.request.get('/api/v1/admin/feedback/')).status()).toBe(403)

    await page.getByRole('button', { name: 'Đã ẩn', exact: true }).click()
    await expect(page.locator('.ad-feedback-row')).toHaveCount(1)
    expect(new URL(page.url()).searchParams.get('activity')).toBe(completed.id)
    row = page.locator('.ad-feedback-row')
    await expect(row.getByRole('button', { name: 'Ẩn phản hồi', exact: true })).toHaveCount(0)
    await row.click()
    const hiddenDetail = page.getByRole('dialog', { name: `Phản hồi của ${author}`, exact: true })
    await expect(hiddenDetail).toContainText(reason)
    await expect(hiddenDetail).toContainText(improvement.content)
    await page.keyboard.press('Escape')
    await capture(page, info, 'feedback-hidden')
    const organizerPage = await organizer.newPage()
    await organizerPage.goto(`/nha-to-chuc/hoat-dong/${completed.id}/phan-hoi`)
    await expect(organizerPage.getByRole('heading', { name: 'Phản hồi hoạt động', exact: true })).toBeVisible()
    await expect(organizerPage.locator('.ad-feedback')).toHaveCount(0)
    await expect(organizerPage.locator('.organizer-feedback-row')).toHaveCount(1)
    await expect(organizerPage.locator('.organizer-feedback-row')).toContainText(positive.content)
    await expect(organizerPage.getByRole('button', { name: 'Ẩn phản hồi', exact: true })).toHaveCount(0)
  } finally {
    await Promise.all(contexts.map(context => context.close()))
  }
})
