import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const id = 'remaining-ai-activity'
const feedbackPath = `/nha-to-chuc/hoat-dong/${id}/phan-hoi`
const summaryPath = `/bao-cao/hoat-dong/${id}/tong-ket`
const activity = { id, title: 'Kết nối số cùng cộng đồng', organizer_name: 'Nhóm cộng đồng', status: 'completed', capacity: 12, approved_count: 10,
  starts_at: '2026-10-01T01:00:00Z', ends_at: '2026-10-01T05:00:00Z', address: 'Sơn Trà, Đà Nẵng', description: 'Hướng dẫn người lớn tuổi sử dụng điện thoại.', skill_details: [], timeline: [] }
const metrics = { registered: 12, approved: 10, pending: 0, rejected: 1, cancelled: 1, attended_completed: 8, attended_ongoing: 0, attended_cancelled: 0, feedback: { count: 2, average_rating: 3 } }
const feedback = { id: 'feedback-ai-one', volunteer_name: 'Người tham gia', activity_title: activity.title, rating: 3, content: 'Hướng dẫn hữu ích, nhưng phòng hơi chật.', created_at: '2026-10-01T07:00:00Z', is_hidden: false }
const generatedAt = '2026-11-01T09:00:00Z'
const active = { status: 'active', reason: null, model: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2' }

async function fixtures(page, role = 'organizer') {
  const state = { analysisPosts: [], draftPosts: [], hidePosts: [], feedbackGets: [], ai: active, feedbackFailure: false, draftFailure: 0, fingerprint: 'snapshot-one', malformed: false }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.__denyClipboard) throw new Error('Clipboard not available')
      window.__copiedDraft = text
    } } })
  })
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: `remaining-ai-${role}`, full_name: 'Người kiểm tra', email: 'ui@example.invalid', role } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'remaining-ai-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith('/feedback/ai-analysis/')) {
      state.analysisPosts.push(request.postDataJSON())
      if (state.feedbackFailure) return route.fulfill({ status: 503, json: { detail: 'secret-model-path' } })
      const content = state.malformed ? '<img src=x onerror="window.aiInjected=true">' : feedback.content
      data = { method: 'local_feedback_embeddings_v1', ai: state.ai, generated_at: generatedAt, source_fingerprint: 'feedback-source',
        scope: { activity_id: role === 'admin' ? null : id, feedback_count: 20, analyzed_count: 2, truncated: true, filters: request.postDataJSON() },
        summary: { text: content, source_feedback_ids: [feedback.id], evidence: [{ feedback_id: feedback.id, quote: content }] },
        sentiments: [{ key: 'positive', label: 'Tích cực', count: 1 }, { key: 'neutral', label: 'Trung lập', count: 0 }, { key: 'negative', label: 'Tiêu cực', count: 1 }, { key: 'uncertain', label: 'Chưa rõ', count: 0 }],
        topics: [{ key: 'organization', label: 'Tổ chức chương trình', count: 2, feedback_ids: [feedback.id] }],
        review_items: [{ feedback_id: feedback.id, content, label: 'Cần xem lại nội dung', reason: 'Đây là gợi ý rà soát, không phải kết luận vi phạm.' }], limitations: ['Sắc thái là gợi ý, cần đọc phản hồi gốc.'] }
    } else if (/\/admin\/feedback\/[^/]+\/hide\/$/.test(url.pathname)) {
      state.hidePosts.push(request.postDataJSON()); data = { ...feedback, is_hidden: true }
    } else if (url.pathname.endsWith('/feedback/')) {
      state.feedbackGets.push(url.search)
      data = { count: 20, next: 'next', previous: url.searchParams.get('page') === '2' ? 'previous' : null, summary: { count: 20, average_rating: 3 }, results: [{ ...feedback, is_hidden: state.hidePosts.length > 0, hidden_at: generatedAt, hidden_by_name: 'Người kiểm tra', hidden_reason: 'Đã đối chiếu nội dung.' }] }
    } else if (url.pathname.endsWith('/summary-document/')) data = { activity, metrics: state.fingerprint === 'snapshot-one' ? metrics : { ...metrics, registered: 13 }, contributions: { score: 48, confirmed: 6, pending: 2 }, prepared_by: 'Người lập báo cáo', generated_at: generatedAt, source_fingerprint: state.fingerprint }
    else if (url.pathname.endsWith('/ai-draft/')) {
      state.draftPosts.push(request.postDataJSON())
      if (state.draftFailure) return route.fulfill({ status: state.draftFailure, json: {} })
      data = { ai: state.ai, generated_at: generatedAt, source_fingerprint: 'draft-source', source: { summary_fingerprint: state.fingerprint, activity_id: id, feedback_count: 2, analyzed_count: state.ai.status === 'active' ? 2 : 0, truncated: false },
        draft: { title: `Báo cáo tổng kết: ${activity.title}`, sections: [{ key: 'participation', title: 'Đăng ký và tham gia', text: `Hoạt động ghi nhận ${state.fingerprint === 'snapshot-one' ? 12 : 13} đơn đăng ký, 8 người đã tham gia.`, source_refs: [] }, { key: 'feedback', title: 'Phản hồi của người tham gia', text: feedback.content, source_refs: [feedback.id] }] },
        evidence: state.ai.status === 'active' ? [{ feedback_id: feedback.id, quote: feedback.content, rating: 3 }] : [], limitations: ['AI chỉ chọn trích dẫn; số liệu dùng mẫu có căn cứ, không phải mô hình sinh văn bản.'] }
    } else if (url.pathname.endsWith(`/activities/${id}/`)) data = activity
    else throw new Error(`Unexpected remaining AI request: ${request.method()} ${url.pathname}`)
    return route.fulfill({ json: data })
  })
  return state
}

