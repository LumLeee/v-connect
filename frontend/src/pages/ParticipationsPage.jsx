import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import { apiPost } from '../api/client.js'
import { participationLabels } from '../api/participationFormat.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

export default function ParticipationsPage({ managed = false, history = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/applicants/` : history ? '/participations/history/' : '/participations/'}?page=${page}&page_size=12`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function review() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/applicants/${pending.id}/review/`, { status: pending.status })
      setMessage('Đã cập nhật kết quả xét duyệt.'); setPending(null); retry()
    } catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message); retry() }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={managed ? `/nha-to-chuc/hoat-dong/${id}` : '/tinh-nguyen-vien'}>← {managed ? 'Về hoạt động' : 'Về tài khoản'}</Link>
    <h1>{managed ? 'Danh sách đăng ký' : history ? 'Lịch sử tham gia' : 'Đăng ký của tôi'}</h1>
    <p>{history ? 'Các hoạt động đã được Nhà tổ chức xác nhận có mặt, mới nhất trước.' : 'Đăng ký, hủy và xét duyệt chỉ thực hiện trước giờ bắt đầu hoạt động.'}</p>
    <button className="text-button" disabled={busy} onClick={retry}>Cập nhật danh sách</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {pending && <div className="activity-confirm" role="region" aria-label="Xác nhận xét duyệt"><p>{pending.status === 'approved' ? 'Duyệt' : 'Từ chối'} đơn của {pending.name}? Kết quả này không thể sửa lại tại đây.</p>
      <button className="button primary" disabled={busy} onClick={review}>Xác nhận xét duyệt</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>}
    {data && <>
      <p>{data.count} {history ? 'lượt ghi nhận có mặt' : 'đơn đăng ký'}.</p>
      {!data.count && <p className="activity-empty">{history ? 'Chưa có hoạt động được xác nhận có mặt.' : 'Chưa có đơn đăng ký.'}</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}>
        <h2>{managed ? entry.volunteer_name : <Link to={`/hoat-dong/${entry.activity.id}`}>{entry.activity.title}</Link>}</h2>
        <p>Trạng thái đơn: <strong>{participationLabels[entry.status]}</strong></p>
        <p>Hoạt động: {activityStatuses[entry.activity.status]}</p>
        <AttendanceStatus entry={entry} />
        <p>{activityTime(entry.activity.starts_at)} (giờ Việt Nam)</p><p>{entry.activity.address}</p>
        {managed && <><p>Email: {entry.volunteer_email}</p><p>Điện thoại: {entry.volunteer_phone || 'Chưa cung cấp'}</p>
          <p>Đã duyệt: {entry.activity.approved_count}/{entry.activity.capacity}</p></>}
        {entry.activity_changed && <p className="activity-empty">Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký. Thông tin trên là mới nhất.</p>}
        {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
        {entry.status === 'pending' && new Date(entry.activity.starts_at) <= new Date() && <p>Đã hết hạn xét duyệt.</p>}
        {managed && entry.status === 'pending' && entry.activity.status === 'published' && new Date(entry.activity.starts_at) > new Date() && <div className="activity-actions">
          <button className="button primary" disabled={busy || entry.activity.approved_count >= entry.activity.capacity} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'approved' }); setFailure('') }}>Duyệt</button>
          <button className="button secondary" disabled={busy} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'rejected' }); setFailure('') }}>Từ chối</button>
        </div>}
        {!managed && <Link to={`/hoat-dong/${entry.activity.id}`}>Xem hoạt động và quản lý đăng ký</Link>}
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang đăng ký">
        <button className="button secondary" disabled={!data.previous || busy} onClick={() => { setPending(null); setParams({ page: String(page - 1) }) }}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next || busy} onClick={() => { setPending(null); setParams({ page: String(page + 1) }) }}>Trang sau</button>
      </nav>}
    </>}
  </section>
}
