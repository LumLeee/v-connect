import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const model = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const revision = 'faf4aa4225822f3bc6376869cb1164e8e3feedd0'

async function requestPost(request, url, data, instant = null) {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  return request.post(url, { data, headers: { 'X-CSRFToken': csrfToken,
    ...(instant ? { 'X-E2E-Time': new Date(instant).toISOString(), 'X-E2E-Clock-Key': process.env.E2E_CLOCK_KEY } : {}) } })
}

async function post(request, url, data, instant = null) {
  const response = await requestPost(request, url, data, instant)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function get(request, url) {
  const response = await request.get(url)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function account(request, role, name) {
  return post(request, '/api/v1/auth/register/', { email: `remaining-ai.${randomUUID()}@example.invalid`, role, full_name: name,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!' })
}

function expectRealAI(value) {
  expect(value.ai).toEqual({ status: 'active', reason: null, model, revision })
  expect(value.source_fingerprint).toMatch(/^[0-9a-f]{64}$/)
}

function expectEvidence(evidence, rows) {
  expect(evidence.length).toBeGreaterThan(0)
  for (const item of evidence) {
    const source = rows.find(row => row.id === item.feedback_id)
    expect(source, `source for ${item.feedback_id}`).toBeTruthy()
    expect(source.content).toContain(item.quote)
  }
}

async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/remaining-ai-flow'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-${name}.png`), fullPage: true })
}

test('AI thật phân tích phản hồi, soạn bản nháp có căn cứ và loại phản hồi vừa ẩn khỏi nguồn', async ({ page, browser }, info) => {
  test.skip(process.env.E2E_REMAINING_AI !== 'true', 'Cần backend bật mô hình embedding đa ngôn ngữ thật.')
  test.setTimeout(240000)
  page.on('pageerror', error => { throw error })
  const contexts = await Promise.all([0, 1, 2].map(() => browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })))
  try {
    const [first, second, admin] = contexts
    await account(page.request, 'organizer', 'Nhóm báo cáo AI')
    await account(first.request, 'volunteer', 'Người hỗ trợ chương trình')
    await account(second.request, 'volunteer', 'Người góp ý chương trình')
    await post(admin.request, '/api/v1/auth/login/', { identifier: process.env.E2E_ADMIN_USERNAME, password: process.env.E2E_ADMIN_PASSWORD })
    const now = Date.now(), before = now - 3 * 3600000, start = now - 2 * 3600000, end = now - 3600000
    const activity = await post(page.request, '/api/v1/organizer/activities/', {
      title: `Kết nối số báo cáo AI ${randomUUID().slice(0, 8)}`, description: 'Hướng dẫn người lớn tuổi sử dụng điện thoại và gọi video cho gia đình.',
      address: 'Phòng sinh hoạt cộng đồng tại Sơn Trà, Đà Nẵng', capacity: 5, required_skills: [],
      starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(),
    }, before)
    await post(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' }, before)
    for (const context of [first, second]) {
      const { participation } = await post(context.request, `/api/v1/activities/${activity.id}/participation/`, {}, before)
      await post(page.request, `/api/v1/organizer/activities/${activity.id}/applicants/${participation.id}/review/`, { status: 'approved' }, before)
      await post(page.request, `/api/v1/organizer/activities/${activity.id}/attendance/${participation.id}/`, {}, start + 60000)
    }
    await post(page.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'completed' })
    const positive = await post(first.request, `/api/v1/activities/${activity.id}/feedback/`, { rating: 5, content: 'Các bạn hướng dẫn rất tận tình và rõ ràng. Tôi đã biết gọi video để trò chuyện với con cháu.' })
    const improvement = await post(second.request, `/api/v1/activities/${activity.id}/feedback/`, { rating: 2, content: 'Phòng sinh hoạt quá chật và mạng Internet chập chờn. Mong lần sau chuẩn bị đường truyền tốt hơn.' })
    const rows = [positive, improvement]
    const feedbackUrl = `/api/v1/organizer/activities/${activity.id}/feedback/`
    const analysisUrl = `${feedbackUrl}ai-analysis/`
    const summaryUrl = `/api/v1/reports/activities/${activity.id}/summary-document/`
    const draftUrl = `/api/v1/reports/activities/${activity.id}/ai-draft/`
    const originalList = await get(page.request, feedbackUrl)
    expect(originalList.count).toBe(2)
    const original = await get(page.request, summaryUrl)
    expect(original.metrics.registered).toBe(2)
    expect(original.metrics.approved).toBe(2)
    expect(original.metrics.attended_completed).toBe(2)
    expect(original.metrics.feedback).toEqual({ count: 2, average_rating: 3.5 })

    await page.goto(`/nha-to-chuc/hoat-dong/${activity.id}/phan-hoi`)
    const analysisResponse = page.waitForResponse(response => response.url().endsWith(analysisUrl) && response.request().method() === 'POST')
    await page.locator('.feedback-ai-panel').getByRole('button', { name: 'Phân tích AI', exact: true }).click()
    const analysis = await (await analysisResponse).json()
    expectRealAI(analysis)
    expect(analysis.scope.feedback_count).toBe(2)
    expect(analysis.scope.analyzed_count).toBe(2)
    expect(analysis.scope.truncated).toBe(false)
    expect(analysis.sentiments.reduce((total, item) => total + item.count, 0)).toBe(2)
    expectEvidence(analysis.summary.evidence, rows)
    await expect(page.locator('.feedback-ai-panel').getByRole('status', { name: 'Trạng thái AI' })).toContainText('AI trên backend')
    await page.locator('.feedback-ai-panel').getByText('Phản hồi làm căn cứ cho trích dẫn', { exact: true }).click()
    await capture(page, info, 'feedback-ai-real')

    await page.goto(`/bao-cao/hoat-dong/${activity.id}/tong-ket`)
    const draftResponse = page.waitForResponse(response => response.url().endsWith(draftUrl) && response.request().method() === 'POST')
    await page.locator('.report-ai-panel').getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
    const draft = await (await draftResponse).json()
    expectRealAI(draft)
    expect(draft.source.summary_fingerprint).toBe(original.source_fingerprint)
    expect(draft.source.metrics).toEqual(original.metrics)
    expect(draft.source.contributions).toEqual(original.contributions)
    expect(draft.source.feedback_count).toBe(2)
    expectEvidence(draft.evidence, rows)
    const participationText = draft.draft.sections.find(section => section.key === 'participation').text
    expect(participationText).toContain('2 đơn đăng ký')
    expect(participationText).toContain('2 người được duyệt và đã điểm danh')
    await expect(page.locator('.report-ai-panel').getByRole('status', { name: 'Trạng thái AI' })).toContainText('AI trên backend')
    const editor = page.locator('.report-ai-panel').getByLabel('Đăng ký và tham gia', { exact: true })
    await editor.fill(`${participationText}\nĐã rà soát dữ liệu của chương trình.`)
    await capture(page, info, 'report-ai-real-edited')
    const afterDraft = await get(page.request, feedbackUrl)
    expect(afterDraft).toEqual(originalList)
    expect((await get(page.request, summaryUrl)).metrics).toEqual(original.metrics)
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.report-ai-panel')).toBeHidden()
    await expect(page.locator('.summary-sheet')).not.toContainText('Đã rà soát dữ liệu của chương trình.')
    await page.emulateMedia({ media: 'screen' })

    await post(admin.request, `/api/v1/admin/feedback/${improvement.id}/hide/`, { reason: 'Đã đối chiếu nội dung với người gửi trong kiểm thử.' })
    const stale = await requestPost(page.request, draftUrl, { expected_source_fingerprint: original.source_fingerprint })
    expect(stale.status()).toBe(409)
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(page.locator('.report-ai-panel').getByRole('alert')).toContainText('Số liệu đang xem đã thay đổi')
    await expect(page.locator('.report-ai-panel').getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeDisabled()
    await expect(editor).toHaveValue(`${participationText}\nĐã rà soát dữ liệu của chương trình.`)
    const refreshed = await get(page.request, summaryUrl)
    expect(refreshed.metrics.feedback).toEqual({ count: 1, average_rating: 5 })
    const currentDraft = await post(page.request, draftUrl, { expected_source_fingerprint: refreshed.source_fingerprint })
    expectRealAI(currentDraft)
    expect(currentDraft.source.feedback_count).toBe(1)
    expect(currentDraft.source_fingerprint).not.toBe(draft.source_fingerprint)
    expectEvidence(currentDraft.evidence, [positive])
    expect(JSON.stringify(currentDraft)).not.toContain(improvement.content)
    expect(JSON.stringify(currentDraft.evidence)).not.toContain(improvement.id)
    const currentAnalysis = await post(page.request, analysisUrl, { rating: 'all', ordering: 'newest' })
    expectRealAI(currentAnalysis)
    expect(currentAnalysis.scope.feedback_count).toBe(1)
    expect(currentAnalysis.source_fingerprint).not.toBe(analysis.source_fingerprint)
    expectEvidence(currentAnalysis.summary.evidence, [positive])
    expect(JSON.stringify(currentAnalysis)).not.toContain(improvement.content)
    expect(JSON.stringify(currentAnalysis)).not.toContain(improvement.id)
    expect((await get(page.request, feedbackUrl)).count).toBe(1)
  } finally { await Promise.all(contexts.map(context => context.close())) }
})
