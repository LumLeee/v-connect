import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, MapPin, Search, Users } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import ActivityVisual from '../components/ActivityVisual.jsx'
import useApi from '../hooks/useApi.js'
import useSkillCatalog from '../hooks/useSkillCatalog.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/activities.css'
import OrganizerActivities from './OrganizerActivities.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'

const filterNames = ['search', 'status', 'date_from', 'date_to', 'location', 'skill']

function ActivityFilters({ params, setParams, managed, skills }) {
  const [search, setSearch] = useState(params.get('search') || '')
  function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const next = new URLSearchParams()
    for (const name of filterNames) if (values.get(name)?.trim()) next.set(name, values.get(name).trim())
    next.set('page', '1'); setParams(next)
  }
  return <form className="activity-search" onSubmit={submit}>
    <h2>{managed ? 'Tìm và lọc hoạt động' : 'Tìm cơ hội đóng góp của bạn'}</h2>
    <p>{managed ? 'Kết hợp tên, trạng thái, ngày bắt đầu, địa điểm và kỹ năng để tìm hoạt động phù hợp.' : 'Chỉ hiển thị hoạt động Công khai. Tìm theo tên, ngày bắt đầu, địa điểm và kỹ năng.'} Ngày được tính theo giờ Việt Nam.</p>
    <label htmlFor="activity-search">Tìm theo tên hoạt động</label>
    <div><div className="activity-search-input"><Search size={19} aria-hidden="true" /><input id="activity-search" name="search" placeholder={managed ? 'Nhập tên hoạt động cần quản lý' : 'Bạn muốn tham gia hoạt động nào?'} maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /></div><button className="button primary" type="submit">Tìm kiếm</button>
      {(filterNames.some(name => params.get(name)) || search) && <button className="button secondary" type="button" onClick={() => { setSearch(''); setParams({ page: '1' }) }}>Xóa tìm kiếm</button>}</div>
    <div className="activity-filter-grid">
      {managed && <label>Trạng thái hoạt động<select aria-label="Trạng thái hoạt động" name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả trạng thái</option>{Object.entries(activityStatuses).filter(([key]) => managed || key !== 'draft').map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}
      <label>Ngày bắt đầu từ<input type="date" name="date_from" defaultValue={params.get('date_from') || ''} /></label>
      <label>Ngày bắt đầu đến<input type="date" name="date_to" defaultValue={params.get('date_to') || ''} /></label>
      <label>Địa điểm<input name="location" maxLength={200} placeholder="Thành phố hoặc địa chỉ" defaultValue={params.get('location') || ''} /></label>
      <label>Kỹ năng yêu cầu<select aria-label="Kỹ năng yêu cầu" key={skills.data.length} name="skill" defaultValue={params.get('skill') || ''} disabled={skills.loading || Boolean(skills.error)}><option value="">Tất cả kỹ năng</option>{skills.data.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
    </div>
    {(skills.loading || skills.error) && params.get('skill') && <input type="hidden" name="skill" value={params.get('skill')} />}
    {skills.loading && <p className="muted" role="status">Đang tải danh mục kỹ năng…</p>}
    <RequestState error={skills.error} retry={skills.retry} />
  </form>
}

function ActivitiesBrowser({ managed = false }) {
  const { user } = useAuth()
  const skills = useSkillCatalog()
  const [params, setParams] = useSearchParams()
  const query = params.get('search') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const apiParams = new URLSearchParams({ page: String(page), page_size: '12' })
  for (const name of filterNames) if (params.get(name)) apiParams.set(name, params.get(name))
  const { data, loading, error, retry } = useApi(`${managed ? '/organizer' : ''}/activities/?${apiParams}`)
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  return <section className="page-width section interior activity-page activity-browser">
    <p className="eyebrow">CÙNG ĐÓNG GÓP CHO CỘNG ĐỒNG</p>
    <div className="activity-heading"><h1>{managed ? 'Hoạt động của tôi' : 'Khám phá hoạt động'}</h1>
      {managed ? <Link className="button primary" to="/nha-to-chuc/hoat-dong/tao">Tạo hoạt động</Link> : user?.role === 'volunteer' && <Link className="button secondary" to="/tinh-nguyen-vien/dang-ky">Đăng ký của tôi</Link>}</div>
    <p className="activity-intro">{managed ? 'Theo dõi và quản lý những hoạt động bạn tổ chức cho cộng đồng.' : 'Tìm một hoạt động ý nghĩa, khám phá thông tin và bắt đầu hành trình tình nguyện của bạn.'}</p>
    <ActivityFilters key={`${managed}-${params}`} params={params} setParams={setParams} managed={managed} skills={skills} />
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <p className="muted">{data.count} hoạt động{query && ` phù hợp với “${query}”`}.</p>
      {!data.count && <p className="activity-empty">{managed ? 'Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi từ khóa.' : 'Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.'}</p>}
      <div className="activity-grid">{data.results.map(activity => <article className="activity-card" key={activity.id}>
        <ActivityVisual id={activity.id} coverUrl={activity.cover_url}><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span></ActivityVisual>
        <div className="activity-card-content">
        <p className="activity-card-date"><CalendarDays size={16} aria-hidden="true" />{activityTime(activity.starts_at)} (giờ Việt Nam)</p>
        <h2><Link to={`${managed ? '/nha-to-chuc' : ''}/hoat-dong/${activity.id}`}>{activity.title}</Link></h2>
        <p className="activity-card-location"><MapPin size={16} aria-hidden="true" />{activity.address}</p>
        <p className="activity-card-organizer">{activity.organizer_name}</p>
        {!!activity.skill_details?.length && <div className="activity-skill-tags">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div>}
        <div className="activity-card-footer"><span><Users size={16} aria-hidden="true" />{activity.approved_count}/{activity.capacity} người được duyệt</span>
          <Link className="activity-card-link" to={`${managed ? '/nha-to-chuc' : ''}/hoat-dong/${activity.id}`}>Xem chi tiết <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </div>
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang hoạt động">
        <button className="button secondary" disabled={!data.previous} onClick={() => changePage(page - 1)}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => changePage(page + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>
}

export default function ActivitiesPage({ managed = false, mode = 'activities' }) {
  return managed ? <OrganizerActivities Filters={ActivityFilters} mode={mode} /> : <ActivitiesBrowser />
}
