import { Link } from 'react-router-dom'
import { Users, CalendarDays, UserCheck, ShieldCheck, MessageSquare, ClipboardList, ChevronRight, ChartNoAxesCombined, RefreshCw } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityStatuses } from '../api/activityFormat.js'
import '../styles/admin-overview.css'

const tasks = [
  [Users, 'Tài khoản hệ thống', 'Tra cứu người dùng, khóa hoặc mở khóa tài khoản.', '/quan-tri/tai-khoan'],
  [MessageSquare, 'Kiểm duyệt phản hồi', 'Đọc đánh giá và xử lý nội dung không phù hợp.', '/quan-tri/phan-hoi'],
  [ClipboardList, 'Lịch sử thao tác', 'Tra cứu người thực hiện, thời gian và lý do thay đổi.', '/quan-tri/nhat-ky'],
]

export default function AdminDashboard() {
  const { data, loading, error, retry } = useApi('/reports/overview/')
  const metrics = data && [
    [Users, 'Tổng tài khoản', data.accounts.total, '/quan-tri/tai-khoan', 'blue'],
    [ShieldCheck, 'Tài khoản bị khóa', data.accounts.locked, '/quan-tri/tai-khoan?status=locked', 'amber'],
    [CalendarDays, 'Hoạt động công khai', data.activities.published || 0, '/bao-cao/hoat-dong?status=published', 'green'],
    [UserCheck, 'Lượt tham gia hoàn thành', data.metrics.attended_completed, '/bao-cao/dang-ky?metric=attended_completed', 'purple'],
  ]
  return <section className="ad-dashboard" aria-labelledby="ad-overview-title" aria-busy={loading}>
    <div className="ad-overview-heading"><h1 id="ad-overview-title">Tổng quan</h1>
      <div className="ad-overview-actions"><Link className="button primary" to="/bao-cao"><ChartNoAxesCombined size={17} aria-hidden="true" />Xem báo cáo</Link>
        <button type="button" className="button secondary refresh-button" disabled={loading} onClick={retry}><RefreshCw size={16} aria-hidden="true" />Làm mới</button>
      </div>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="ad-overview-metrics" aria-label="Số liệu toàn hệ thống">
        {metrics.map(([Icon, label, value, to, tone]) => <Link className="ad-overview-stat om-stat" to={to} key={label}>
          <span className={`ad-overview-icon ${tone}`}><Icon size={21} aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong></div><ChevronRight size={16} aria-hidden="true" />
        </Link>)}
      </div>
      <div className="ad-overview-columns">
        <section className="ad-overview-panel" aria-labelledby="ad-status-title">
          <div className="ad-overview-panel-heading"><h2 id="ad-status-title">Trạng thái hoạt động</h2><Link className="button secondary" to="/bao-cao/hoat-dong">Xem tất cả</Link></div>
          <div className="ad-overview-statuses">{Object.entries(activityStatuses).map(([key, label]) => <Link className="ad-overview-status" key={key} to={`/bao-cao/hoat-dong?status=${key}`}>
            <span><i className={`ad-dot ad-dot-${key}`} aria-hidden="true" />{label}</span><strong>{data.activities[key] || 0}</strong><ChevronRight size={17} aria-hidden="true" />
          </Link>)}</div>
        </section>
        <section className="ad-overview-panel" aria-labelledby="ad-tasks-title">
          <div className="ad-overview-panel-heading"><h2 id="ad-tasks-title">Công việc quản trị</h2></div>
          <div className="ad-overview-tasks">{tasks.map(([Icon, title, description, to]) => <Link className="ad-overview-task" to={to} key={to}>
            <span className="ad-overview-icon green"><Icon size={20} aria-hidden="true" /></span><div><h3>{title}</h3><p>{description}</p></div><ChevronRight size={18} aria-hidden="true" />
          </Link>)}</div>
        </section>
      </div>
    </>}
  </section>
}
