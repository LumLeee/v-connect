import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

function AttendanceList({ id }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const activity = useApi(`/organizer/activities/${id}/`)
  const list = useApi(`/organizer/activities/${id}/attendance/?page=${page}&page_size=12`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const now = new Date()
  const open = activity.data?.status === 'published' && new Date(activity.data.starts_at) <= now && now <= new Date(activity.data.ends_at)
  function refresh() { setPending(null); activity.retry(); list.retry() }
  async function confirm() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/attendance/${pending.id}/`, {})
      setMessage(`Đã xác nhận có mặt cho ${pending.name}.`); refresh()
    } catch (error) {
      setFailure(Object.values(error.details?.error?.details || {}).flat().join(' ') || error.message)
      refresh()
    } finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={`/nha-to-chuc/hoat-dong/${id}`}>← Về hoạt động</Link>
    <h1>Điểm danh người tham gia</h1>
    <RequestState loading={activity.loading} error={activity.error} retry={activity.retry} />
    {activity.data && <><h2>{activity.data.title}</h2>
      <p>Thời gian điểm danh: {activityTime(activity.data.starts_at)} đến {activityTime(activity.data.ends_at)} (giờ Việt Nam).</p>
      <p>{open ? 'Đang mở điểm danh cho người đã được duyệt.' : 'Chưa mở hoặc đã đóng điểm danh. Hoạt động phải còn công khai và đang trong thời gian diễn ra.'}</p></>}
    <button className="text-button" disabled={busy} onClick={refresh}>Cập nhật danh sách điểm danh</button>
    <RequestState loading={list.loading} error={list.error} retry={list.retry} />
    {message && <p role="status">{message}</p>}
    {failure && <p role="alert" className="request-error">{failure}</p>}
    {pending && <div className="activity-confirm" role="region" aria-label="Xác nhận có mặt">
      <p>Xác nhận {pending.name} có mặt tại hoạt động? Hãy kiểm tra đúng người trước khi ghi nhận. Bản ghi không thể sửa hoặc xóa tại đây.</p>
      <button className="button primary" disabled={busy} onClick={confirm}>Xác nhận có mặt</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </div>}
    {list.data && <>
      <p>{list.data.count} người trong danh sách.</p>
      {!list.data.count && <p className="activity-empty">Chưa có người được duyệt để điểm danh.</p>}
      <div className="activity-grid">{list.data.results.map(entry => <article className="activity-card" key={entry.id}>
        <h2>{entry.volunteer_name}</h2><p>Email: {entry.volunteer_email}</p><p>Điện thoại: {entry.volunteer_phone || 'Chưa cung cấp'}</p>
        <AttendanceStatus entry={entry} />
        {!entry.attendance && entry.status === 'approved' && <button className="button primary" disabled={busy || !open}
          onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name }); setFailure(''); setMessage('') }}>Ghi nhận có mặt</button>}
      </article>)}</div>
      {(list.data.previous || list.data.next) && <nav className="activity-pagination" aria-label="Phân trang điểm danh">
        <button className="button secondary" disabled={busy || !list.data.previous} onClick={() => { setPending(null); setParams({ page: String(page - 1) }) }}>Trang trước</button>
        <span>Trang {page}</span>
        <button className="button secondary" disabled={busy || !list.data.next} onClick={() => { setPending(null); setParams({ page: String(page + 1) }) }}>Trang sau</button>
      </nav>}
    </>}
  </section>
}

export default function AttendancePage() {
  const { id } = useParams()
  return <AttendanceList key={id} id={id} />
}
