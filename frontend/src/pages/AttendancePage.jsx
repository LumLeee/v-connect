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
import { ReportPagination } from '../components/ReportMetrics.jsx'
import '../styles/activities.css'
import '../styles/organizer-operations.css'

const statuses = [['all', 'Tất cả'], ['pending', 'Chưa ghi nhận'], ['attended', 'Đã có mặt']]

function AttendanceList({ id }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status') : 'all'
  const search = params.get('search')?.trim() || ''
  const query = new URLSearchParams({ page: String(page), page_size: '12', status, search })
  const activity = useApi(`/organizer/activities/${id}/`)
  const list = useApi(`/organizer/activities/${id}/attendance/?${query}`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [codeVersion, setCodeVersion] = useState(0)
  const now = useNow()
  const open = activity.data?.status === 'published' && (activity.data.time_checks_disabled || (new Date(activity.data.starts_at) <= now && now <= new Date(activity.data.ends_at)))
  function updateParams(values) {
    setPending(null)
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
      return next
    })
  }
  function refresh() { setPending(null); activity.retry(); list.retry(); setCodeVersion(value => value + 1) }
  async function confirm() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/attendance/${pending.id}/`, {})
      setMessage(`Đã xác nhận có mặt cho ${pending.name}.`)
      updateParams({ page: '1' }); refresh()
    } catch (error) {
      setFailure(error.message)
      activity.retry(); list.retry()
    } finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page organizer-operations">
    <h1>Điểm danh người tham gia</h1>
    {activity.data && <OrganizerActivityHeader activity={activity.data} selected="attendance" />}
    <RequestState loading={activity.loading} error={activity.error} retry={activity.retry} />
    <div className="list-results-toolbar">
      {list.data?.summary && <div className="operation-totals" aria-label="Tổng hợp điểm danh"><span>{list.data.summary.total} người trong danh sách</span><span>{list.data.summary.attended} người đã có mặt</span><span>{list.data.summary.pending} người chưa ghi nhận</span></div>}
      <button type="button" className="button secondary refresh-button" disabled={busy || activity.loading || list.loading} onClick={refresh}>Làm mới</button>
    </div>
    <div className="operation-toolbar">
      <div className="operation-filters" role="group" aria-label="Lọc trạng thái điểm danh">{statuses.map(([value, label]) => <button type="button" key={value} className={`button secondary${status === value ? ' is-selected' : ''}`} aria-pressed={status === value} disabled={busy} onClick={() => updateParams({ status: value, page: '1' })}>{label}</button>)}</div>
      <form className="operation-search" onSubmit={event => { event.preventDefault(); updateParams({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
        <label htmlFor="attendance-search">Tìm người tham gia</label><div><input key={search} id="attendance-search" name="search" type="search" maxLength={200} defaultValue={search} placeholder="Tên hoặc email" disabled={busy} /><button className="button secondary" disabled={busy}>Tìm kiếm</button></div>
      </form>
    </div>
    {activity.data && <details className="operation-code"><summary>Check-in bằng QR hoặc mã</summary><AttendanceCodePanel key={codeVersion} id={id} open={open} /></details>}
    <RequestState loading={list.loading} error={list.error} retry={list.retry} />
    {message && <p role="status">{message}</p>}
    {failure && !pending && <p role="alert" className="request-error">{failure}</p>}
    {pending && <ConfirmationDialog title="Xác nhận có mặt" busy={busy} onClose={() => setPending(null)}><div className="activity-confirm" aria-label="Xác nhận có mặt">{failure && <p role="alert" className="request-error">{failure}</p>}
      <p>Xác nhận {pending.name} có mặt tại hoạt động? Hãy kiểm tra đúng người trước khi ghi nhận. Bản ghi không thể sửa hoặc xóa tại đây.</p>
      <div className="operation-dialog-actions"><button className="button primary" disabled={busy} onClick={confirm}>Xác nhận có mặt</button><button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>
    </div></ConfirmationDialog>}
    {list.data && <>
      <p className="operation-result-count" role="status">{list.data.count} người{search ? ` khớp với “${search}”` : ''} · {statuses.find(([value]) => value === status)[1]}</p>
      {!list.data.count && <p className="activity-empty">{search || status !== 'all' ? 'Không có người tham gia phù hợp với bộ lọc.' : 'Chưa có người được duyệt để điểm danh.'}</p>}
      <div className="activity-grid operation-list">{list.data.results.map(entry => <ActionRow className="activity-card operation-row" key={entry.id}>
        <div><h2><Link data-row-primary to={`/ho-so?hoat-dong=${id}&ung-vien=${entry.id}`}>{entry.volunteer_name}</Link></h2></div>
        <div><span className={`operation-status${entry.attendance ? ' is-confirmed' : ''}`}>{entry.attendance ? 'Đã có mặt' : 'Chưa ghi nhận'}</span>
          {entry.attendance && <p>Điểm danh lúc: {activityTime(entry.attendance.confirmed_at)}</p>}
        </div>
        <div className="operation-row-actions">
          {!entry.attendance && entry.status === 'approved' && <button className="button primary" disabled={busy || !open} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name }); setFailure(''); setMessage('') }}>Ghi nhận có mặt</button>}
        </div>
      </ActionRow>)}</div>
      <ReportPagination data={list.data} page={page} busy={busy} onPage={value => updateParams({ page: String(value) })} />
    </>}
  </section>
}

export default function AttendancePage() {
  const { id } = useParams()
  return <AttendanceList key={id} id={id} />
}