async function assertFits(page) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
  }
}

async function capture(page, info, label) {
  await page.setViewportSize(info.project.use.viewport)
  const output = process.env.E2E_ARTIFACT_DIR || '../tmp/remaining-ai-preview'
  await mkdir(output, { recursive: true })
  await page.screenshot({ path: path.join(output, `${info.project.name}-${label}.png`), fullPage: true })
}

test('AI phản hồi: phân tích theo bộ lọc trên mọi trang, có căn cứ và xóa ảnh chụp khi làm mới', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(`${feedbackPath}?rating=3&ordering=oldest`)
  const panel = page.locator('.feedback-ai-panel')
  await expect(panel.getByRole('button', { name: 'Phân tích AI', exact: true })).toBeEnabled()
  expect(state.analysisPosts).toEqual([])
  await panel.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect(panel.getByRole('status', { name: 'Trạng thái AI' })).toContainText('AI trên backend')
  expect(state.analysisPosts).toEqual([{ rating: '3', ordering: 'oldest' }])
  await expect(panel).toContainText('3 sao, cũ nhất trước, trên tất cả các trang')
  await expect(panel).toContainText('Đã xem 2/20 phản hồi')
  await expect(panel).toContainText('không đại diện cho toàn bộ danh sách')
  await expect(panel.locator('.feedback-ai-counts dd')).toHaveText(['1', '0', '1', '0'])
  await panel.locator('summary').filter({ hasText: 'Phản hồi làm căn cứ' }).click()
  await expect(panel.locator('blockquote').first()).toHaveText(feedback.content)
  await panel.locator('summary').filter({ hasText: 'Nội dung cần bạn xem lại' }).click()
  await expect(panel).toContainText('AI không tự ẩn phản hồi')
  expect(state.hidePosts).toEqual([])
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(panel.getByRole('status', { name: 'Trạng thái AI' })).toBeVisible()
  expect(state.analysisPosts).toHaveLength(1)
  await assertFits(page); await capture(page, info, 'feedback-ai')
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.locator('.feedback-ai-panel .local-ai-status')).toHaveCount(0)
  await expect(page.locator('.feedback-ai-panel .feedback-ai-counts')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Mức đánh giá', exact: true }).selectOption('5')
  await page.locator('.feedback-ai-panel').getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect.poll(() => state.analysisPosts.at(-1)).toEqual({ rating: '5', ordering: 'oldest' })
})

