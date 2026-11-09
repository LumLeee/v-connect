import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { RefreshCw, Search } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { apiPost } from '../api/client.js'
import { participationLabels } from '../api/participationFormat.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

const applicantStatuses = [['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'],
  ['rejected', 'Từ chối'], ['cancelled', 'Đã hủy'], ['all', 'Tất cả']]

function ApplicantSearch({ search, busy, onSearch }) {
  const [value, setValue] = useState(search)
  return <form className="om-applicant-search" onSubmit={event => { event.preventDefault(); onSearch(value.trim()) }}>
    <label htmlFor="applicant-search">Tìm ứng viên</label>
    <div className="om-applicant-search-controls">
      <div className="activity-search-input"><Search size={18} aria-hidden="true" />
        <input id="applicant-search" type="search" maxLength={200} value={value} disabled={busy}
          placeholder="Nhập tên hoặc email ứng viên" onChange={event => setValue(event.target.value)} />
      </div>
      <button type="submit" className="button primary" disabled={busy}>Tìm kiếm</button>
      {search && <button type="button" className="button secondary" disabled={busy} onClick={() => onSearch('')}>Xóa tìm kiếm</button>}
    </div>
  </form>
}

export default function ParticipationsPage({ managed = false, history = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = params.get('status') || 'pending'
  const search = params.get('search') || ''
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  if (managed) { query.set('status', status); if (search) query.set('search', search) }
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/applicants/` : history ? '/participations/history/' : '/participations/'}?${query}`)
  const [headerVersion, setHeaderVersion] = useState(0)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  function changeFilters(values) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (managed && !next.get('status')) next.set('status', status)
    next.set('page', '1')
    setPending(null); setFailure(''); setMessage(''); setParams(next)
  }
  function refresh() {
    setPending(null); setFailure(''); retry()
    if (managed) setHeaderVersion(value => value + 1)
  }
  function movePage(value) {
    const next = new URLSearchParams(params)
    if (managed) next.set('status', status)
    next.set('page', String(value)); setPending(null); setParams(next)
  }
  async function review() {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/applicants/${pending.id}/review/`, { status: pending.status })
      setMessage('Đã cập nhật kết quả xét duyệt.'); setPending(null)
      const next = new URLSearchParams(params)
      next.set('page', '1'); next.set('status', status); setParams(next)
      retry(); setHeaderVersion(value => value + 1)
    } catch (problem) { setFailure(problem.message); retry(); setHeaderVersion(value => value + 1) }
    finally { setBusy(false) }
  }
  return <section className={`page-width section interior activity-page${managed ? ' om-applicant-page' : ''}`}>

    {managed ? <div className="om-page-heading om-management-heading"><h1>Danh sách đăng ký</h1>
      <button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={refresh}>
        <RefreshCw size={16} aria-hidden="true" />{loading ? 'Đang tải…' : 'Làm mới'}
      </button>
    </div> : <h1>{history ? 'Lịch sử tham gia' : 'Đăng ký của tôi'}</h1>}
    {managed && <OrganizerActivityHeader key={`${id}-${headerVersion}`} id={id} selected="registrations" />}
    {managed && <>
      <div className="om-status-filters om-applicant-status-filters" role="group" aria-label="Lọc đơn theo trạng thái">
        {applicantStatuses.map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} disabled={busy}
          onClick={() => changeFilters({ status: value })}>{label}{data?.summary && <span>{data.summary[value === 'all' ? 'total' : value]}</span>}</button>)}
      </div>
      <ApplicantSearch key={`${id}-${search}`} search={search} busy={busy} onSearch={value => changeFilters({ search: value })} />
    </>}

    <div className="list-results-toolbar">{data && <p>{data.count} {history ? 'lượt ghi nhận có mặt' : 'đơn đăng ký'}{managed && search ? ' phù hợp với tìm kiếm' : ''}.</p>}
      {!managed && <button type="button" className="button secondary refresh-button" disabled={busy} onClick={refresh}>Làm mới</button>}
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {managed && error?.status === 404 && page > 1 && <button type="button" className="button secondary" onClick={() => changeFilters({})}>Về trang đầu</button>}
    {message && <p role="status">{message}</p>}
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {pending && <ConfirmationDialog title="Xác nhận xét duyệt" busy={busy} onClose={() => setPending(null)}><div className="activity-confirm" aria-label="Xác nhận xét duyệt">{failure && <p role="alert" className="request-error">{failure}</p>}<p>{pending.status === 'approved' ? 'Duyệt' : 'Từ chối'} đơn của {pending.name}? Kết quả này không thể sửa lại tại đây.</p>
      <button className="button primary" disabled={busy} onClick={review}>Xác nhận xét duyệt</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div></ConfirmationDialog>}
    {data && <>

      {!data.count && <p className="activity-empty">{history ? 'Chưa có hoạt động được xác nhận có mặt.' : managed && search ? 'Không tìm thấy ứng viên phù hợp. Hãy đổi từ khóa hoặc trạng thái đơn.' : managed && status === 'pending' ? 'Không có đơn chờ duyệt. Bạn có thể chọn trạng thái khác để xem các đơn đã xử lý.' : managed && status !== 'all' ? 'Chưa có đơn đăng ký ở trạng thái này.' : 'Chưa có đơn đăng ký.'}</p>}
      <div className={`activity-grid${managed ? ' om-people-list' : ''}`}>{data.results.map(entry => managed ? <ActionRow className="activity-card om-person-row om-applicant-row" key={entry.id}>
        <div><h2><Link data-row-primary to={`/ho-so?hoat-dong=${id}&ung-vien=${entry.id}`}>{entry.volunteer_name}</Link></h2>{entry.volunteer_email && <p>{entry.volunteer_email}</p>}</div>
        <div><span className={`om-applicant-status is-${entry.status}`}>{applicantStatuses.find(([value]) => value === entry.status)?.[1] || participationLabels[entry.status]}</span>
          <p>Đăng ký lúc: {activityTime(entry.registered_at)}</p>
          {entry.reviewed_at && ['approved', 'rejected'].includes(entry.status) && <p>Xét duyệt lúc: {activityTime(entry.reviewed_at)}</p>}
          {entry.status === 'approved' && entry.attendance && <p>Đã xác nhận có mặt</p>}
          {entry.status === 'pending' && entry.activity.approved_count >= entry.activity.capacity && <p>Đã đủ số người được duyệt.</p>}
          {entry.activity_changed && <p>Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký.</p>}
          {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
          {entry.status === 'pending' && !entry.activity.time_checks_disabled && new Date(entry.activity.starts_at) <= new Date() && <p>Đã hết hạn xét duyệt.</p>}</div>
        <div className="om-applicant-actions">{entry.status === 'pending' && entry.activity.status === 'published' && (entry.activity.time_checks_disabled || new Date(entry.activity.starts_at) > new Date()) && <div className="activity-actions participation-review-actions">
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
        <button className="button secondary" disabled={!data.previous || busy} onClick={() => movePage(page - 1)}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next || busy} onClick={() => movePage(page + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>
}
