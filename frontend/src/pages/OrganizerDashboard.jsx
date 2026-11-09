import { Link } from 'react-router-dom'
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, MapPin, Plus, RefreshCw, UserRound, Users } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/organizer-dashboard.css'

function ActivityCard({ activity, ongoing = false }) {
  return <article className="od-activity-card">
    <div className="od-card-label"><span>{ongoing ? 'Đang diễn ra' : 'Sắp diễn ra'}</span><span className={`od-status ${ongoing ? 'live' : ''}`}>{ongoing ? 'Đang mở' : 'Công khai'}</span></div>
    <h3><Link to={`/nha-to-chuc/hoat-dong/${activity.id}`}>{activity.title}</Link></h3>
    <p><CalendarDays size={15} aria-hidden="true" />{activityTime(activity.starts_at)}</p>
    <p><MapPin size={15} aria-hidden="true" />{activity.address}</p>
    <div className="od-card-footer"><div><span><Users size={15} aria-hidden="true" />{activity.approved_count} người đã duyệt</span><small>Cần tuyển {activity.capacity} người</small></div>
      <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/${ongoing ? 'diem-danh' : 'dang-ky'}`}>{ongoing ? 'Điểm danh' : 'Xét duyệt'}</Link>
    </div>
  </article>
}

function PendingRegistrations({ data }) {
  if (!data.pending_count) return <div id="od-pending" className="od-pending-clear" role="status"><CheckCircle2 size={20} aria-hidden="true" />Không có đơn chờ xét duyệt.</div>
  return <section className="od-panel od-pending-panel" id="od-pending" aria-labelledby="od-pending-title">
    <div className="od-panel-heading"><h2 id="od-pending-title">Đăng ký cần xử lý</h2><span className="od-count">{data.pending_count} đơn chờ duyệt</span></div>
    <ul className="od-pending-list">{data.pending.map(entry => <li key={entry.id}>
      <Link className="od-pending-row" to={`/nha-to-chuc/hoat-dong/${entry.activity_id}/dang-ky?status=pending`}>
        <span className="od-person-icon"><UserRound size={18} aria-hidden="true" /></span>
        <div><strong>{entry.volunteer_name}</strong><p>{entry.activity_title}</p></div>
      </Link>
    </li>)}</ul>
    {data.pending_count > data.pending.length && <Link className="button secondary od-pending-more" to="/nha-to-chuc/dang-ky">Xem tất cả đơn đăng ký</Link>}
  </section>
}

export default function OrganizerDashboard() {
  const { data, loading, error, retry } = useApi('/reports/organizer-dashboard/')
  return <div className="od-content">
    <div className="od-heading"><h1>Tổng quan Nhà tổ chức</h1></div>
    <div className="od-toolbar">
      <Link className="od-create" to="/nha-to-chuc/hoat-dong/tao"><Plus size={18} aria-hidden="true" />Tạo hoạt động mới</Link>
      <button type="button" className="button secondary refresh-button" onClick={retry} disabled={loading}><RefreshCw size={16} aria-hidden="true" />{loading ? 'Đang tải…' : 'Làm mới'}</button>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="od-metrics" aria-label="Thống kê Nhà tổ chức">
        <Link className="od-metric" to="/nha-to-chuc/hoat-dong"><span className="od-metric-icon purple"><CalendarDays size={20} aria-hidden="true" /></span><span className="od-metric-label">Hoạt động đã tạo</span><strong data-testid="od-total">{data.activity_counts.total}</strong><span>{data.activity_counts.draft} bản nháp</span></Link>
        <a className="od-metric" href="#od-pending"><span className="od-metric-icon blue"><ClipboardList size={20} aria-hidden="true" /></span><span className="od-metric-label">Đơn chờ xét duyệt</span><strong data-testid="od-pending-count">{data.pending_count}</strong><span>Đơn có thể xét duyệt</span></a>
        <Link className="od-metric" to="/nha-to-chuc/hoat-dong?status=completed"><span className="od-metric-icon green"><CheckCircle2 size={20} aria-hidden="true" /></span><span className="od-metric-label">Hoạt động hoàn thành</span><strong data-testid="od-completed">{data.activity_counts.completed}</strong><span>Đã cập nhật kết quả</span></Link>
      </div>
      <PendingRegistrations data={data} />
      <section className="od-panel" aria-labelledby="od-current-title">
        <div className="od-panel-heading"><h2 id="od-current-title">Hoạt động đang diễn ra</h2><span className="od-status live">{data.ongoing_count} hoạt động</span></div>
        {data.ongoing.length ? <div className="od-activity-grid">{data.ongoing.map(activity => <ActivityCard key={activity.id} activity={activity} ongoing />)}</div>
          : <div className="od-empty compact"><CalendarDays size={22} aria-hidden="true" /><strong>Chưa có hoạt động đang diễn ra</strong></div>}
      </section>
      <div className="od-bottom-grid">
        <section className="od-panel" aria-labelledby="od-upcoming-title">
          <div className="od-panel-heading"><h2 id="od-upcoming-title">Hoạt động sắp tới</h2><span className="od-count">{data.upcoming_count} hoạt động</span></div>
          {data.upcoming.length ? <div className="od-upcoming-list">{data.upcoming.map(activity => <ActivityCard key={activity.id} activity={activity} />)}</div>
            : <div className="od-empty compact"><CalendarDays size={22} aria-hidden="true" /><strong>Chưa có hoạt động sắp tới</strong></div>}
        </section>
        <section className="od-report-card"><span className="od-metric-icon green"><BarChart3 size={21} aria-hidden="true" /></span><h2>Kết quả & phản hồi</h2>
          <dl><div><dt>Lượt tham gia đã hoàn thành</dt><dd>{data.metrics.attended_completed}</dd></div><div><dt>Phản hồi hợp lệ</dt><dd>{data.metrics.feedback.count}</dd></div></dl>
          <Link className="button secondary" to="/bao-cao">Xem báo cáo</Link>
        </section>
      </div>
    </>}
  </div>
}
