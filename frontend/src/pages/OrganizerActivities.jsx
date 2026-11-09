import ActionRow from '../components/ActionRow.jsx'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, CalendarDays, ClipboardList, CheckCircle2, Clock3, MessageSquare, Plus, RefreshCw, Send, UserCheck, Users } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import useSkillCatalog from '../hooks/useSkillCatalog.js'
import RequestState from '../components/RequestState.jsx'
import ActivityFilterPanel from '../components/ActivityFilterPanel.jsx'
import { activityStatuses } from '../api/activityFormat.js'

const modes = {
  matching: ['Ghép nối tình nguyện viên', 'Xem người phù hợp', '/ghep-noi'],
  contributions: ['Quản lý đóng góp', 'Xác nhận đóng góp', '/dong-gop'],
  activities: ['Hoạt động của tôi', 'Xem chi tiết', ''],
  registrations: ['Quản lý đơn đăng ký', 'Xét duyệt đăng ký', '/dang-ky'],
  attendance: ['Quản lý điểm danh', 'Mở điểm danh', '/diem-danh'],
  feedback: ['Phản hồi từ người tham gia', 'Xem phản hồi', '/phan-hoi'],
}

const metricLabels = { activities: 'NGƯỜI THAM GIA', registrations: 'ĐƠN ĐĂNG KÝ', attendance: 'ĐIỂM DANH',
  feedback: 'PHẢN HỒI', contributions: 'ĐIỂM ĐÓNG GÓP', matching: 'LỜI MỜI' }

const statusFilters = [['', 'Tất cả'], ['draft', 'Bản nháp'], ['published', 'Công khai'],
  ['completed', 'Hoàn thành'], ['cancelled', 'Đã hủy']]

function ActivityMetric({ activity, mode }) {
  if (mode === 'feedback') return <span>{activity.feedback_count} lượt phản hồi hợp lệ</span>
  if (mode === 'registrations') return <><span>{activity.registration_count} đơn đăng ký</span><span>{activity.pending_count} đơn chờ duyệt</span><span>{activity.approved_count} người được duyệt</span></>
  if (mode === 'attendance') return <><span>{activity.attendance_count} người đã điểm danh</span><span>{activity.attendance_pending_count} người chưa điểm danh</span></>
  if (mode === 'contributions') return <><span>{activity.contribution_count} người đã chấm điểm</span><span>{activity.contribution_pending_count} người chưa chấm điểm</span></>
  if (mode === 'matching') return <><span>{activity.invitation_count} lời mời đã gửi</span><span>{Math.max(0, activity.capacity - activity.approved_count)} chỗ còn lại</span></>
  return <><span>{activity.approved_count} người được duyệt</span><span>Số lượng cần tuyển: {activity.capacity} người</span></>
}

