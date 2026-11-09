import ActionRow from '../components/ActionRow.jsx'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, MapPin, RefreshCw, Search, Users, X } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import ActivityVisual from '../components/ActivityVisual.jsx'
import useApi from '../hooks/useApi.js'
import useSkillCatalog from '../hooks/useSkillCatalog.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/activities.css'
import '../styles/volunteer-discovery.css'
import OrganizerActivities from './OrganizerActivities.jsx'
import ActivityFilterPanel from '../components/ActivityFilterPanel.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'

const filterNames = ['search', 'status', 'date_from', 'date_to', 'location', 'skill']

function DiscoveryFilters({ params, setParams, skills }) {
  const [values, setValues] = useState(Object.fromEntries(filterNames.map(name => [name, params.get(name) || ''])))
  const [dateError, setDateError] = useState('')
  function change(event) {
    setValues(current => ({ ...current, [event.target.name]: event.target.value }))
    setDateError('')
  }
  function submit(event) {
    event.preventDefault()
    if (values.date_from && values.date_to && values.date_from > values.date_to) {
      setDateError('Ngày đến phải bằng hoặc sau ngày từ.')
      event.currentTarget.elements.namedItem('date_to').focus()
      return
    }
    const next = new URLSearchParams(params)
    for (const name of filterNames) {
      next.delete(name)
      if (values[name].trim()) next.set(name, values[name].trim())
    }
    next.set('page', '1')
    setParams(next)
  }
  return <form className="activity-search discovery-search" onSubmit={submit}>
    <label htmlFor="activity-search">Tìm theo tên hoạt động</label>
    <div className="discovery-search-bar"><div className="activity-search-input"><Search size={18} aria-hidden="true" /><input id="activity-search" name="search" placeholder="Nhập tên hoạt động" maxLength={200} value={values.search} onChange={change} /></div><button className="button primary" type="submit">Tìm kiếm</button></div>
    <div className="activity-filter-grid discovery-filter-grid">
      <label>Ngày bắt đầu từ<input type="date" name="date_from" value={values.date_from} onChange={change} /></label>
      <label>Ngày bắt đầu đến<input type="date" name="date_to" value={values.date_to} onChange={change} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'discovery-date-error' : undefined} /></label>
      <label>Địa điểm<input name="location" maxLength={200} placeholder="Thành phố hoặc địa chỉ" value={values.location} onChange={change} /></label>
      <label>Kỹ năng yêu cầu<select aria-label="Kỹ năng yêu cầu" name="skill" value={values.skill} onChange={change} disabled={skills.loading || Boolean(skills.error)}><option value="">Tất cả kỹ năng</option>{values.skill && !skills.data.some(skill => String(skill.id) === values.skill) && <option value={values.skill}>Kỹ năng đã chọn</option>}{skills.data.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</select></label>
    </div>
    {dateError && <p id="discovery-date-error" className="discovery-date-error" role="alert">{dateError}</p>}
    {skills.loading && <p className="muted" role="status">Đang tải danh mục kỹ năng…</p>}
    {skills.error && <div className="discovery-skill-error"><p>Chưa tải được danh mục kỹ năng. Bạn vẫn có thể tìm theo tên, ngày hoặc địa điểm.</p><RequestState error={skills.error} retry={skills.retry} /></div>}
  </form>
}

function ActivityFilters(props) {
  return props.managed ? <ManagedActivityFilters {...props} /> : <DiscoveryFilters {...props} />
}

