import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Compass, History, Mail, UserRound } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime, activityStatuses } from '../api/activityFormat.js'
import '../styles/volunteer-dashboard.css'

const memberDate = value => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))

function Avatar({ profile }) {
  const [failed, setFailed] = useState(false)
  return <span className="vd-avatar">{profile.avatar_url && !failed
    ? <img src={profile.avatar_url} alt="" onError={() => setFailed(true)} />
    : <UserRound size={28} aria-hidden="true" />}</span>
}

function ActivityRow({ entry, history = false }) {
  return <li className="vd-activity-row">
    <span className={`vd-row-icon ${history ? 'green' : 'blue'}`}>{history ? <CheckCircle2 size={20} /> : <CalendarDays size={20} />}</span>
    <div className="vd-row-content"><Link to={`/hoat-dong/${entry.activity.id}`}>{entry.activity.title}</Link>
      <p>{entry.activity.organizer_name}</p>
      <p>{activityTime(history ? entry.attendance.confirmed_at : entry.activity.starts_at)} (giờ Việt Nam)</p>
    </div>
    <span className={`vd-badge ${history && entry.activity.status === 'cancelled' ? 'muted' : history ? 'green' : 'blue'}`}>
      {history ? activityStatuses[entry.activity.status] : 'Sắp diễn ra'}
    </span>
  </li>
}

export default function VolunteerDashboard() {
  const { data, loading, error, retry } = useApi('/reports/volunteer-dashboard/')
  return <section className="vd-page" aria-labelledby="vd-title">
    <div className="vd-heading"><div><p className="vd-eyebrow">KHÔNG GIAN TÌNH NGUYỆN VIÊN</p>
      <h1 id="vd-title">Tổng quan</h1><p>Theo dõi hoạt động đã đăng ký, lịch sắp tới và hành trình đóng góp của bạn.</p></div>
      <Link className="vd-text-link" to="/hoat-dong">Khám phá hoạt động <ArrowRight size={16} /></Link>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="vd-intro-grid">
        <article className="vd-welcome">
          <span className="vd-welcome-label">Chào mừng trở lại</span>
          <div className="vd-person"><Avatar profile={data.profile} /><div><h2>Xin chào, {data.profile.full_name}.</h2><p>Tình nguyện viên</p></div></div>
          <p className="vd-bio">{data.profile.bio || 'Cùng V-Connect kết nối với cộng đồng và tạo nên những thay đổi tích cực.'}</p>
          <div className="vd-profile-facts"><div><span>THÀNH VIÊN TỪ</span><strong>{memberDate(data.member_since)}</strong></div>
            <div><span><Mail size={13} /> EMAIL LIÊN HỆ</span><strong>{data.profile.email}</strong></div></div>
        </article>
        <aside className="vd-panel vd-actions" aria-labelledby="vd-actions-title"><h2 id="vd-actions-title">Thao tác nhanh</h2><p>Tiếp tục hành trình tình nguyện của bạn.</p>
          <Link className="vd-action vd-primary" to="/hoat-dong"><Compass size={17} />Tìm hoạt động</Link>
          <Link className="vd-action" to="/tinh-nguyen-vien/dang-ky"><ClipboardList size={17} />Đăng ký của tôi</Link>
          <Link className="vd-action" to="/tinh-nguyen-vien/lich-su"><History size={17} />Lịch sử tham gia</Link>
          <Link className="vd-action" to="/ho-so"><UserRound size={17} />Chỉnh sửa hồ sơ</Link>
        </aside>
      </div>
      <div className="vd-metrics" aria-label="Thống kê tham gia">
        <Link className="vd-stat" to="/tinh-nguyen-vien/dang-ky"><span className="vd-row-icon purple"><ClipboardList /></span><div><span>HOẠT ĐỘNG ĐÃ ĐĂNG KÝ</span><strong>{data.metrics.registered}</strong></div></Link>
        <a className="vd-stat" href="#vd-upcoming"><span className="vd-row-icon blue"><CalendarDays /></span><div><span>HOẠT ĐỘNG SẮP TỚI</span><strong>{data.upcoming_count}</strong></div></a>
        <Link className="vd-stat" to="/bao-cao/dang-ky?metric=attended_completed"><span className="vd-row-icon green"><CheckCircle2 /></span><div><span>ĐÃ THAM GIA · HOÀN THÀNH</span><strong>{data.metrics.attended_completed}</strong></div></Link>
      </div>
      <section className="vd-panel" id="vd-upcoming" aria-labelledby="vd-upcoming-title"><div className="vd-panel-heading"><div><h2 id="vd-upcoming-title">Hoạt động sắp tới</h2><p>Những hoạt động bạn đã được duyệt, sắp đến giờ bắt đầu.</p></div><Link className="vd-text-link" to="/tinh-nguyen-vien/dang-ky">Xem đăng ký <ArrowRight size={16} /></Link></div>
        {data.upcoming.length ? <ul className="vd-list">{data.upcoming.map(entry => <ActivityRow key={entry.id} entry={entry} />)}</ul>
          : <div className="vd-empty"><CalendarDays size={28} /><h3>Chưa có hoạt động sắp tới</h3><p>Khám phá hoạt động và đăng ký để bắt đầu hành trình của bạn.</p><Link className="vd-text-link" to="/hoat-dong">Khám phá ngay <ArrowRight size={16} /></Link></div>}
      </section>
      <section className="vd-panel" aria-labelledby="vd-history-title"><div className="vd-panel-heading"><div><h2 id="vd-history-title">Lịch sử tham gia gần đây</h2><p>Các lượt có mặt đã được Nhà tổ chức xác nhận. Hoạt động bị hủy được ghi rõ.</p></div><Link className="vd-text-link" to="/tinh-nguyen-vien/lich-su">Xem toàn bộ lịch sử <ArrowRight size={16} /></Link></div>
        {data.history.length ? <ul className="vd-list">{data.history.map(entry => <ActivityRow key={entry.id} entry={entry} history />)}</ul>
          : <div className="vd-empty"><History size={28} /><h3>Hành trình của bạn đang bắt đầu</h3><p>Lịch sử sẽ xuất hiện sau khi bạn được xác nhận có mặt tại hoạt động.</p></div>}
      </section>
      <div className="vd-bottom"><span>Mỗi lần tham gia, thêm một điều ý nghĩa.</span><Link className="vd-text-link" to="/bao-cao">Xem thống kê <ArrowRight size={16} /></Link></div>
    </>}
  </section>
}
