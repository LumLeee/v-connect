import ActionRow from '../components/ActionRow.jsx'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, ClipboardList, CheckCircle2, Users } from 'lucide-react'
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

function ActivityMetric({ activity, mode }) {
  if (mode === 'feedback') return <span>{activity.feedback_count} lượt phản hồi hợp lệ</span>
  if (mode === 'registrations') return <><span>{activity.registration_count} đơn đăng ký</span><span>{activity.pending_count} đơn chờ duyệt</span><span>{activity.approved_count} người được duyệt</span></>
  if (mode === 'attendance') return <><span>{activity.attendance_count} người đã điểm danh</span><span>{activity.approved_count} người được duyệt</span></>
  if (mode === 'contributions') return <><span>{activity.contribution_count} người đã chấm điểm</span><span>{Math.max(0, activity.attendance_count - activity.contribution_count)} người chưa chấm điểm</span><span>{activity.attendance_count} người đã điểm danh</span></>
  if (mode === 'matching') return <><span>{activity.invitation_count} lời mời đã gửi</span><span>{Math.max(0, activity.capacity - activity.approved_count)} chỗ còn lại</span></>
  return <><span>{activity.approved_count} người được duyệt</span><span>Số lượng cần tuyển: {activity.capacity} người</span></>
}

function Summary() {
  const { data, loading, error, retry } = useApi('/reports/overview/')
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <div className="om-summary" aria-label="Tổng hợp hoạt động của tôi">
    {[[CalendarDays, 'Tổng hoạt động', Object.values(data.activities).reduce((a, b) => a + b, 0)],
      [Users, 'Đang công khai', data.activities.published || 0],
      [CheckCircle2, 'Đã hoàn thành', data.activities.completed || 0],
      [ClipboardList, 'Đơn chờ duyệt', data.metrics.pending]].map(([Icon, label, value]) => <div className="om-stat" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>}</>
}

export default function OrganizerActivities({ Filters, mode = 'activities' }) {
  const [params, setParams] = useSearchParams(mode === 'contributions' ? { status: 'completed' } : mode === 'matching' ? { status: 'published' } : {})
  const skills = useSkillCatalog()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  for (const name of ['search', 'status', 'date_from', 'date_to', 'location', 'skill']) if (params.get(name)) query.set(name, params.get(name))
  const { data, loading, error, retry } = useApi(`/organizer/activities/?${query}`)
  const [title, action, suffix] = modes[mode]
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  return <section className="page-width section interior activity-page om-activity-list">
    <div className="om-page-heading"><div><p className="om-eyebrow">QUẢN LÝ CỘNG ĐỒNG</p><h1>{title}</h1></div><Link className="button primary" to="/nha-to-chuc/hoat-dong/tao">Tạo hoạt động</Link></div>
    <Summary />
    <ActivityFilterPanel><Filters key={String(params)} params={params} setParams={setParams} managed skills={skills} /></ActivityFilterPanel>
    <div className="om-list-toolbar list-results-toolbar">
      {data && <p className="muted">{data.count} hoạt động phù hợp với bộ lọc.</p>}
      <button type="button" className="button secondary refresh-button" onClick={retry}>Làm mới</button>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {!data.count && <p className="activity-empty">Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi bộ lọc.</p>}
      {!!data.count && <div className="om-table-labels om-registration-row" aria-hidden="true"><span>HOẠT ĐỘNG</span><span>{metricLabels[mode]}</span></div>}
      <div className="om-activity-rows">{data.results.map(activity => <ActionRow className={`om-activity-row${['registrations', 'activities'].includes(mode) ? ' om-registration-row' : ''}`} key={activity.id}>
        <div><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><h2><Link to={`/nha-to-chuc/hoat-dong/${activity.id}${suffix}`}>{activity.title}</Link></h2>
</div>
        <div className="om-capacity"><ActivityMetric activity={activity} mode={mode} /></div>
        {!['registrations', 'activities'].includes(mode) && <div className="om-row-actions"><Link data-row-primary className="button secondary arrow-link-button" to={`/nha-to-chuc/hoat-dong/${activity.id}${suffix}`}>{action}</Link></div>}
      </ActionRow>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang hoạt động"><button className="button secondary" disabled={!data.previous} onClick={() => changePage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => changePage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
