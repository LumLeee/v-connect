import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const model = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
const revision = 'faf4aa4225822f3bc6376869cb1164e8e3feedd0'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  const response = await request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function account(request, role, fullName) {
  return mutate(request, '/api/v1/auth/register/', {
    email: `matching-ai.${randomUUID()}@example.invalid`, full_name: fullName, role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  })
}

async function get(request, url) {
  const response = await request.get(url)
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

function assertRealAI(response, entry) {
  expect(response.method).toBe('hybrid_embeddings_v1')
  expect(response.ai).toEqual({ status: 'active', reason: null, model, revision })
  expect(response.component_limits).toEqual({ skills: 35, interests: 14, availability: 21, semantic: 30 })
  expect(entry).toBeTruthy()
  expect(entry.rule_score).toBe(0)
  expect(entry.matched_skills).toEqual([])
  expect(entry.matched_interests).toEqual([])
  expect(entry.components.skills).toBe(0)
  expect(entry.components.interests).toBe(0)
  expect(entry.components.availability).toBe(0)
  expect(entry.semantic.similarity).toBeGreaterThan(0)
  expect(entry.semantic.similarity).toBeLessThanOrEqual(100)
  expect(entry.components.semantic).toBeGreaterThan(0)
  expect(entry.components.semantic).toBeLessThanOrEqual(30)
  expect(entry.components.semantic).toBe(entry.semantic.score)
  expect(entry.score).toBe(entry.components.semantic)
}

async function capture(page, info, name) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `width ${width}`).toBe(true)
  }
  await page.setViewportSize(info.project.use.viewport)
  await page.evaluate(() => window.scrollTo(0, 0))
  const target = process.env.E2E_ARTIFACT_DIR || '../tmp/matching-ai-flow'
  await mkdir(target, { recursive: true })
  await page.screenshot({ path: path.join(target, `${info.project.name}-${name}.png`), fullPage: true })
}

