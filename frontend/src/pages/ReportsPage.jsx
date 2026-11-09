import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import ReportMetrics, { ReportPagination } from '../components/ReportMetrics.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import OrganizerReportsView from '../components/OrganizerReportsView.jsx'
import OrganizerActivityResultPage from './OrganizerActivityResultPage.jsx'
import AdminActivitiesPage from './AdminActivitiesPage.jsx'
import AdminActivityResultPage from './AdminActivityResultPage.jsx'
import AdminReportsPage from './AdminReportsPage.jsx'
import AdminParticipationsPage from './AdminParticipationsPage.jsx'
import { metricLabels } from '../api/reportFormat.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { participationLabels } from '../api/participationFormat.js'
import '../styles/activities.css'

export default function ReportsPage({ mode = 'overview' }) {
  const { user } = useAuth()
  if (user.role === 'admin' && mode === 'overview') return <AdminReportsPage />
  if (user.role === 'admin' && mode === 'participations') return <AdminParticipationsPage />
  if (user.role === 'admin' && mode === 'activities') return <AdminActivitiesPage />
  if (user.role === 'admin' && mode === 'result') return <AdminActivityResultPage />
  if (user.role === 'organizer' && ['overview', 'activities'].includes(mode)) {
    return <OrganizerReportsView initialTab={mode === 'activities' ? 'activities' : 'summary'} />
  }
  if (user.role === 'organizer' && mode === 'result') return <OrganizerActivityResultPage />
  return <LegacyReportsPage mode={mode} />
}

function LegacyReportsPage({ mode }) {
  const { user } = useAuth()
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const path = mode === 'overview' ? '/reports/overview/' : mode === 'result' ? `/reports/activities/${id}/`
    : `/reports/${mode === 'activities' ? 'activities' : 'participations'}/?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page), page_size: '12' })}`
  const { data, loading, error, retry } = useApi(path)
  const title = mode === 'overview' ? 'Thống kê của tôi' : mode === 'activities' ? 'Báo cáo hoạt động' : mode === 'result' ? 'Kết quả hoạt động' : metricLabels[params.get('metric') || 'registered'] || 'Chi tiết đăng ký'
  function changePage(value) { setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next }) }
  return <section className="page-width section interior activity-page">

    <h1>{title}</h1><div className="list-results-toolbar">{data && ['activities', 'participations'].includes(mode) && <p>{data.count} {mode === 'activities' ? 'hoạt động' : 'đơn đăng ký'}.</p>}<button type="button" className="button secondary refresh-button" onClick={retry}>Làm mới</button></div>
    {user.role === 'organizer' && mode === 'result' && <OrganizerActivityHeader id={id} selected="reports" />}
    {user.role !== 'volunteer' && <p><Link className="button primary" to={user.role === 'organizer' ? '/bao-cao' : '/bao-cao/mo-rong'}>{user.role === 'organizer' ? 'Báo cáo tổng hợp' : 'Báo cáo mở rộng'}</Link></p>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && mode === 'overview' && <>
      {data.accounts && <p className="activity-empty">Tài khoản: {data.accounts.total} tổng cộng, {data.accounts.active} hoạt động, {data.accounts.locked} bị khóa. <Link to="/quan-tri/tai-khoan">Quản lý tài khoản</Link></p>}
      <div className="activity-actions">{Object.entries(activityStatuses).map(([status, label]) => <p key={status}>{label}: {data.activities[status] || 0}</p>)}</div>
      {user.role !== 'volunteer' && <p><Link className="button secondary" to="/bao-cao/hoat-dong">Xem báo cáo từng hoạt động</Link></p>}
      <ReportMetrics metrics={data.metrics} />
    </>}
    {data && mode === 'result' && <>
      <h2>{data.activity.title}</h2><p>{activityStatuses[data.activity.status]} · {activityTime(data.activity.starts_at)}</p>
      {data.activity.status !== 'completed' && <p className="activity-empty">Đây là số liệu hiện tại. Hoạt động chưa hoàn thành hoặc đã bị hủy.</p>}
      <ReportMetrics metrics={data.metrics} activity={id} />
      {user.role !== 'volunteer' && <div className="activity-actions">{data.activity.status === 'completed' && <Link className="button primary" to={`/bao-cao/hoat-dong/${id}/tong-ket`}>Mẫu báo cáo tổng kết</Link>}</div>}
      {user.role === 'organizer' && <p><Link to={`/nha-to-chuc/hoat-dong/${id}/phan-hoi`}>Xem phản hồi hoạt động</Link></p>}
    </>}
    {mode === 'activities' && <form className="activity-search" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setParams({ search: form.get('search'), status: form.get('status'), page: '1' }) }}>
      <label htmlFor="report-search">Tìm tên hoạt động</label><input id="report-search" name="search" maxLength={200} defaultValue={params.get('search') || ''} />
      <label htmlFor="report-status">Trạng thái hoạt động</label><select id="report-status" name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả</option>{Object.entries(activityStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <button className="button secondary">Lọc hoạt động</button>
    </form>}
    {data && ['activities', 'participations'].includes(mode) && <>

      {!data.count && <p className="activity-empty">Chưa có dữ liệu phù hợp.</p>}
      <div className="activity-grid">{data.results.map(entry => mode === 'activities' ? <ActionRow className="activity-card" key={entry.id}>
        <h2><Link to={`/bao-cao/hoat-dong/${entry.id}`}>{entry.title}</Link></h2><p>{activityStatuses[entry.status]}</p><p>Nhà tổ chức: {entry.organizer_name}</p>
        <Link className="button secondary" to={`/bao-cao/hoat-dong/${entry.id}`}>Xem chi tiết</Link>
      </ActionRow> : <ActionRow className="activity-card" key={entry.id}>
        <h2>{entry.activity.title}</h2>{entry.volunteer_name && <p>Người đăng ký: {entry.volunteer_name}</p>}
        <p>Đơn: {participationLabels[entry.status]}</p><p>Hoạt động: {activityStatuses[entry.activity.status]}</p>
        <RecordDetails title={entry.activity.title}><p>Trạng thái đơn: {participationLabels[entry.status]}</p><p>Trạng thái hoạt động: {activityStatuses[entry.activity.status]}</p><AttendanceStatus entry={entry} /></RecordDetails>
        {(user.role !== 'volunteer' || entry.activity.status === 'published') && <Link to={user.role === 'volunteer' ? `/hoat-dong/${entry.activity.id}` : `/bao-cao/hoat-dong/${entry.activity.id}`}>Xem hoạt động</Link>}
      </ActionRow>)}</div>
      <ReportPagination data={data} page={page} onPage={changePage} />
    </>}
  </section>
}
