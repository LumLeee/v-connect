import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
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
    } catch (problem) { setFailure(problem.message); retry() }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">

    <h1>{managed ? 'Danh sách đăng ký' : history ? 'Lịch sử tham gia' : 'Đăng ký của tôi'}</h1>
    {managed && <OrganizerActivityHeader key={`${id}-${data?.results?.map(entry => entry.status).join()}`} id={id} selected="registrations" />}

    <div className="list-results-toolbar">{data && <p>{data.count} {history ? 'lượt ghi nhận có mặt' : 'đơn đăng ký'}.</p>}<button type="button" className="button secondary refresh-button" disabled={busy} onClick={retry}>Làm mới</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {pending && <ConfirmationDialog title="Xác nhận xét duyệt" busy={busy} onClose={() => setPending(null)}><div className="activity-confirm" aria-label="Xác nhận xét duyệt">{failure && <p role="alert" className="request-error">{failure}</p>}<p>{pending.status === 'approved' ? 'Duyệt' : 'Từ chối'} đơn của {pending.name}? Kết quả này không thể sửa lại tại đây.</p>
      <button className="button primary" disabled={busy} onClick={review}>Xác nhận xét duyệt</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div></ConfirmationDialog>}
    {data && <>

      {!data.count && <p className="activity-empty">{history ? 'Chưa có hoạt động được xác nhận có mặt.' : 'Chưa có đơn đăng ký.'}</p>}
      <div className={`activity-grid${managed ? ' om-people-list' : ''}`}>{data.results.map(entry => managed ? <ActionRow className="activity-card om-person-row" key={entry.id}>
        <div><h2>{entry.volunteer_name}</h2><p>{entry.volunteer_email}</p><Link data-row-primary data-row-keep-action className="button secondary" to={`/ho-so?hoat-dong=${id}&ung-vien=${entry.id}`}>Xem hồ sơ</Link></div>
        <div><p>Trạng thái đơn: <strong>{participationLabels[entry.status]}</strong></p>
          <p>Đăng ký lúc: {activityTime(entry.registered_at)}</p>
          {entry.reviewed_at && ['approved', 'rejected'].includes(entry.status) && <p>Xét duyệt lúc: {activityTime(entry.reviewed_at)}</p>}
          {entry.status === 'approved' && entry.attendance && <p>Đã xác nhận có mặt</p>}
          {entry.status === 'pending' && entry.activity.approved_count >= entry.activity.capacity && <p>Đã đủ số người được duyệt.</p>}
          {entry.activity_changed && <p>Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký.</p>}
          {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
          {entry.status === 'pending' && !entry.activity.time_checks_disabled && new Date(entry.activity.starts_at) <= new Date() && <p>Đã hết hạn xét duyệt.</p>}</div>
        <div>{entry.status === 'pending' && entry.activity.status === 'published' && (entry.activity.time_checks_disabled || new Date(entry.activity.starts_at) > new Date()) && <div className="activity-actions participation-review-actions">
          <button className="button primary" disabled={busy || entry.activity.approved_count >= entry.activity.capacity} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'approved' }); setFailure('') }}>Duyệt</button>
          <button className="button secondary" disabled={busy} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'rejected' }); setFailure('') }}>Từ chối</button>
        </div>}</div>
      </ActionRow> : <ActionRow className="activity-card" key={entry.id}>
        <h2>{managed ? entry.volunteer_name : <Link to={`/hoat-dong/${entry.activity.id}`}>{entry.activity.title}</Link>}</h2>
        <p>Trạng thái đơn: <strong>{participationLabels[entry.status]}</strong></p>
        <p>Hoạt động: {activityStatuses[entry.activity.status]}</p>
        <AttendanceStatus entry={entry} />
        <p>{activityTime(entry.activity.starts_at)}</p><p>{entry.activity.address}</p>
        {managed && <><RecordDetails title={entry.volunteer_name}><p>Email: {entry.volunteer_email}</p><p>Điện thoại: {entry.volunteer_phone || "Chưa cung cấp"}</p><p>Hoạt động: {entry.activity.title}</p><p>Thời gian: {activityTime(entry.activity.starts_at)}</p><p>Địa điểm: {entry.activity.address}</p><AttendanceStatus entry={entry} /></RecordDetails>
          <p>Đã duyệt: {entry.activity.approved_count}/{entry.activity.capacity}</p></>}
        {entry.activity_changed && <p className="activity-empty">Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký. Thông tin trên là mới nhất.</p>}
        {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
        {entry.status === 'pending' && !entry.activity.time_checks_disabled && new Date(entry.activity.starts_at) <= new Date() && <p>Đã hết hạn xét duyệt.</p>}
        {managed && entry.status === 'pending' && entry.activity.status === 'published' && (entry.activity.time_checks_disabled || new Date(entry.activity.starts_at) > new Date()) && <div className="activity-actions participation-review-actions">
          <button className="button primary" disabled={busy || entry.activity.approved_count >= entry.activity.capacity} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'approved' }); setFailure('') }}>Duyệt</button>
          <button className="button secondary" disabled={busy} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name, status: 'rejected' }); setFailure('') }}>Từ chối</button>
        </div>}
        {!managed && <Link to={`/hoat-dong/${entry.activity.id}`}>Xem hoạt động và quản lý đăng ký</Link>}
        {!managed && entry.attendance && entry.activity.status === 'completed' && <p><Link to={`/hoat-dong/${entry.activity.id}/phan-hoi`}>Gửi hoặc xem phản hồi của tôi</Link></p>}
      </ActionRow>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang đăng ký">
        <button className="button secondary" disabled={!data.previous || busy} onClick={() => { setPending(null); setParams({ page: String(page - 1) }) }}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next || busy} onClick={() => { setPending(null); setParams({ page: String(page + 1) }) }}>Trang sau</button>
      </nav>}
    </>}
  </section>
}