test('AI thật ghép nghĩa khác từ khóa hai chiều, tôn trọng đồng ý và không tự tạo đăng ký/lời mời', async ({ page, browser }, info) => {
  test.skip(process.env.E2E_MATCHING_AI !== 'true', 'Cần máy chủ bật mô hình embedding đa ngôn ngữ thật.')
  test.setTimeout(180000)
  page.on('pageerror', error => { throw error })
  const owner = await browser.newContext({ baseURL: process.env.E2E_BASE_URL, viewport: info.project.use.viewport })
  try {
    await account(owner.request, 'organizer', 'Nhà tổ chức kết nối số')
    const name = `Người hỗ trợ kết nối số ${randomUUID().slice(0, 8)}`
    await account(page.request, 'volunteer', name)
    const { user } = await get(page.request, '/api/v1/auth/me/')
    const catalog = await get(owner.request, '/api/v1/skills/?page_size=100')
    const skill = catalog.results.find(item => item.name === 'Công nghệ') || catalog.results[0]
    expect(skill).toBeTruthy()
    const starts = Date.now() + 11 * 86400000
    const activity = await mutate(owner.request, '/api/v1/organizer/activities/', {
      title: `Kết nối số ${randomUUID().slice(0, 8)}`,
      description: 'Hướng dẫn người cao tuổi thực hiện cuộc gọi trực tuyến bằng điện thoại, lưu số liên hệ và điều chỉnh cỡ chữ. Tình nguyện viên hỗ trợ thao tác cơ bản để các cụ giữ liên lạc với gia đình.',
      address: 'Phòng sinh hoạt cộng đồng tại Sơn Trà, Đà Nẵng', capacity: 12, required_skills: [skill.id],
      starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + 3 * 3600000).toISOString(),
    })
    await mutate(owner.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
    const interests = ['Giúp ông bà gọi video và sử dụng thiết bị thông minh']
    await mutate(page.request, '/api/v1/auth/profile/', { volunteer: { skills: [], interests, availability: [], matching_visible: false } }, 'patch')
    const organizer = await owner.newPage()
    organizer.on('pageerror', error => { throw error })
    const managedBase = `/nha-to-chuc/hoat-dong/${activity.id}/ghep-noi`
    await organizer.goto(managedBase)
    await expect(organizer.getByRole('heading', { name: 'Tình nguyện viên phù hợp', exact: true })).toBeVisible()
    const hidden = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/matching/?page_size=100`)
    expect(hidden.results.some(entry => entry.volunteer.id === user.id)).toBe(false)
    await expect(organizer.locator('.matching-card').filter({ hasText: name })).toHaveCount(0)

    await mutate(page.request, '/api/v1/auth/profile/', { volunteer: { skills: [], interests, availability: [], matching_visible: true } }, 'patch')
    const people = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/matching/?page_size=100`)
    const candidateIndex = people.results.findIndex(entry => entry.volunteer.id === user.id)
    const candidate = people.results[candidateIndex]
    assertRealAI(people, candidate)
    await organizer.goto(`${managedBase}?page=${Math.floor(candidateIndex / 12) + 1}`)
    const candidateRow = organizer.locator('.matching-card').filter({ hasText: name })
    await expect(organizer.getByRole('status', { name: 'Phương pháp ghép nối' })).toContainText('AI + quy tắc')
    await expect(candidateRow).toContainText(`${candidate.score}/100 điểm`)
    await expect(candidateRow.locator('.activity-skill-tags')).toHaveCount(0)
    await candidateRow.getByRole('button', { name: 'Xem chi tiết', exact: true }).click()
    const details = organizer.getByRole('dialog', { name, exact: true })
    await expect(details.locator('.matching-score-breakdown dd')).toHaveText(['0/35', '0/14', '0/21', `${candidate.components.semantic}/30`])
    await expect(details.locator('.matching-semantic-note')).toContainText(`${candidate.semantic.similarity}%`)
    await capture(organizer, info, 'matching-ai-real-organizer')
    await details.getByRole('button', { name: 'Đóng', exact: true }).click()

    const activities = await get(page.request, '/api/v1/matching/activities/?page_size=100')
    const activityIndex = activities.results.findIndex(entry => entry.activity.id === activity.id)
    const recommendation = activities.results[activityIndex]
    assertRealAI(activities, recommendation)
    expect(recommendation.score).toBe(candidate.score)
    await page.goto(`/tinh-nguyen-vien/ghep-noi?page=${Math.floor(activityIndex / 12) + 1}`)
    const match = page.locator('.matching-activity-row').filter({ hasText: activity.title })
    await expect(match).toContainText(`${recommendation.score}/100 điểm`)
    await expect(match.locator('.activity-skill-tags')).toContainText(skill.name)
    await match.locator('summary').click()
    await expect(match.locator('.matching-score-breakdown dd')).toHaveText(['0/35', '0/14', '0/21', `${recommendation.components.semantic}/30`])
    await capture(page, info, 'matching-ai-real-volunteer')

    // Viewing either recommendation does not create a participation or invitation.
    const participation = await get(page.request, `/api/v1/activities/${activity.id}/participation/`)
    expect(participation.participation).toBeNull()
    expect((await get(owner.request, `/api/v1/organizer/activities/${activity.id}/invitations/`)).count).toBe(0)
    expect((await get(owner.request, `/api/v1/organizer/activities/${activity.id}/applicants/`)).count).toBe(0)
    await expect(match.getByRole('link', { name: 'Xem chi tiết', exact: true })).toHaveAttribute('href', `/hoat-dong/${activity.id}`)
    await expect(candidateRow.getByRole('button', { name: 'Gửi lời mời', exact: true })).toBeVisible()

    await mutate(page.request, '/api/v1/auth/profile/', { volunteer: { skills: [], interests, availability: [], matching_visible: false } }, 'patch')
    await organizer.getByRole('button', { name: 'Làm mới', exact: true }).click()
    await expect(candidateRow).toHaveCount(0)
    const withdrawn = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/matching/?page_size=100`)
    expect(withdrawn.results.some(entry => entry.volunteer.id === user.id)).toBe(false)

    // An AI-only recommendation becomes a participation only after both users act.
    await mutate(page.request, '/api/v1/auth/profile/', { volunteer: { skills: [], interests, availability: [], matching_visible: true } }, 'patch')
    await organizer.goto(`${managedBase}?page=${Math.floor(candidateIndex / 12) + 1}`)
    await candidateRow.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
    const invitationDialog = organizer.getByRole('dialog', { name: 'Xác nhận gửi lời mời', exact: true })
    await invitationDialog.getByLabel('Lời nhắn (không bắt buộc)', { exact: true }).fill('Mời bạn cùng giúp ông bà kết nối với gia đình.')
    await invitationDialog.getByRole('button', { name: 'Xác nhận gửi lời mời', exact: true }).click()
    await expect(candidateRow.getByRole('status')).toContainText('Lời mời đã được ghi nhận.')
    const sent = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/invitations/`)
    expect(sent.count).toBe(1)
    expect(sent.results[0].status).toBe('pending')
    expect((await get(page.request, `/api/v1/activities/${activity.id}/participation/`)).participation).toBeNull()
    await page.goto('/tinh-nguyen-vien/loi-moi')
    const invitationRow = page.locator('.invitation-row').filter({ hasText: activity.title })
    await invitationRow.getByRole('button', { name: 'Chấp nhận lời mời', exact: true }).click()
    const acceptance = page.getByRole('dialog', { name: 'Xác nhận xử lý lời mời', exact: true })
    await acceptance.getByRole('button', { name: 'Xác nhận tham gia', exact: true }).click()
    await expect(invitationRow.locator('.activity-status')).toHaveText('Đã chấp nhận')
    const accepted = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/invitations/`)
    expect(accepted.count).toBe(1)
    expect(accepted.results[0].status).toBe('accepted')
    const applicants = await get(owner.request, `/api/v1/organizer/activities/${activity.id}/applicants/`)
    expect(applicants.count).toBe(1)
    expect(applicants.results[0].status).toBe('approved')
    expect((await get(page.request, `/api/v1/activities/${activity.id}/participation/`)).participation.status).toBe('approved')
  } finally { await owner.close() }
})
