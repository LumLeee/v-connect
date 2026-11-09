import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import useApi from '../hooks/useApi.js'
import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import '../styles/activities.css'
import '../styles/invitations.css'

const statuses = { all: 'Tất cả', pending: 'Chờ phản hồi', accepted: 'Đã chấp nhận', declined: 'Đã từ chối', withdrawn: 'Đã thu hồi' }

export default function OrganizerInvitationsPage({ id }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = Object.hasOwn(statuses, params.get('status')) ? params.get('status') : 'all'
  const search = params.get('search')?.trim() || ''
  const base = `/organizer/activities/${id}/invitations/`
  const activity = useApi(`/organizer/activities/${id}/`)
  const list = useApi(`${base}?${new URLSearchParams({ page: String(page), page_size: '12', status, search })}`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  function updateQuery(values) {
    setPending(null); setFailure(''); setMessage('')
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([name, value]) => value ? next.set(name, String(value)) : next.delete(name))
      return next
    })
  }
  function refresh() { activity.retry(); list.retry() }
  async function withdraw() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`${base}${pending.id}/withdraw/`, {})
      setPending(null); setMessage('Đã thu hồi lời mời.')
      setParams(previous => { const next = new URLSearchParams(previous); next.set('page', '1'); return next })
      refresh(); window.dispatchEvent(new Event('notifications:changed'))
    } catch (error) { setFailure(error.message); refresh() }
    finally { setBusy(false) }
  }
  const summary = list.data?.summary
  return <section className="page-width section interior activity-page managed-invitations-page">
    <div className="om-page-heading om-management-heading"><div><h1>Lời mời tham gia hoạt động</h1></div><div className="om-management-actions">
      <Link className="button primary" to={`/nha-to-chuc/hoat-dong/${id}/ghep-noi`}>Tìm người phù hợp</Link>
      <button type="button" className="button secondary refresh-button" disabled={busy || activity.loading || list.loading} onClick={() => { setPending(null); refresh() }}>Làm mới</button>
    </div></div>
    <RequestState loading={activity.loading} error={activity.error} retry={activity.retry} />
    {activity.data && <OrganizerActivityHeader activity={activity.data} selected="invitations" />}
    <div className="om-status-filters managed-invitation-filters" role="group" aria-label="Lọc trạng thái lời mời">{Object.entries(statuses).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} disabled={busy} onClick={() => updateQuery({ status: value, page: '1' })}>
      {label}{summary && <span>{summary[value === 'all' ? 'total' : value]}</span>}
    </button>)}</div>
    <form className="om-applicant-search" onSubmit={event => { event.preventDefault(); updateQuery({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
      <label htmlFor="invitation-search">Tìm người nhận</label><div className="om-applicant-search-controls"><div className="activity-search-input"><Search size={18} aria-hidden="true" /><input key={search} id="invitation-search" name="search" type="search" maxLength={200} defaultValue={search} placeholder="Nhập họ tên người nhận" disabled={busy} /></div>
        <button className="button secondary" disabled={busy}>Tìm kiếm</button>{search && <button type="button" className="button secondary" disabled={busy} onClick={() => updateQuery({ search: '', page: '1' })}>Xóa tìm kiếm</button>}
      </div>
    </form>
    {message && <p role="status">{message}</p>}{failure && !pending && <p role="alert" className="request-error">{failure}</p>}
    <RequestState loading={list.loading} error={list.error} retry={list.retry} />
    {pending && <ConfirmationDialog title="Xác nhận xử lý lời mời" busy={busy} onClose={() => setPending(null)}>
      <div className="activity-confirm">{failure && <p role="alert" className="request-error">{failure}</p>}<h2>Thu hồi lời mời này?</h2><p>Người nhận: <strong>{pending.volunteer_name}</strong></p>
        <p>Sau khi thu hồi, người nhận không thể chấp nhận lời mời này. Bạn không thể gửi lại cùng lời mời.</p>
        <div className="activity-actions"><button className="button primary" disabled={busy} onClick={withdraw}>Xác nhận thu hồi</button><button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>
      </div>
    </ConfirmationDialog>}
    {list.data && <>
      <p role="status" className="managed-invitation-result">{list.data.count} lời mời{search ? ` khớp với “${search}”` : ''} · {statuses[status]}</p>
      {!list.data.count && <p className="activity-empty">{search || status !== 'all' ? 'Không có lời mời phù hợp với bộ lọc.' : 'Chưa gửi lời mời nào cho hoạt động này.'}</p>}
      <div className="activity-grid managed-invitation-list">{list.data.results.map(item => <ActionRow key={item.id} className="activity-card managed-invitation-row" label={`Xem lời mời gửi tới ${item.volunteer_name}`}>
        <div className="managed-invitation-recipient"><h2>{item.volunteer_name}</h2><span className={`managed-invitation-status is-${item.status}`}>{statuses[item.status]}</span></div>
        <div className="managed-invitation-content">{item.message ? <p className="managed-invitation-message">{item.message}</p> : <p className="muted">Không có lời nhắn</p>}
          <p>Gửi lúc: <time dateTime={item.created_at}>{activityTime(item.created_at)}</time></p>
          {item.responded_at && <p>{item.status === 'withdrawn' ? 'Thu hồi lúc' : 'Phản hồi lúc'}: <time dateTime={item.responded_at}>{activityTime(item.responded_at)}</time></p>}
          {item.unavailable_reason && <p className="managed-invitation-note">{item.unavailable_reason}</p>}
          {item.activity_changed && <p className="managed-invitation-note">Lịch hoặc địa điểm đã thay đổi sau khi gửi lời mời.</p>}
        </div>
        <div className="managed-invitation-actions">{item.status === 'pending' && <button type="button" className="button secondary" data-row-keep-action disabled={busy} onClick={() => { setPending(item); setFailure(''); setMessage('') }}>Thu hồi lời mời</button>}</div>
        <RecordDetails title={`Lời mời gửi tới ${item.volunteer_name}`}><p>Trạng thái: {statuses[item.status]}</p>{item.message && <p className="activity-description">Lời nhắn: {item.message}</p>}<p>Gửi lúc: {activityTime(item.created_at)}</p>
          {item.responded_at && <p>{item.status === 'withdrawn' ? 'Thu hồi lúc' : 'Phản hồi lúc'}: {activityTime(item.responded_at)}</p>}{item.unavailable_reason && <p>{item.unavailable_reason}</p>}{item.activity_changed && <p>Lịch hoặc địa điểm đã thay đổi sau khi gửi lời mời.</p>}
        </RecordDetails>
      </ActionRow>)}</div>
      <ReportPagination data={list.data} page={page} busy={busy} onPage={value => updateQuery({ page: value })} />
    </>}
  </section>
}
