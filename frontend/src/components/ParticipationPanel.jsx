import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import { apiPost } from '../api/client.js'
import { participationLabels } from '../api/participationFormat.js'
import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'

function VolunteerPanel({ activity, refresh }) {
  const { data, loading, error, retry } = useApi(`/activities/${activity.id}/participation/`)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const participation = data?.participation
  const open = activity.status === 'published' && new Date(activity.starts_at) > new Date()
  const registerAllowed = !participation || (participation.status === 'cancelled' && participation.cancellation_reason === 'volunteer')
  async function submit(cancel = false) {
    setBusy(true); setFailure('')
    try {
      await apiPost(`/activities/${activity.id}/participation/${cancel ? 'cancel/' : ''}`, {})
      setConfirm(false); retry(); refresh()
    } catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  return <div className="activity-confirm" aria-label="Đăng ký tham gia">
    <h2>Đăng ký tham gia</h2><RequestState loading={loading} error={error} retry={retry} />
    <button className="text-button" disabled={busy} onClick={() => { retry(); refresh() }}>Cập nhật trạng thái</button>
    {data && <>
      <p role="status">{participation ? `Trạng thái: ${participationLabels[participation.status]}` : 'Bạn chưa đăng ký hoạt động này.'}</p>
      {participation?.activity_changed && <p className="activity-empty">Thời gian hoặc địa điểm đã thay đổi từ lúc bạn đăng ký. Hãy kiểm tra thông tin hoạt động mới nhất ở trên.</p>}
      {participation?.cancellation_reason === 'activity_cancelled' && <p>Đơn đăng ký đã bị hủy do hoạt động bị hủy.</p>}
      {!open && <p>Đã đóng đăng ký, hủy đăng ký và xét duyệt.</p>}
      {open && registerAllowed && <><p>Đăng ký được gửi để Nhà tổ chức xét duyệt. Thông tin họ tên, email và số điện thoại của bạn được chia sẻ với Nhà tổ chức để liên hệ.</p>
        <button className="button primary" disabled={busy || activity.approved_count >= activity.capacity} onClick={() => submit()}>Đăng ký tham gia</button>
        {activity.approved_count >= activity.capacity && <p>Hoạt động đã đủ số lượng người được duyệt.</p>}</>}
      {open && ['pending', 'approved'].includes(participation?.status) && <button className="button secondary" disabled={busy} onClick={() => setConfirm(true)}>Hủy đăng ký</button>}
      {participation?.status === 'rejected' && <p>Đơn đã bị từ chối; bạn không thể đăng ký lại hoạt động này.</p>}
      {confirm && <div role="region" aria-label="Xác nhận hủy đăng ký"><p>Bạn muốn hủy đăng ký? Nếu đăng ký lại, đơn sẽ trở về chờ duyệt.</p>
        <button className="button primary" disabled={busy} onClick={() => submit(true)}>Xác nhận hủy đăng ký</button>{' '}
        <button className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button></div>}
    </>}
    {busy && <p role="status">Đang xử lý…</p>}{failure && <p className="request-error" role="alert">{failure}</p>}
    <p><Link to="/tinh-nguyen-vien/dang-ky">Xem các đăng ký của tôi</Link></p>
  </div>
}

export default function ParticipationPanel({ activity, refresh }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <p className="activity-empty"><Link to="/dang-nhap">Đăng nhập</Link> bằng tài khoản Tình nguyện viên để đăng ký tham gia.</p>
  if (user.role !== 'volunteer') return <p className="activity-empty">Đăng ký tham gia dành cho tài khoản Tình nguyện viên.</p>
  return <VolunteerPanel key={`${user.id}-${activity.id}`} activity={activity} refresh={refresh} />
}