test('AI kiểm duyệt: không tự ẩn, vẫn yêu cầu lý do và mất kết quả cũ sau thao tác', async ({ page }) => {
  const state = await fixtures(page, 'admin')
  await page.goto('/quan-tri/phan-hoi?status=visible')
  await page.locator('.feedback-ai-panel').getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect.poll(() => state.analysisPosts).toEqual([{ status: 'visible' }])
  await expect(page.locator('.feedback-ai-panel')).toContainText('phản hồi chưa ẩn')
  expect(state.hidePosts).toEqual([])
  await page.locator('.activity-card').getByRole('button', { name: 'Ẩn phản hồi', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Ẩn phản hồi', exact: true })
  await expect(dialog.getByRole('button', { name: 'Xác nhận ẩn phản hồi', exact: true })).toBeDisabled()
  await dialog.getByLabel('Lý do ẩn phản hồi', { exact: true }).fill('Đã đọc phản hồi và đối chiếu quy định.')
  expect(state.hidePosts).toEqual([])
  await dialog.getByRole('button', { name: 'Xác nhận ẩn phản hồi', exact: true }).click()
  await expect.poll(() => state.hidePosts).toEqual([{ reason: 'Đã đọc phản hồi và đối chiếu quy định.' }])
  await expect(page.locator('.feedback-ai-panel .local-ai-status')).toHaveCount(0)
})

test('AI phản hồi: lỗi, dự phòng và nội dung không tin cậy được hiển thị an toàn', async ({ page }) => {
  const state = await fixtures(page)
  state.feedbackFailure = true
  await page.goto(feedbackPath)
  const panel = page.locator('.feedback-ai-panel')
  await panel.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Máy chủ gặp lỗi')
  await expect(page.locator('body')).not.toContainText('secret-model-path')
  state.feedbackFailure = false; state.malformed = true; state.ai = { status: 'fallback', reason: 'secret-model-path' }
  await panel.getByRole('button', { name: 'Phân tích AI', exact: true }).click()
  await expect(panel.getByRole('status', { name: 'Trạng thái AI' })).toContainText('AI hiện chưa sẵn sàng')
  await expect(panel.getByRole('status', { name: 'Trạng thái AI' })).not.toContainText('AI trên backend')
  await expect(panel.locator('.feedback-ai-summary')).toContainText('<img src=x onerror="window.aiInjected=true">')
  await panel.locator('summary').filter({ hasText: 'Nội dung cần bạn xem lại' }).click()
  await expect(panel.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => window.aiInjected)).toBeUndefined()
  await expect(panel).not.toContainText('secret-model-path')
  await assertFits(page)
})

test('Bản nháp AI: dùng đúng ảnh chụp số liệu, sửa và sao chép, giữ bản sửa khi hủy hoặc tạo lại lỗi', async ({ page }, info) => {
  const state = await fixtures(page)
  await page.goto(summaryPath)
  const panel = page.locator('.report-ai-panel')
  await expect(panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true })).toBeEnabled()
  expect(state.draftPosts).toEqual([])
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Hoạt động ghi nhận 12 đơn đăng ký, 8 người đã tham gia.')
  expect(state.draftPosts).toEqual([{ expected_source_fingerprint: 'snapshot-one' }])
  await panel.getByLabel('Đăng ký và tham gia', { exact: true }).fill('Đã đối chiếu: 8 người tham gia có điểm danh.')
  await panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__copiedDraft)).toContain('Đã đối chiếu: 8 người tham gia có điểm danh.')
  expect(await page.evaluate(() => window.__copiedDraft)).toContain('Số liệu được lấy lúc')
  expect(await page.evaluate(() => window.__copiedDraft)).not.toContain('đã được người lập rà soát')
  await panel.getByRole('button', { name: 'Tạo lại bản nháp', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Tạo lại bản nháp', exact: true })
  await dialog.getByRole('button', { name: 'Giữ bản đang sửa', exact: true }).click()
  expect(state.draftPosts).toHaveLength(1)
  state.draftFailure = 503
  await panel.getByRole('button', { name: 'Tạo lại bản nháp', exact: true }).click()
  await dialog.getByRole('button', { name: 'Xác nhận tạo lại', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Máy chủ gặp lỗi')
  await dialog.getByRole('button', { name: 'Giữ bản đang sửa', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Đã đối chiếu: 8 người tham gia có điểm danh.')
  await assertFits(page); await capture(page, info, 'report-ai-edited')
})

test('Bản nháp AI: dữ liệu đổi làm bản nháp cũ mất hiệu lực sao chép, tạo lại dùng phiên bản mới', async ({ page }) => {
  const state = await fixtures(page)
  await page.goto(summaryPath)
  const panel = page.locator('.report-ai-panel')
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeEnabled()
  await panel.getByLabel('Tiêu đề bản nháp', { exact: true }).fill('Bản đang sửa')
  state.fingerprint = 'snapshot-two'
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Số liệu đang xem đã thay đổi')
  await expect(panel.getByLabel('Tiêu đề bản nháp', { exact: true })).toHaveValue('Bản đang sửa')
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Tạo lại bản nháp', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận tạo lại', exact: true }).click()
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Hoạt động ghi nhận 13 đơn đăng ký, 8 người đã tham gia.')
  expect(state.draftPosts.at(-1)).toEqual({ expected_source_fingerprint: 'snapshot-two' })
  await expect(panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true })).toBeEnabled()
})