function ManagedActivityFilters({ params, setParams, managed, skills }) {
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
    <p>{managed ? 'Kết hợp tên, trạng thái, ngày bắt đầu, địa điểm và kỹ năng để tìm hoạt động phù hợp.' : 'Hiển thị hoạt động Công khai còn mở đăng ký và còn chỗ. Tìm theo tên, ngày bắt đầu, địa điểm và kỹ năng.'} Ngày được tính theo giờ Việt Nam.</p>
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

function ActivitiesBrowser() {
  const { user } = useAuth()
  const skills = useSkillCatalog()
  const [params, setParams] = useSearchParams()
  const query = params.get('search') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const apiParams = new URLSearchParams({ page: String(page), page_size: '12' })
  for (const name of filterNames) if (params.get(name)) apiParams.set(name, params.get(name))
  const { data, loading, error, retry } = useApi(`/activities/?${apiParams}`)
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  function removeFilter(name) {
    const next = new URLSearchParams(params)
    next.delete(name); next.set('page', '1'); setParams(next)
  }
  function clearFilters() {
    const next = new URLSearchParams(params)
    filterNames.forEach(name => next.delete(name))
    next.set('page', '1'); setParams(next)
  }
  const activeFilters = filterNames.filter(name => params.get(name))
  const labels = { search: 'Tên', status: 'Trạng thái', date_from: 'Ngày từ', date_to: 'Ngày đến', location: 'Địa điểm', skill: 'Kỹ năng' }
  function filterValue(name) {
    const value = params.get(name)
    if (name === 'skill') return skills.data.find(skill => String(skill.id) === value)?.name || 'Đã chọn'
    if (name === 'status') return activityStatuses[value] || value
    return name.startsWith('date_') && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value
  }
  return <section className="page-width section interior activity-page activity-browser volunteer-discovery">
    <div className="activity-heading discovery-heading"><h1>Khám phá hoạt động</h1>
      <div className="discovery-heading-actions">{user?.role === 'volunteer' && <Link className="button secondary" to="/tinh-nguyen-vien/dang-ky">Đăng ký của tôi</Link>}<button className="button secondary refresh-button" type="button" onClick={retry} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? 'Đang tải…' : 'Làm mới'}</button></div></div>

    <p className="muted discovery-intro">Chỉ hiển thị hoạt động Công khai còn mở đăng ký và còn chỗ.</p>
    <ActivityFilterPanel><ActivityFilters key={String(params)} params={params} setParams={setParams} skills={skills} /></ActivityFilterPanel>
    {!!activeFilters.length && <div className="discovery-active-filters" role="group" aria-label="Bộ lọc đang áp dụng">{activeFilters.map(name => <button className="discovery-filter-chip" type="button" key={name} onClick={() => removeFilter(name)} aria-label={`Bỏ bộ lọc ${labels[name]}: ${filterValue(name)}`}><span>{labels[name]}: {filterValue(name)}</span><X size={14} aria-hidden="true" /></button>)}<button className="text-button" type="button" onClick={clearFilters}>Xóa tất cả bộ lọc</button></div>}
    <RequestState loading={loading} error={error?.status === 404 ? null : error} retry={retry} />
    {error?.status === 404 && <div className="activity-empty discovery-empty" role="alert"><p>Trang này không còn kết quả. Hãy quay về trang đầu và thử lại.</p><button className="button secondary" type="button" onClick={() => changePage(1)}>Về trang đầu</button></div>}
    {data && <>
      <p className="muted discovery-result-count" role="status">{data.count} hoạt động{query && ` phù hợp với “${query}”`}.</p>
      {!data.count && <div className="activity-empty discovery-empty"><p>Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.</p>{!!activeFilters.length && <button className="button secondary" type="button" onClick={clearFilters}>Xem tất cả hoạt động</button>}</div>}
      <div className="activity-grid discovery-grid">{data.results.map(activity => <ActionRow className="activity-card discovery-card" key={activity.id}>
        <ActivityVisual id={activity.id} coverUrl={activity.cover_url}><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span></ActivityVisual>
        <div className="activity-card-content">
        <h2><Link data-row-primary to={`/hoat-dong/${activity.id}`}>{activity.title}</Link></h2>
        <p className="activity-card-date"><CalendarDays size={16} aria-hidden="true" /><time dateTime={activity.starts_at}>{activityTime(activity.starts_at)}</time></p>
        <p className="activity-card-location"><MapPin size={16} aria-hidden="true" />{activity.address}</p>
        {!!activity.skill_details?.length && <div className="activity-skill-tags discovery-skills" aria-label="Kỹ năng của hoạt động">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div>}
        <div className="activity-card-footer discovery-card-footer"><span className="discovery-remaining"><Users size={16} aria-hidden="true" />Còn {Math.max(0, activity.capacity - activity.approved_count)} chỗ</span><span>{activity.approved_count} người được duyệt</span></div>
        </div>
      </ActionRow>)}</div>
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
