import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ClipboardList } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { participationLabels } from '../api/participationFormat.js'

const modes = {
  registrations: ['Đăng ký của tôi', 'Theo dõi kết quả xét duyệt và quản lý các hoạt động bạn đã đăng ký.'],
  history: ['Lịch sử tham gia', 'Những lần đóng góp đã được ghi nhận có mặt. Hoạt động bị hủy được hiển thị rõ.'],
  checkin: ['Điểm danh của tôi', 'Chọn hoạt động đã được duyệt để quét QR hoặc nhập mã khi đến tham gia.'],
  feedback: ['Đánh giá hoạt động', 'Chọn hoạt động đã hoàn thành và được ghi nhận có mặt để gửi hoặc xem phản hồi.'],
}

function Summary() {
  const { data, loading, error, retry } = useApi('/reports/overview/')
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <div className="vs-summary" aria-label="Tổng hợp tham gia">
    {[[ClipboardList, 'Tổng đơn đăng ký', data.metrics.registered], [CalendarDays, 'Đơn được duyệt', data.metrics.approved], [CheckCircle2, 'Đã tham gia · Hoàn thành', data.metrics.attended_completed]].map(([Icon, label, value]) => <div key={label}><Icon size={21} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>}</>
}

export default function VolunteerParticipations({ mode = 'registrations' }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const history = ['history', 'feedback'].includes(mode)
  const { data, loading, error, retry } = useApi(`${history ? '/participations/history/' : '/participations/'}?page=${page}&page_size=12`)
  const [title, description] = modes[mode]
  return <section className="page-width section interior activity-page vs-participations">
    <div className="vs-page-heading"><div><p className="vs-eyebrow">HÀNH TRÌNH CỦA BẠN</p><h1>{title}</h1><p>{description}</p></div><Link className="button primary" to="/hoat-dong">Tìm hoạt động</Link></div>
    <Summary />
    <div className="vs-list-toolbar"><h2>{history ? 'Các lượt tham gia được ghi nhận' : 'Các hoạt động đã đăng ký'}</h2><button className="text-button" onClick={retry}>Cập nhật danh sách</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><p>{data.count} {history ? 'lượt ghi nhận có mặt' : 'đơn đăng ký'}.</p>
      {!data.count && <div className="activity-empty"><p>{history ? 'Chưa có hoạt động được xác nhận có mặt.' : 'Chưa có đơn đăng ký.'}</p><Link to="/hoat-dong">Khám phá cơ hội tình nguyện →</Link></div>}
      {!!data.count && <div className="vs-row-labels" aria-hidden="true"><span>HOẠT ĐỘNG / NHÀ TỔ CHỨC</span><span>THỜI GIAN / TRẠNG THÁI</span><span>THAO TÁC</span></div>}
      <div className="vs-participation-list">{data.results.map(entry => <article className="vs-participation-row" key={entry.id}>
        <div><span className={`activity-status status-${entry.activity.status}`}>{activityStatuses[entry.activity.status]}</span><h2><Link to={`/hoat-dong/${entry.activity.id}`}>{entry.activity.title}</Link></h2><p>{entry.activity.organizer_name}</p><p>{entry.activity.address}</p></div>
        <div><p>{activityTime(entry.activity.starts_at)} (giờ Việt Nam)</p><p>Trạng thái đơn: <strong>{participationLabels[entry.status]}</strong></p><AttendanceStatus entry={entry} />
          {entry.activity_changed && <p className="vs-change-note">Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký. Thông tin trên là mới nhất.</p>}
          {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
          {entry.status === 'pending' && new Date(entry.activity.starts_at) <= new Date() && <p>Đã hết hạn xét duyệt.</p>}</div>
        <div className="vs-row-actions"><Link to={`/hoat-dong/${entry.activity.id}`}>Xem hoạt động và quản lý đăng ký</Link>
          {entry.status === 'approved' && entry.activity.status === 'published' && !entry.attendance && <Link className="button secondary" to={`/hoat-dong/${entry.activity.id}/check-in`}>Check-in hoạt động</Link>}
          {entry.attendance && entry.activity.status === 'completed' && <Link className="button secondary" to={`/hoat-dong/${entry.activity.id}/phan-hoi`}>Gửi hoặc xem phản hồi của tôi</Link>}
          {mode === 'feedback' && entry.activity.status !== 'completed' && <p>Hoạt động chưa Hoàn thành nên chưa thể gửi phản hồi.</p>}
        </div>
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang đăng ký"><button className="button secondary" disabled={!data.previous} onClick={() => setParams({ page: String(page - 1) })}>Trang trước</button><span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => setParams({ page: String(page + 1) })}>Trang sau</button></nav>}
    </>}
  </section>
}
