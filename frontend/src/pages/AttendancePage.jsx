import ActionRow from '../components/ActionRow.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import useNow from '../hooks/useNow.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceCodePanel from '../components/AttendanceCodePanel.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
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
  const now = useNow()
  const open = activity.data?.status === 'published' && (activity.data.time_checks_disabled || (new Date(activity.data.starts_at) <= now && now <= new Date(activity.data.ends_at)))
  function refresh() { setPending(null); activity.retry(); list.retry() }
  async function confirm() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/attendance/${pending.id}/`, {})
      setMessage(`Đã xác nhận có mặt cho ${pending.name}.`); refresh()
    } catch (error) {
      setFailure(error.message)
      activity.retry(); list.retry()
    } finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">

    <h1>Điểm danh người tham gia</h1>
    {activity.data && <OrganizerActivityHeader activity={activity.data} selected="attendance" />}
    <RequestState loading={activity.loading} error={activity.error} retry={activity.retry} />
    {activity.data && <AttendanceCodePanel id={id} open={open} />}
    <div className="list-results-toolbar">{list.data && <p>{list.data.count} người trong danh sách.</p>}<button type="button" className="button secondary refresh-button" disabled={busy} onClick={refresh}>Làm mới</button></div>
    <RequestState loading={list.loading} error={list.error} retry={list.retry} />
    {message && <p role="status">{message}</p>}
    {failure && <p role="alert" className="request-error">{failure}</p>}
    {pending && <ConfirmationDialog title="Xác nhận có mặt" busy={busy} onClose={() => setPending(null)}><div className="activity-confirm" aria-label="Xác nhận có mặt">{failure && <p role="alert" className="request-error">{failure}</p>}
      <p>Xác nhận {pending.name} có mặt tại hoạt động? Hãy kiểm tra đúng người trước khi ghi nhận. Bản ghi không thể sửa hoặc xóa tại đây.</p>
      <button className="button primary" disabled={busy} onClick={confirm}>Xác nhận có mặt</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </div></ConfirmationDialog>}
    {list.data && <>

      {!list.data.count && <p className="activity-empty">Chưa có người được duyệt để điểm danh.</p>}
      <div className="activity-grid om-people-list">{list.data.results.map(entry => <ActionRow className="activity-card om-person-row" key={entry.id}>
        <div><h2><Link data-row-primary to={`/ho-so?hoat-dong=${id}&ung-vien=${entry.id}`}>{entry.volunteer_name}</Link></h2></div>
        <div><p>{entry.attendance ? "Đã có mặt" : "Chưa ghi nhận có mặt"}</p>
          {entry.attendance && <p>Điểm danh lúc: {activityTime(entry.attendance.confirmed_at)}</p>}
        </div>
        <div>
        {!entry.attendance && entry.status === 'approved' && <button className="button primary" disabled={busy || !open}
          onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name }); setFailure(''); setMessage('') }}>Ghi nhận có mặt</button>}
        </div>
      </ActionRow>)}</div>
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
