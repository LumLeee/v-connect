import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ClipboardList, Mail, RefreshCw, ScanLine, UserRound } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import ActionRow from '../components/ActionRow.jsx'
import RequestState from '../components/RequestState.jsx'
import { activityTime, activityStatuses } from '../api/activityFormat.js'
import '../styles/volunteer-dashboard.css'

function Avatar({ profile }) {
  const [failed, setFailed] = useState(false)
  return <span className="vd-avatar">{profile.avatar_url && !failed
    ? <img src={profile.avatar_url} alt="" onError={() => setFailed(true)} />
    : <UserRound size={23} aria-hidden="true" />}</span>
}

function ActivityRow({ entry, mode = 'upcoming' }) {
  const history = mode === 'history'
  const checkin = mode === 'checkin'
  const to = checkin ? `/hoat-dong/${entry.activity.id}/check-in`
    : entry.activity.status === 'published' ? `/hoat-dong/${entry.activity.id}` : '/tinh-nguyen-vien/lich-su'
  return <ActionRow className={`vd-activity-row${checkin ? ' vd-checkin-row' : ''}`} label={`Xem ${entry.activity.title}`}>
    <span className={`vd-row-icon ${history ? 'green' : checkin ? 'amber' : 'blue'}`}>
      {history ? <CheckCircle2 size={20} aria-hidden="true" /> : checkin ? <ScanLine size={20} aria-hidden="true" /> : <CalendarDays size={20} aria-hidden="true" />}
    </span>
    <div className="vd-row-content"><h3><Link data-row-primary to={to}>{entry.activity.title}</Link></h3>
      <p>{entry.activity.organizer_name}</p>
      <p>{history ? 'Điểm danh: ' : checkin ? 'Kết thúc: ' : 'Bắt đầu: '}
        <time dateTime={history ? entry.attendance.confirmed_at : checkin ? entry.activity.ends_at : entry.activity.starts_at}>
          {activityTime(history ? entry.attendance.confirmed_at : checkin ? entry.activity.ends_at : entry.activity.starts_at)}
        </time>
      </p>
      {!history && entry.activity_changed && <p className="vd-change-note">Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký.</p>}
    </div>
    {checkin ? <Link data-row-keep-action className="button primary" to={to}>Điểm danh</Link>
      : <span className={`vd-badge ${history ? 'muted' : 'blue'}`}>{history ? activityStatuses[entry.activity.status] : 'Sắp diễn ra'}</span>}
  </ActionRow>
}

export default function VolunteerDashboard() {
  const { data, loading, error, retry } = useApi('/reports/volunteer-dashboard/')
  return <section className="vd-page vd-overview" aria-labelledby="vd-title" aria-busy={loading}>
    <div className="vd-heading"><h1 id="vd-title">Tổng quan</h1>
      <div className="vd-heading-actions"><Link className="button primary" to="/hoat-dong">Khám phá hoạt động</Link>
        <button type="button" className="button secondary refresh-button" disabled={loading} onClick={retry}><RefreshCw size={16} aria-hidden="true" />Làm mới</button>
      </div>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <Link className="vd-welcome" to="/ho-so" aria-label="Xem hồ sơ cá nhân"><Avatar profile={data.profile} />
        <div><h2>{data.profile.full_name}</h2><p>Tình nguyện viên</p></div>
      </Link>
      <div className="vd-metrics" aria-label="Việc cần theo dõi">
        <Link className="vd-stat" to="/tinh-nguyen-vien/loi-moi?status=pending"><span className="vd-row-icon purple"><Mail size={21} aria-hidden="true" /></span><div><span>Lời mời chờ phản hồi</span><strong>{data.summary.pending_invitations}</strong></div></Link>
        <Link className="vd-stat" to="/tinh-nguyen-vien/dang-ky?status=pending"><span className="vd-row-icon blue"><ClipboardList size={21} aria-hidden="true" /></span><div><span>Đơn chờ duyệt</span><strong>{data.summary.pending_registrations}</strong></div></Link>
        <Link className="vd-stat" to="/tinh-nguyen-vien/check-in"><span className="vd-row-icon amber"><ScanLine size={21} aria-hidden="true" /></span><div><span>Đang mở điểm danh</span><strong>{data.checkin_now_count}</strong></div></Link>
        <Link className="vd-stat" to="/tinh-nguyen-vien/lich-su"><span className="vd-row-icon green"><CheckCircle2 size={21} aria-hidden="true" /></span><div><span>Đã tham gia · Hoàn thành</span><strong>{data.metrics.attended_completed}</strong></div></Link>
      </div>
      {data.checkin_now_count > 0 && <section className="vd-panel vd-checkin-panel" aria-labelledby="vd-checkin-title">
        <div className="vd-panel-heading"><div><h2 id="vd-checkin-title">Đang mở điểm danh</h2><p>{data.checkin_now_count} hoạt động bạn đã được duyệt và chưa điểm danh.</p></div><Link className="button secondary" to="/tinh-nguyen-vien/check-in">Xem tất cả</Link></div>
        <div className="vd-list">{data.checkin_now.map(entry => <ActivityRow key={entry.id} entry={entry} mode="checkin" />)}</div>
      </section>}
      <section id="vd-upcoming" className="vd-panel" aria-labelledby="vd-upcoming-title">
        <div className="vd-panel-heading"><div><h2 id="vd-upcoming-title">Hoạt động sắp tới</h2><p>{data.upcoming_count} hoạt động đã được duyệt, sắp đến giờ bắt đầu.</p></div><Link className="button secondary" to="/tinh-nguyen-vien/check-in">Xem hoạt động được duyệt</Link></div>
        {data.upcoming.length ? <div className="vd-list">{data.upcoming.map(entry => <ActivityRow key={entry.id} entry={entry} />)}</div>
          : <div className="vd-empty"><CalendarDays size={24} aria-hidden="true" /><p>Chưa có hoạt động sắp tới.</p><Link className="button secondary" to="/hoat-dong">Tìm hoạt động</Link></div>}
      </section>
      <section className="vd-panel" aria-labelledby="vd-history-title">
        <div className="vd-panel-heading"><h2 id="vd-history-title">Lịch sử tham gia gần đây</h2><Link className="button secondary" to="/tinh-nguyen-vien/lich-su">Xem lịch sử</Link></div>
        {data.history.length ? <div className="vd-list">{data.history.map(entry => <ActivityRow key={entry.id} entry={entry} mode="history" />)}</div>
          : <div className="vd-empty"><CheckCircle2 size={24} aria-hidden="true" /><p>Lịch sử sẽ xuất hiện sau khi bạn được xác nhận có mặt.</p></div>}
      </section>
    </>}
  </section>
}
