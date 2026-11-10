import ConfirmationDialog from './ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import { apiPost } from '../api/client.js'
import { participationLabels } from '../api/participationFormat.js'
import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'
import AttendanceStatus from './AttendanceStatus.jsx'
import { RefreshCw } from 'lucide-react'

function VolunteerPanel({ activity, refresh }) {
  const { data, loading, error, retry } = useApi(`/activities/${activity.id}/participation/`)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const participation = data?.participation
  const open = activity.status === 'published' && (activity.time_checks_disabled || new Date(activity.starts_at) > new Date())
  const organizerUnavailable = activity.organizer_active === false
  const registerAllowed = !participation || (participation.status === 'cancelled' && participation.cancellation_reason === 'volunteer')
  const full = activity.approved_count >= activity.capacity
  const checkinOpen = activity.status === 'published' && (activity.time_checks_disabled || (new Date(activity.starts_at) <= new Date() && new Date(activity.ends_at) >= new Date()))
  const showRegister = open && registerAllowed && !organizerUnavailable
  const showCheckin = participation?.status === 'approved' && !participation.attendance && checkinOpen
  const showFeedback = participation?.attendance && activity.status === 'completed'
  const showHistory = participation?.attendance && !showFeedback
  const showRegistrations = !showRegister && !showCheckin && !participation?.attendance && Boolean(participation)
  const canCancel = open && !participation?.attendance && ['pending', 'approved'].includes(participation?.status)
  async function submit(cancel = false) {
    setBusy(true); setFailure('')
    try {
      await apiPost(`/activities/${activity.id}/participation/${cancel ? 'cancel/' : ''}`, {})
      setConfirm(false); retry(); refresh()
    } catch (problem) { setFailure(problem.message) }
    finally { setBusy(false) }
  }
  return <section className="activity-confirm va-participation" aria-label="Đăng ký tham gia" aria-busy={busy}>
    <header className="va-participation-heading"><h2>Tham gia hoạt động</h2>
      <button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={() => { setFailure(''); retry(); refresh() }}><RefreshCw size={15} aria-hidden="true" />Làm mới</button>
    </header>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <p role="status" className={`va-participation-status va-state-${participation?.status || 'new'}`}>{participation ? `Trạng thái: ${participationLabels[participation.status]}` : 'Bạn chưa đăng ký hoạt động này.'}</p>
      {participation?.status === 'pending' && <p>Đơn của bạn đang chờ nhà tổ chức xét duyệt.</p>}
      {participation && <AttendanceStatus entry={participation} />}
      {participation?.status === 'approved' && !participation.attendance && activity.status === 'published' && !checkinOpen && <p>{new Date(activity.starts_at) > new Date() ? 'Điểm danh mở khi hoạt động bắt đầu.' : 'Đã hết thời gian điểm danh.'}</p>}
      {participation?.activity_changed && <p className="activity-empty">Thời gian hoặc địa điểm đã thay đổi từ lúc bạn đăng ký. Hãy kiểm tra lịch và địa điểm mới nhất trong thông tin hoạt động.</p>}
      {participation?.cancellation_reason === 'activity_cancelled' && <p>Đơn đăng ký đã bị hủy do hoạt động bị hủy.</p>}
      {!open && !participation?.attendance && <p>Đã đóng đăng ký, hủy đăng ký và xét duyệt.</p>}
      {organizerUnavailable && <p>Tạm ngừng nhận đăng ký vì tài khoản nhà tổ chức không còn hoạt động.</p>}
      {showRegister && <p>{full ? 'Hoạt động đã đủ số lượng người được duyệt.' : 'Đơn đăng ký sẽ được nhà tổ chức xét duyệt.'}</p>}
      {showRegister && !full && <p className="va-participation-privacy">Khi đăng ký, họ tên, email và số điện thoại của bạn được chia sẻ với nhà tổ chức để liên hệ.</p>}
      {participation?.status === 'rejected' && <p>Đơn đã bị từ chối; bạn không thể đăng ký lại hoạt động này.</p>}
      <div className="va-participation-actions">
        {showRegister && <button className="button primary" disabled={busy || full} onClick={() => submit()}>Đăng ký tham gia</button>}
        {showCheckin && <Link className="button primary" to={`/hoat-dong/${activity.id}/check-in`}>Check-in bằng QR hoặc mã</Link>}
        {showFeedback && <Link className="button primary" to={`/hoat-dong/${activity.id}/phan-hoi`}>Gửi hoặc xem phản hồi của tôi</Link>}
        {showHistory && <Link className="button primary" to="/tinh-nguyen-vien/lich-su">Xem lịch sử hoạt động</Link>}
        {showRegistrations && <Link className="button primary" to="/tinh-nguyen-vien/dang-ky">Xem các đăng ký của tôi</Link>}
        {!participation && (!open || organizerUnavailable) && <Link className="button secondary" to="/hoat-dong">Khám phá hoạt động khác</Link>}
      </div>
      {canCancel && <div className="va-participation-cancel"><button className="button secondary" disabled={busy} onClick={() => { setFailure(''); setConfirm(true) }}>Hủy đăng ký</button></div>}
      {activity.time_checks_disabled && <p className="va-participation-policy">Đang thử nghiệm: tạm bỏ giới hạn thời gian đăng ký, hủy và xét duyệt.</p>}
      {confirm && <ConfirmationDialog title="Xác nhận hủy đăng ký" busy={busy} onClose={() => setConfirm(false)}><div aria-label="Xác nhận hủy đăng ký">{failure && <p role="alert" className="request-error">{failure}</p>}<p>Bạn muốn hủy đăng ký? Nếu đăng ký lại, đơn sẽ trở về chờ duyệt.</p>
        <button className="button primary" disabled={busy} onClick={() => submit(true)}>Xác nhận hủy đăng ký</button>{' '}
        <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button></div></ConfirmationDialog>}
    </>}
    {busy && <p role="status">Đang xử lý…</p>}{failure && !confirm && <p className="request-error" role="alert">{failure}</p>}
    {!showRegistrations && <Link className="va-participation-list-link" to="/tinh-nguyen-vien/dang-ky">Xem các đăng ký của tôi</Link>}
  </section>
}

export default function ParticipationPanel({ activity, refresh }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <section className="activity-confirm va-participation va-participation-guest"><h2>Tham gia hoạt động</h2><p>Đăng nhập bằng tài khoản Tình nguyện viên để đăng ký tham gia.</p><Link className="button primary" to="/dang-nhap">Đăng nhập</Link></section>
  if (user.role !== 'volunteer') return <section className="activity-confirm va-participation"><h2>Tham gia hoạt động</h2><p>Đăng ký tham gia dành cho tài khoản Tình nguyện viên.</p></section>
  return <VolunteerPanel key={`${user.id}-${activity.id}`} activity={activity} refresh={refresh} />
}