test('Bản nháp AI: tranh chấp nguồn, dự phòng, sao chép thủ công và bản in giữ số liệu gốc', async ({ page }, info) => {
  const state = await fixtures(page, 'admin')
  state.draftFailure = 409
  await page.goto(summaryPath)
  const panel = page.locator('.report-ai-panel')
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('Dữ liệu đã thay đổi')
  await expect(panel.locator('.report-ai-editor')).toHaveCount(0)
  state.draftFailure = 0; state.ai = { status: 'fallback', reason: 'secret-model-path' }
  await panel.getByRole('button', { name: 'Soạn bản nháp AI', exact: true }).click()
  await expect(panel.getByRole('status', { name: 'Trạng thái AI' })).toContainText('AI hiện chưa sẵn sàng')
  await expect(panel.getByLabel('Đăng ký và tham gia', { exact: true })).toHaveValue('Hoạt động ghi nhận 12 đơn đăng ký, 8 người đã tham gia.')
  await expect(panel).not.toContainText('secret-model-path')
  await page.evaluate(() => { window.__denyClipboard = true })
  await panel.getByRole('button', { name: 'Sao chép bản nháp', exact: true }).click()
  await expect(panel.getByLabel('Nội dung để sao chép thủ công', { exact: true })).toHaveValue(/Số liệu được lấy lúc/)
  await panel.getByLabel('Đăng ký và tham gia', { exact: true }).fill('Nội dung nháp đang chỉnh sửa cần kiểm tra.')
  await assertFits(page); await capture(page, info, 'report-ai-fallback')
  await page.emulateMedia({ media: 'print' })
  await expect(panel).toBeHidden()
  await expect(page.locator('.summary-sheet')).toBeVisible()
  await expect(page.locator('.summary-sheet')).not.toContainText('Nội dung nháp đang chỉnh sửa cần kiểm tra.')
  await expect(page.locator('.summary-sheet')).toContainText('12')
})
