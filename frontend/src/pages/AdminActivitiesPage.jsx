import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronRight, RefreshCw, Search, X } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/admin-activities.css'

const number = value => value != null && Number.isFinite(Number(value)) ? new Intl.NumberFormat('vi-VN').format(Number(value)) : 'Chưa có thông tin'

function ActivityDate({ value }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{activityTime(value)}</time> : <span>Chưa có thời gian</span>
}

function Filters({ search, status, loading, onApply, onReset }) {
  const [keyword, setKeyword] = useState(search)
  const [selected, setSelected] = useState(status)
  return <form className="ad-system-activity-filters" aria-label="Bộ lọc hoạt động" onSubmit={event => { event.preventDefault(); if (!loading) onApply({ search: keyword.trim(), status: selected }) }}>
    <div><label htmlFor="admin-activity-search">Tìm hoạt động</label><div className="ad-system-activity-search"><Search size={18} aria-hidden="true" /><input id="admin-activity-search" name="search" placeholder="Nhập tên hoạt động" maxLength={200} value={keyword} onChange={event => setKeyword(event.target.value)} disabled={loading} /></div></div>
    <div><label htmlFor="admin-activity-status">Trạng thái hoạt động</label><select id="admin-activity-status" name="status" value={selected} onChange={event => setSelected(event.target.value)} disabled={loading}><option value="">Tất cả trạng thái</option>{Object.entries(activityStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div className="ad-system-activity-filter-actions"><button className="button primary" disabled={loading}>Áp dụng</button><button type="button" className="button secondary" disabled={loading} onClick={() => { setKeyword(''); setSelected(''); onReset() }}>Xóa bộ lọc</button></div>
  </form>
}

export default function AdminActivitiesPage() {
  const [params, setParams] = useSearchParams()
  const pageValue = Number(params.get('page'))
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const search = params.get('search') || '', status = params.get('status') || ''
  const query = new URLSearchParams({ search, status, page: String(page), page_size: '12' })
  const { data, loading, error, retry } = useApi(`/reports/activities/?${query}`)
  const filters = [search && ['search', `Tìm: ${search}`], status && ['status', activityStatuses[status] || status]].filter(Boolean)
  function apply(values) { const next = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value) next.set(key, value); setParams(next) }
  function changePage(value) { if (!loading) setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next }) }
  return <section className="page-width section interior activity-page ad-system-activities" aria-labelledby="admin-activities-title" aria-busy={loading}>
    <header className="ad-system-activity-heading"><div><h1 id="admin-activities-title">Hoạt động toàn hệ thống</h1><p>Tra cứu hoạt động và theo dõi kết quả của từng nhà tổ chức.</p></div><button type="button" className="button secondary" disabled={loading} onClick={retry}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></header>
    <Filters key={`${search}\u0000${status}`} search={search} status={status} loading={loading} onApply={apply} onReset={() => apply({})} />
    {filters.length > 0 && <div className="ad-system-activity-active-filters" aria-label="Bộ lọc đang áp dụng">{filters.map(([key, label]) => <button type="button" key={key} disabled={loading} aria-label={`Bỏ bộ lọc ${label}`} onClick={() => apply(Object.fromEntries([['search', search], ['status', status]].filter(([name]) => name !== key)))}>{label}<X size={14} aria-hidden="true" /></button>)}</div>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="ad-system-activity-results"><p role="status"><strong>{number(data.count)}</strong> hoạt động{filters.length ? ' phù hợp bộ lọc' : ' trong hệ thống'}.</p><Link className="button secondary" to="/bao-cao">Báo cáo và thống kê</Link></div>
      {!data.results.length ? <div className="ad-system-activity-empty"><CalendarDays size={28} aria-hidden="true" /><h2>{data.count ? 'Trang này không có hoạt động' : 'Không có hoạt động phù hợp'}</h2><p>{data.count ? 'Quay về trang đầu để xem danh sách hiện tại.' : 'Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.'}</p>{data.count > 0 && <button type="button" className="button secondary" onClick={() => changePage(1)}>Về trang đầu</button>}</div> : <>
        <div className="ad-system-activity-columns" aria-hidden="true"><span>Hoạt động / Nhà tổ chức</span><span>Trạng thái</span><span>Thời gian</span><span>Được duyệt</span><span /></div>
        <div className="ad-system-activity-list">{data.results.map(entry => <Link key={entry.id} className="ad-system-activity-row" aria-label={`Xem kết quả hoạt động ${entry.title}`} to={`/bao-cao/hoat-dong/${entry.id}`}>
          <div className="ad-system-activity-identity"><h2>{entry.title}</h2><p>{entry.organizer_name || 'Chưa có nhà tổ chức'}</p></div>
          <div className="ad-system-activity-cell"><span className="ad-system-activity-mobile-label">Trạng thái</span><span className={`ad-system-activity-status status-${entry.status}`}>{activityStatuses[entry.status] || entry.status}</span></div>
          <div className="ad-system-activity-cell ad-system-activity-dates"><span><span className="ad-system-activity-time-label">Bắt đầu</span><ActivityDate value={entry.starts_at} /></span><span><span className="ad-system-activity-time-label">Kết thúc</span><ActivityDate value={entry.ends_at} /></span></div>
          <div className="ad-system-activity-cell ad-system-activity-capacity"><span className="ad-system-activity-mobile-label">Được duyệt</span><strong>{number(entry.approved_count)} người</strong><span>Cần tuyển {number(entry.capacity)} người</span></div>
          <ChevronRight className="ad-system-activity-chevron" size={18} aria-hidden="true" />
        </Link>)}</div>
      </>}
      <ReportPagination data={data} page={page} busy={loading} onPage={changePage} />
    </>}
  </section>
}
