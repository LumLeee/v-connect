import { Link } from 'react-router-dom'
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, MapPin, Plus, RefreshCw, UserRound, Users } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/organizer-dashboard.css'

function ActivityCard({ activity, ongoing = false }) {
  return <article className="od-activity-card">
    <div className="od-card-label"><span>{ongoing ? 'ĐANG DIỄN RA' : 'SẮP DIỄN RA'}</span><span className={`od-status ${ongoing ? 'live' : ''}`}>{ongoing ? 'Đang mở' : 'Công khai'}</span></div>
    <h3><Link to={`/nha-to-chuc/hoat-dong/${activity.id}`}>{activity.title}</Link></h3>
    <p><CalendarDays size={15} aria-hidden="true" />{activityTime(activity.starts_at)}</p>
    <p><MapPin size={15} aria-hidden="true" />{activity.address}</p>
    <div className="od-card-footer"><span><Users size={15} aria-hidden="true" />{activity.approved_count}/{activity.capacity} đã duyệt</span>
      <Link className="button secondary arrow-link-button" to={`/nha-to-chuc/hoat-dong/${activity.id}/${ongoing ? 'diem-danh' : 'dang-ky'}`}>{ongoing ? 'Điểm danh' : 'Xét duyệt'} </Link></div>
  </article>
}

export default function OrganizerDashboard() {
  const { data, loading, error, retry } = useApi('/reports/organizer-dashboard/')
  return <div className="od-content">
        <div className="od-heading"><div><p className="od-eyebrow">CÙNG CỘNG ĐỒNG TẠO KHÁC BIỆT</p><h1>Tổng quan Nhà tổ chức</h1></div></div>
        <div className="od-toolbar">
          <Link className="od-create" to="/nha-to-chuc/hoat-dong/tao"><Plus size={18} aria-hidden="true" />Tạo hoạt động mới</Link>
          <button type="button" className="button secondary refresh-button" onClick={retry}><RefreshCw size={15} aria-hidden="true" />Làm mới</button>
        </div>
        <RequestState loading={loading} error={error} retry={retry} />
        {data && <>
          <div className="od-metrics" aria-label="Thống kê Nhà tổ chức">
            <Link className="od-metric" to="/nha-to-chuc/hoat-dong"><span className="od-metric-icon purple"><CalendarDays size={20} aria-hidden="true" /></span><span className="od-metric-label">HOẠT ĐỘNG ĐÃ TẠO</span><strong data-testid="od-total">{data.activity_counts.total}</strong><span>Bao gồm {data.activity_counts.draft} bản nháp</span></Link>
            <a className="od-metric" href="#od-pending"><span className="od-metric-icon blue"><ClipboardList size={20} aria-hidden="true" /></span><span className="od-metric-label">ĐƠN CHỜ XÉT DUYỆT</span><strong data-testid="od-pending-count">{data.pending_count}</strong><span>Đơn đăng ký có thể xét duyệt</span></a>
            <Link className="od-metric" to="/nha-to-chuc/hoat-dong?status=completed"><span className="od-metric-icon green"><CheckCircle2 size={20} aria-hidden="true" /></span><span className="od-metric-label">HOẠT ĐỘNG HOÀN THÀNH</span><strong data-testid="od-completed">{data.activity_counts.completed}</strong><span>Đã cập nhật kết quả hoạt động</span></Link>
          </div>
          <section className="od-panel" aria-labelledby="od-current-title"><div className="od-panel-heading"><div><h2 id="od-current-title">Hoạt động đang diễn ra</h2><p>Theo dõi người tham gia và cập nhật điểm danh.</p></div><span className="od-status live">{data.ongoing_count} hoạt động</span></div>
            {data.ongoing.length ? <div className="od-activity-grid">{data.ongoing.map(activity => <ActivityCard key={activity.id} activity={activity} ongoing />)}</div>
              : <div className="od-empty"><CalendarDays size={26} aria-hidden="true" /><strong>Chưa có hoạt động đang diễn ra</strong><p>Hoạt động Công khai sẽ xuất hiện tại đây khi đến giờ bắt đầu.</p></div>}
          </section>
          <div className="od-bottom-grid">
            <section className="od-panel" aria-labelledby="od-upcoming-title"><div className="od-panel-heading"><div><h2 id="od-upcoming-title">Hoạt động sắp tới</h2><p>{data.upcoming_count} hoạt động Công khai chưa bắt đầu.</p></div><Link className="button secondary arrow-link-button" to="/nha-to-chuc/hoat-dong">Xem tất cả </Link></div>
              {data.upcoming.length ? <div className="od-upcoming-list">{data.upcoming.map(activity => <ActivityCard key={activity.id} activity={activity} />)}</div>
                : <div className="od-empty"><CalendarDays size={26} aria-hidden="true" /><strong>Chưa có hoạt động sắp tới</strong><p>Tạo hoạt động và công khai để bắt đầu nhận đăng ký.</p></div>}
            </section>
            <div className="od-right-column">
              <section className="od-panel" id="od-pending" aria-labelledby="od-pending-title"><div className="od-panel-heading"><div><h2 id="od-pending-title">Đăng ký cần xử lý</h2><p>Các đơn đăng ký đang chờ bạn xử lý.</p></div><span className="od-count">{data.pending_count}</span></div>
                {data.pending.length ? <ul className="od-pending-list">{data.pending.map(entry => <li key={entry.id}><span className="od-person-icon"><UserRound size={18} aria-hidden="true" /></span><div><strong>{entry.volunteer_name}</strong><p>{entry.activity_title}</p><Link className="button secondary arrow-link-button" to={`/nha-to-chuc/hoat-dong/${entry.activity_id}/dang-ky`}>Xem đơn đăng ký </Link></div></li>)}</ul>
                  : <div className="od-empty compact"><CheckCircle2 size={26} aria-hidden="true" /><strong>Không có đơn cần xét duyệt</strong><p>Đơn đăng ký cần xét duyệt sẽ xuất hiện tại đây.</p></div>}
              </section>
              <section className="od-report-card"><span className="od-metric-icon green"><BarChart3 size={21} aria-hidden="true" /></span><h2>Kết quả & phản hồi</h2><p>Theo dõi hiệu quả các hoạt động bạn tổ chức.</p><dl><div><dt>Lượt tham gia đã hoàn thành</dt><dd>{data.metrics.attended_completed}</dd></div><div><dt>Phản hồi hiển thị</dt><dd>{data.metrics.feedback.count}</dd></div></dl>
                <Link className="button secondary arrow-link-button" to="/bao-cao">Xem thống kê </Link><Link className="button secondary arrow-link-button" to="/bao-cao/mo-rong">Biểu đồ và xuất báo cáo </Link></section>
            </div>
          </div>
          <footer className="od-footer"><span>V-Connect · Kết nối để sẻ chia.</span><Link to="/thong-bao">Xem thông báo</Link></footer>
        </>}
  </div>
}
