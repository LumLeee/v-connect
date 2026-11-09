import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

async function mutate(request, url, data, method = 'post') {
  const { csrfToken } = await (await request.get('/api/v1/auth/csrf/')).json()
  const response = await request[method](url, { headers: { 'X-CSRFToken': csrfToken }, data })
  expect(response.ok(), await response.text()).toBe(true)
  return response.json()
}

async function account(request, role) {
  return mutate(request, '/api/v1/auth/register/', {
    email: `discovery-flow.${randomUUID()}@example.invalid`, full_name: role === 'volunteer' ? 'Người tham gia khám phá' : 'Nhóm môi trường', role,
    password: 'River-Community-493!', password_confirm: 'River-Community-493!',
  })
}

test('Khám phá → gợi ý → đăng ký → được duyệt → hủy đồng bộ với dữ liệu thật', async ({ page, browser }) => {
  test.setTimeout(120000)
  page.on('pageerror', error => { throw error })
  const owner = await browser.newContext({ baseURL: process.env.E2E_BASE_URL })
  try {
    await account(owner.request, 'organizer')
    await account(page.request, 'volunteer')
    const catalog = await (await page.request.get('/api/v1/skills/?page_size=100')).json()
    const skills = catalog.results.slice(0, 2)
    expect(skills).toHaveLength(2)
    await mutate(page.request, '/api/v1/auth/profile/', { volunteer: { skills: [skills[0].id], interests: ['Môi trường'] } }, 'patch')
    const starts = Date.now() + 7 * 86400000
    const activity = await mutate(owner.request, '/api/v1/organizer/activities/', {
      title: `Môi trường cộng đồng ${randomUUID()}`, description: 'Hoạt động bảo vệ môi trường cùng cộng đồng.', address: 'Công viên Đà Nẵng', capacity: 1,
      starts_at: new Date(starts).toISOString(), ends_at: new Date(starts + 7200000).toISOString(), required_skills: skills.map(skill => skill.id),
    })
    await mutate(owner.request, `/api/v1/organizer/activities/${activity.id}/status/`, { status: 'published' })
    const listUrl = `/hoat-dong?search=${encodeURIComponent(activity.title)}`
    await page.goto(listUrl)
    const card = page.locator('.discovery-card').filter({ hasText: activity.title })
    await expect(card).toContainText('Còn 1 chỗ')
    await expect(card).toContainText(skills[0].name)
    await expect(card).toContainText(skills[1].name)
    await page.goto('/tinh-nguyen-vien/ghep-noi')
    const match = page.locator('.vm-match-row').filter({ hasText: activity.title })
    const recommendations = await (await page.request.get('/api/v1/matching/activities/?page_size=100')).json()
    const recommendation = recommendations.results.find(entry => entry.activity.id === activity.id)
    expect(recommendation).toBeTruthy()
    if (recommendations.method === 'hybrid_embeddings_v1') {
      expect(recommendations.ai.status).toBe('active')
      expect(recommendation.rule_score).toBe(45)
      expect(recommendation.score).toBeCloseTo(Object.values(recommendation.components).reduce((sum, value) => sum + value, 0), 2)
    } else expect(recommendation.score).toBe(45)
    await expect(match).toContainText(`${recommendation.score}/100 điểm`)
    await match.getByText('Vì sao được gợi ý?', { exact: true }).click()
    await expect(match).toContainText('Khớp 1/2 kỹ năng yêu cầu.')
    await match.getByRole('link', { name: 'Xem chi tiết', exact: true }).click()
    await expect(page.getByRole('heading', { name: activity.title, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Đăng ký tham gia', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Chờ duyệt')
    const application = await (await page.request.get(`/api/v1/activities/${activity.id}/participation/`)).json()
    expect(application.participation.status).toBe('pending')
    await page.goto('/tinh-nguyen-vien/ghep-noi')
    await expect(page.getByRole('heading', { name: activity.title, exact: true })).toHaveCount(0)
    await mutate(owner.request, `/api/v1/organizer/activities/${activity.id}/applicants/${application.participation.id}/review/`, { status: 'approved' })
    await page.goto(`/hoat-dong/${activity.id}`)
    await expect(page.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Được duyệt')
    await expect(page.locator('.activity-logistics')).toContainText('0 chỗ')
    const publicList = await (await owner.request.get(`/api/v1/activities/?search=${encodeURIComponent(activity.title)}`)).json()
    expect(publicList.count).toBe(0)
    await page.getByRole('button', { name: 'Hủy đăng ký', exact: true }).click()
    await page.getByRole('dialog', { name: 'Xác nhận hủy đăng ký', exact: true }).getByRole('button', { name: 'Xác nhận hủy đăng ký', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Trạng thái:' })).toContainText('Đã hủy đăng ký')
    await page.goto(listUrl)
    await expect(card).toContainText('Còn 1 chỗ')
    await expect(card).toContainText('0 người được duyệt')
  } finally {
    await owner.close()
  }
})
