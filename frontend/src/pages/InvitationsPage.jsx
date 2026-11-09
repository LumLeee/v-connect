import ActionRow from '../components/ActionRow.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import OrganizerInvitationsPage from './OrganizerInvitationsPage.jsx'
import '../styles/activities.css'
import '../styles/invitations.css'
import '../styles/volunteer-invitations.css'

const statuses = { all: 'Tất cả', pending: 'Chờ phản hồi', accepted: 'Đã chấp nhận', declined: 'Đã từ chối', withdrawn: 'Đã thu hồi' }

export default function InvitationsPage({ managed = false }) {
  const { id } = useParams()
  return managed ? <OrganizerInvitationsPage key={id} id={id} /> : <InvitationList />
}

function InvitationList() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = Object.hasOwn(statuses, params.get('status')) ? params.get('status') : 'all'
  const search = params.get('search')?.trim() || ''
  const base = '/invitations/'
  const { data, loading, error, retry } = useApi(`${base}?${new URLSearchParams({ page: String(page), page_size: '12', status, search })}`)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  function updateQuery(values) {
    setConfirmation(null); setProblem(''); setSuccess('')
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([name, value]) => value ? next.set(name, String(value)) : next.delete(name))
      return next
    })
  }

  async function submit() {
    const { item, action } = confirmation
    setBusy(true); setProblem(''); setSuccess('')
    try {
      await apiPost(`${base}${item.id}/respond/`, { status: action })
      setSuccess(action === 'accepted' ? 'Đã xác nhận tham gia. Đăng ký của bạn đã được tự động duyệt.' : 'Đã từ chối lời mời.')
      setConfirmation(null)
      setParams(previous => { const next = new URLSearchParams(previous); next.set('page', '1'); return next })
      retry()
      window.dispatchEvent(new Event('notifications:changed'))
    } catch (failure) { setProblem(failure.message); retry() }
    finally { setBusy(false) }
  }

  return <section className="page-width section interior activity-page volunteer-invitations-page">
    <div className="vi-heading"><h1>Lời mời của tôi</h1><button type="button" className="button secondary refresh-button" onClick={retry} disabled={busy || loading}>Làm mới</button></div>
    <div className="vi-filters" role="group" aria-label="Lọc trạng thái lời mời">{Object.entries(statuses).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} disabled={busy} onClick={() => updateQuery({ status: value, page: '1' })}>
      {label}{data?.summary && <span>{data.summary[value === 'all' ? 'total' : value]}</span>}
    </button>)}</div>
    <form className="vi-search" onSubmit={event => { event.preventDefault(); updateQuery({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
      <label htmlFor="volunteer-invitation-search">Tìm hoạt động hoặc nhà tổ chức</label>
      <div className="vi-search-controls"><input key={search} id="volunteer-invitation-search" name="search" type="search" maxLength={200} defaultValue={search} placeholder="Nhập tên hoạt động hoặc nhà tổ chức" disabled={busy} />
        <button className="button secondary" disabled={busy}>Tìm kiếm</button>{search && <button type="button" className="button secondary" disabled={busy} onClick={() => updateQuery({ search: '', page: '1' })}>Xóa tìm kiếm</button>}
      </div>
    </form>
    <RequestState loading={loading} error={error} retry={retry} />
    {problem && !confirmation && <p role="alert" className="request-error">{problem}</p>}
    {success && <p role="status">{success}</p>}
    {confirmation && <ConfirmationDialog title="Xác nhận xử lý lời mời" busy={busy} onClose={() => setConfirmation(null)}><div className="activity-empty" aria-label="Xác nhận xử lý lời mời">{problem && <p role="alert" className="request-error">{problem}</p>}
      <h2>{confirmation.action === 'accepted' ? 'Xác nhận tham gia hoạt động?' : 'Từ chối lời mời này?'}</h2>
      <p>{confirmation.item.activity.title}</p>
      <p>{activityTime(confirmation.item.activity.starts_at)} – {activityTime(confirmation.item.activity.ends_at)} · {confirmation.item.activity.address}</p>
      <p>{confirmation.action === 'accepted' ? 'Bạn đồng ý tham gia theo thời gian, địa điểm hiện tại ở trên. Hệ thống sẽ kiểm tra số chỗ và tự động duyệt đăng ký.' : 'Phản hồi đã xác nhận không thể đổi; Nhà tổ chức không gửi lại cùng lời mời.'}</p>
      <div className="activity-actions"><button className="button primary" disabled={busy} onClick={submit}>Xác nhận {confirmation.action === 'accepted' ? 'tham gia' : 'từ chối'}</button><button className="button secondary" disabled={busy} onClick={() => { setConfirmation(null); setProblem('') }}>Quay lại</button></div>
    </div></ConfirmationDialog>}
    {data && <><p role="status" className="vi-result">{data.count} lời mời{search ? ` khớp với “${search}”` : ''} · {statuses[status]}</p>
      {!data.count && <p className="activity-empty">{search || status !== 'all' ? 'Không có lời mời phù hợp với bộ lọc.' : 'Chưa có lời mời.'}</p>}
      <div className="activity-grid invitation-list">{data.results.map(item => <ActionRow className="activity-card invitation-row" key={item.id} label={`Xem hoạt động ${item.activity.title}`}>
        <div className="vi-activity">
        <span className={`vi-status is-${item.status}`}>{statuses[item.status]}</span>
        <h2><Link data-row-primary to={`/hoat-dong/${item.activity.id}`}>{item.activity.title}</Link></h2>
        <p>Nhà tổ chức: {item.organizer_name}</p>
        </div>
        <div className="invitation-details">
          <p>Gửi lúc: <time dateTime={item.created_at}>{activityTime(item.created_at)}</time></p>
          {item.responded_at && <p>{item.status === 'withdrawn' ? 'Thu hồi lúc' : 'Phản hồi lúc'}: <time dateTime={item.responded_at}>{activityTime(item.responded_at)}</time></p>}
          {item.message && (item.message.length > 160 ? <details className="vi-message"><summary>Đọc lời nhắn</summary><p className="activity-description">{item.message}</p></details> : <p className="activity-description">Lời nhắn: {item.message}</p>)}
          {item.unavailable_reason && <p className="vi-unavailable">{item.status === 'pending' && <strong>Không thể chấp nhận: </strong>}{item.unavailable_reason}</p>}
          {item.activity_changed && <p className="vi-unavailable">Lịch hoặc địa điểm đã thay đổi. Kiểm tra thông tin hiện tại trước khi phản hồi.</p>}
        </div>
        {item.status === 'pending' && <div className="activity-actions">
          <button className="button primary" disabled={busy || !!item.unavailable_reason} onClick={() => { setProblem(''); setConfirmation({ item, action: 'accepted' }) }}>Chấp nhận lời mời</button>
          <button className="button secondary" disabled={busy} onClick={() => { setProblem(''); setConfirmation({ item, action: 'declined' }) }}>Từ chối lời mời</button>
        </div>}
      </ActionRow>)}</div><ReportPagination data={data} page={page} busy={busy} onPage={value => updateQuery({ page: value })} />
    </>}
  </section>
}
