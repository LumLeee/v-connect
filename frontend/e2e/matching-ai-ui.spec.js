import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const volunteerBase = '/tinh-nguyen-vien/ghep-noi'
const activity = { id: 'ai-activity', title: 'Kết nối số cho người lớn tuổi', status: 'published', capacity: 12, approved_count: 2,
  starts_at: '2030-11-21T07:00:00Z', ends_at: '2030-11-21T10:00:00Z', address: 'Sơn Trà, Đà Nẵng',
  skill_details: [{ id: 1, name: 'Công nghệ' }, { id: 2, name: 'Giảng dạy' }] }
const managedBase = `/nha-to-chuc/hoat-dong/${activity.id}/ghep-noi`
const model = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const hybridLimits = { skills: 35, interests: 14, availability: 21, semantic: 30 }
const explanation = 'Điểm kết hợp /100: kỹ năng tối đa 35, sở thích 14, lịch rảnh 21, nội dung tương đồng 30. Không phải xác suất được duyệt.'
const note = 'AI không tự đăng ký hoạt động, gửi lời mời hoặc duyệt đơn.'

async function fixtures(page, managed = false) {
  const state = { ai: { status: 'active', reason: null, model }, limits: hybridLimits, method: 'hybrid_embeddings_v1',
    explanation, note, posts: [], gets: [], entries: [{ score: 26.4, rule_score: 0,
      components: { skills: 0, interests: 0, availability: 0, semantic: 26.4 }, semantic: { similarity: 88, score: 26.4 },
      matched_skills: [], matched_interests: [], availability_percent: 0,
      reasons: ['Nội dung hồ sơ và hoạt động có mức tương đồng 88%.'], activity,
      volunteer: { id: 'ai-volunteer', full_name: 'Nguyễn An' }, invitation_status: null,
    }] }
  page.on('pageerror', error => { throw error })
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    let data
    if (url.pathname.endsWith('/auth/me/')) data = { user: { id: 'ai-ui-user', full_name: 'Người kiểm tra', email: 'ui@example.invalid', role: managed ? 'organizer' : 'volunteer' } }
    else if (url.pathname.endsWith('/auth/profile/')) data = { profile: { avatar_url: null } }
    else if (url.pathname.endsWith('/auth/csrf/')) data = { csrfToken: 'ai-ui-csrf' }
    else if (url.pathname.endsWith('/notifications/unread-count/')) data = { count: 0, latest_id: null }
    else if (url.pathname.endsWith(`/activities/${activity.id}/`)) data = activity
    else if (url.pathname.endsWith('/invitations/') && request.method() === 'POST') {
      state.posts.push(request.postDataJSON()); data = { id: 'ai-ui-invitation', status: 'pending' }
    } else if (url.pathname.endsWith('/matching/') || url.pathname.endsWith('/matching/activities/')) {
      state.gets.push(url.search)
      const pageNo = Number(url.searchParams.get('page') || 1), offset = (pageNo - 1) * 12
      data = { count: state.entries.length, results: state.entries.slice(offset, offset + 12),
        next: state.entries.length > offset + 12 ? 'next' : null, previous: pageNo > 1 ? 'previous' : null,
        method: state.method, ai: state.ai, component_limits: state.limits, explanation: state.explanation, note: state.note }
    } else throw new Error(`Unexpected matching AI UI request: ${request.method()} ${url.pathname}`)
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

async function screenshot(page, info, label) {
  await page.setViewportSize(info.project.use.viewport)
  const target = process.env.E2E_ARTIFACT_DIR || '../tmp/matching-ai-preview'
  await mkdir(target, { recursive: true })
  await page.screenshot({ path: path.join(target, `${info.project.name}-${label}.png`), fullPage: true })
}

test('Ghép nối AI: ngữ nghĩa không biến thành kỹ năng đã xác nhận và giữ liên kết hoạt động', async ({ page }, info) => {
  await fixtures(page)
  await page.goto(volunteerBase)
  await expect(page.getByRole('status', { name: 'Phương pháp ghép nối' })).toContainText('AI + quy tắc')
  const first = page.locator('.matching-activity-row').first()
  await expect(first).toContainText('26.4/100 điểm')
  await expect(first.locator('.activity-skill-tags span')).toHaveText(['Công nghệ', 'Giảng dạy'])
  await first.locator('summary').click()
  await expect(first.locator('.matching-score-breakdown dd')).toHaveText(['0/35', '0/14', '0/21', '26.4/30'])
  await expect(first.locator('.matching-semantic-note')).toContainText('88%')
  await expect(first.locator('.matching-semantic-note')).toContainText('không xác nhận kỹ năng hoặc khả năng được duyệt')
  const links = first.getByRole('link')
  await expect(links).toHaveCount(2)
  for (const link of await links.all()) await expect(link).toHaveAttribute('href', `/hoat-dong/${activity.id}`)
  await assertFits(page)
  await screenshot(page, info, 'volunteer-matching-ai')
  await page.getByRole('button', { name: 'Quy tắc', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quy tắc ghép nối' })
  await expect(dialog).toContainText(explanation)
  await expect(dialog).toContainText(note)
  await expect(dialog).toContainText('MiniLM đa ngôn ngữ (L12-v2)')
})

test('Ghép nối AI nhà tổ chức: xem phân tích và gửi lời mời vẫn cần xác nhận', async ({ page }, info) => {
  const state = await fixtures(page, true)
  state.entries[0].matched_skills = ['Công nghệ']
  state.entries[0].components.skills = 35
  state.entries[0].rule_score = 50
  state.entries[0].score = 61.4
  await page.goto(managedBase)
  const row = page.locator('.matching-card').first()
  await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  const details = page.getByRole('dialog', { name: 'Nguyễn An', exact: true })
  await expect(details.locator('.matching-score-breakdown dd')).toHaveText(['35/35', '0/14', '0/21', '26.4/30'])
  await expect(details.locator('.matching-semantic-note')).toContainText('88%')
  await expect(details).toContainText('Kỹ năng phù hợp: Công nghệ.')
  await assertFits(page)
  await screenshot(page, info, 'organizer-matching-ai-details')
  await details.getByRole('button', { name: 'Đóng', exact: true }).click()
  await row.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Xác nhận gửi lời mời' })
  await confirmation.getByLabel('Lời nhắn (không bắt buộc)').fill('Mời bạn hỗ trợ chương trình kết nối số.')
  expect(state.posts).toHaveLength(0)
  await confirmation.getByRole('button', { name: 'Quay lại', exact: true }).click()
  expect(state.posts).toHaveLength(0)
  await row.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Xác nhận gửi lời mời', exact: true }).click()
  await expect(row).toContainText('Lời mời đã được ghi nhận.')
  expect(state.posts).toEqual([{ volunteer: 'ai-volunteer', message: 'Mời bạn hỗ trợ chương trình kết nối số.' }])
  await expect(row.getByRole('link', { name: 'Xem lời mời đã gửi', exact: true })).toHaveAttribute('href', `/nha-to-chuc/hoat-dong/${activity.id}/loi-moi`)
})

test('Ghép nối AI: dự phòng thay toàn bộ thang điểm đúng trang và không lộ lỗi nội bộ', async ({ page }) => {
  const state = await fixtures(page)
  const original = state.entries[0]
  state.entries = Array.from({ length: 13 }, (_, index) => ({ ...original, activity: { ...activity, id: `ai-page-${index}`, title: `Kết nối số ${index + 1}` } }))
  await page.goto(volunteerBase)
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click()
  await expect(page.locator('.matching-activity-row h2')).toHaveText(['Kết nối số 13'])
  state.ai = { status: 'fallback', reason: 'secret-model-path /private/key=should-not-render', model: 'secret-model-path' }
  state.method = 'rules_v1'; state.limits = { skills: 50, interests: 20, availability: 30 }
  state.explanation = 'Điểm quy tắc /100: kỹ năng tối đa 50, sở thích 20, lịch rảnh 30.'
  state.entries = state.entries.map(entry => ({ ...entry, score: 30, components: { skills: 0, interests: 0, availability: 30 }, semantic: null }))
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  const source = page.getByRole('status', { name: 'Phương pháp ghép nối' })
  await expect(source).toContainText('Quy tắc dự phòng')
  await expect(source).toContainText('AI hiện chưa sẵn sàng')
  await expect(page.locator('.matching-activity-row h2')).toHaveText(['Kết nối số 13'])
  expect(state.gets.at(-1)).toContain('page=2')
  const row = page.locator('.matching-activity-row')
  await expect(row).toContainText('30/100 điểm')
  await row.locator('summary').click()
  await expect(row.locator('.matching-score-breakdown dd')).toHaveText(['0/50', '0/20', '30/30'])
  await expect(row.locator('.matching-semantic-note')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText('secret-model-path')
  await expect(page.locator('body')).not.toContainText('26.4/30')
})

test('Ghép nối AI: hồ sơ thiếu nội dung không nhận điểm AI hoặc thông tin suy đoán', async ({ page }) => {
  const state = await fixtures(page)
  Object.assign(state.entries[0], { score: 21, rule_score: 30, semantic: null, components: { skills: 0, interests: 0, availability: 21, semantic: 0 },
    reasons: ['Lịch rảnh bao phủ toàn bộ thời gian hoạt động.'] })
  await page.goto(volunteerBase)
  const row = page.locator('.matching-activity-row')
  await row.locator('summary').click()
  await expect(row.locator('.matching-score-breakdown dd')).toHaveText(['0/35', '0/14', '21/21', '0/30'])
  await expect(row.locator('.matching-semantic-note')).toHaveText('Chưa có đủ nội dung hồ sơ để AI so sánh. Mục nội dung tương đồng chưa được cộng điểm.')
  for (const status of ['disabled', 'not_applicable']) {
    state.ai = { status, reason: null, model: null }; state.method = 'rules_v1'; state.limits = { skills: 50, interests: 20, availability: 30 }; state.entries = []
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Phương pháp ghép nối' })).toContainText('Ghép nối theo quy tắc')
    await expect(page.locator('.matching-page .activity-empty')).toBeVisible()
    await expect(page.locator('.matching-activity-row')).toHaveCount(0)
    await expect(page.getByRole('status', { name: 'Phương pháp ghép nối' })).not.toContainText('AI + quy tắc')
  }
})

test('Ghép nối AI: nội dung không tin cậy chỉ hiển thị dạng văn bản', async ({ page }) => {
  const state = await fixtures(page)
  const unsafe = '<img src=x onerror="window.matchingUnsafe=true">'
  state.entries[0].activity = { ...activity, title: unsafe, address: unsafe }
  state.entries[0].reasons = [unsafe]
  state.explanation = unsafe; state.note = unsafe
  await page.goto(volunteerBase)
  const row = page.locator('.matching-activity-row')
  await expect(row.locator('h2')).toHaveText(unsafe)
  await row.locator('summary').click()
  await expect(row.locator('li')).toHaveText(unsafe)
  await expect(row.locator('img')).toHaveCount(0)
  await page.getByRole('button', { name: 'Quy tắc', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Quy tắc ghép nối' })
  await expect(dialog).toContainText(unsafe)
  await expect(dialog.locator('img')).toHaveCount(0)
  expect(await page.evaluate(() => window.matchingUnsafe)).toBeUndefined()
  await page.unroute('**/api/v1/**')
  const managed = await fixtures(page, true)
  managed.entries[0].volunteer.full_name = unsafe
  managed.entries[0].reasons = [unsafe, 'a'.repeat(200)]
  await page.goto(managedBase)
  const candidate = page.locator('.matching-card')
  await expect(candidate.locator('h2')).toHaveText(unsafe)
  await candidate.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  const managedDialog = page.getByRole('dialog', { name: unsafe, exact: true })
  await expect(managedDialog.locator('img')).toHaveCount(0)
  await expect(managedDialog.locator('li')).toHaveText([unsafe, 'a'.repeat(200)])
  await assertFits(page)
  expect(await page.evaluate(() => window.matchingUnsafe)).toBeUndefined()
})

test('Ghép nối AI: tương thích phản hồi quy tắc cũ chưa có metadata AI', async ({ page }) => {
  const state = await fixtures(page, true)
  state.ai = undefined; state.limits = undefined; state.method = 'rules_v1'
  Object.assign(state.entries[0], { score: 70, semantic: null, components: { skills: 50, interests: 20, availability: 0 }, matched_skills: ['Công nghệ'] })
  await page.goto(managedBase)
  await expect(page.getByRole('status', { name: 'Phương pháp ghép nối' })).toHaveCount(0)
  const row = page.locator('.matching-card')
  await expect(row).toContainText('70/100 điểm')
  await row.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nguyễn An', exact: true })
  await expect(dialog.locator('.matching-score-breakdown dd')).toHaveText(['50/50', '20/20', '0/30'])
  await expect(dialog.locator('.matching-semantic-note')).toHaveCount(0)
})