function Summary({ data, loading, error, retry, mode }) {
  const registrationHub = mode === 'registrations'
  const stats = !data ? [] : registrationHub ? [
    [ClipboardList, 'Tổng đơn đăng ký', data.metrics.registered],
    [Clock3, 'Chờ duyệt', data.metrics.pending],
    [CheckCircle2, 'Đã duyệt', data.metrics.approved],
  ] : [[CalendarDays, 'Tổng hoạt động', Object.values(data.activities).reduce((a, b) => a + b, 0)],
      [Users, 'Đang công khai', data.activities.published || 0],
      [CheckCircle2, 'Đã hoàn thành', data.activities.completed || 0],
      [ClipboardList, 'Đơn chờ duyệt', data.metrics.pending]]
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <div className={`om-summary${registrationHub ? ' om-registration-summary' : ''}`} aria-label={registrationHub ? 'Đơn đăng ký trong tất cả hoạt động' : 'Tổng hợp hoạt động của tôi'}>
    {stats.map(([Icon, label, value]) => <div className="om-stat" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>}</>
}

function ContextSummary({ summary, mode }) {
  if (!summary) return null
  const stats = {
    matching: [[CalendarDays, 'Hoạt động đang lọc', summary.activities], [Send, 'Lời mời đã gửi', summary.invitations], [Users, 'Chỗ còn tuyển', summary.remaining_places]],
    attendance: [[Users, 'Lượt tham gia', summary.attended + summary.attendance_pending], [UserCheck, 'Đã điểm danh', summary.attended], [Clock3, 'Chưa điểm danh', summary.attendance_pending]],
    contributions: [[Users, 'Lượt tham gia đủ điều kiện', summary.confirmed + summary.contribution_pending], [Award, 'Đã chấm điểm', summary.confirmed], [Clock3, 'Chưa chấm điểm', summary.contribution_pending]],
    feedback: [[CalendarDays, 'Hoạt động có phản hồi', summary.with_feedback], [MessageSquare, 'Phản hồi hợp lệ', summary.feedback]],
  }[mode]
  return <div className="om-summary om-context-summary" aria-label="Thống kê trong các hoạt động đang lọc">
    {stats.map(([Icon, label, value]) => <div className="om-stat" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>
}

export default function OrganizerActivities({ Filters, mode = 'activities' }) {
  const managingActivities = mode === 'activities'
  const registrationHub = mode === 'registrations'
  const usesOverview = managingActivities || registrationHub
  const [params, setParams] = useSearchParams(mode === 'contributions' ? { status: 'completed' } : mode === 'matching' ? { status: 'published' } : {})
  const skills = useSkillCatalog()
  const summary = useApi(usesOverview ? '/reports/overview/' : null)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  if (!usesOverview) query.set('mode', mode)
  for (const name of ['search', 'status', 'date_from', 'date_to', 'location', 'skill']) if (params.get(name)) query.set(name, params.get(name))
  const { data, loading, error, retry } = useApi(`/organizer/activities/?${query}`)
  const [title, , suffix] = modes[mode]
  const refreshing = loading || summary.loading
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  function changeStatus(status) {
    const next = new URLSearchParams(params)
    if (status) next.set('status', status)
    else next.delete('status')
    next.set('page', '1')
    setParams(next)
  }
  function refreshActivities() { retry(); summary.retry() }
  return <section className="page-width section interior activity-page om-activity-list">
    <div className="om-page-heading om-management-heading">
      <div><h1>{title}</h1></div>
      <div className="om-management-actions">
        {managingActivities && <Link className="button primary" to="/nha-to-chuc/hoat-dong/tao"><Plus size={16} aria-hidden="true" />Tạo hoạt động</Link>}
        <button type="button" className="button secondary refresh-button" onClick={refreshActivities} disabled={refreshing}>
          <RefreshCw size={16} aria-hidden="true" />{refreshing ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>
    </div>
    {usesOverview ? <Summary {...summary} mode={mode} /> : <ContextSummary summary={data?.summary} mode={mode} />}
    {managingActivities && <div className="om-status-filters" role="group" aria-label="Lọc nhanh theo trạng thái hoạt động">
      {statusFilters.map(([status, label]) => <button type="button" key={status} aria-pressed={(params.get('status') || '') === status}
        onClick={() => changeStatus(status)}>{label}</button>)}
    </div>}
    <ActivityFilterPanel><Filters key={String(params)} params={params} setParams={setParams} managed skills={skills} /></ActivityFilterPanel>
    <div className="om-list-toolbar list-results-toolbar">
      {data && <p className="muted">{data.count} hoạt động phù hợp với bộ lọc.</p>}
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {!data.count && <p className="activity-empty">{managingActivities ? 'Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi bộ lọc.' : 'Chưa có hoạt động phù hợp. Hãy thử điều chỉnh bộ lọc.'}</p>}
      {!!data.count && <div className="om-table-labels om-registration-row" aria-hidden="true"><span>HOẠT ĐỘNG</span><span>{metricLabels[mode]}</span></div>}
      <div className="om-activity-rows">{data.results.map(activity => <ActionRow className="om-activity-row om-registration-row" key={activity.id}>
        <div><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><h2><Link data-row-primary to={`/nha-to-chuc/hoat-dong/${activity.id}${suffix}`}>{activity.title}</Link></h2>
</div>
        <div className="om-capacity"><ActivityMetric activity={activity} mode={mode} /></div>
      </ActionRow>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang hoạt động"><button className="button secondary" disabled={!data.previous} onClick={() => changePage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => changePage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
