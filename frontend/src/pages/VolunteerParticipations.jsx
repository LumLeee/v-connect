import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, CalendarDays, CheckCircle2, ClipboardList, Clock3, ScanLine, Search } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import RequestState from '../components/RequestState.jsx'
import useApi from '../hooks/useApi.js'
import useNow from '../hooks/useNow.js'
import { apiPost } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { participationLabels } from '../api/participationFormat.js'
import '../styles/volunteer-participations.css'
import '../styles/volunteer-participation-hubs.css'

const modes = {
  registrations: {
    title: 'Đăng ký của tôi', endpoint: '/participations/', heading: 'Theo dõi đơn đăng ký', countLabel: 'đơn đăng ký',
    description: 'Theo dõi kết quả xét duyệt và quản lý những đơn bạn đã gửi.',
    empty: 'Chưa có đơn đăng ký.', emptyLink: '/hoat-dong', emptyAction: 'Khám phá cơ hội tình nguyện',
  },
  checkin: {
    title: 'Điểm danh của tôi', endpoint: '/participations/check-in/', heading: 'Hoạt động được duyệt đang công khai', countLabel: 'hoạt động',
    description: 'Check-in bằng QR hoặc mã và theo dõi thời gian xác nhận có mặt.',
    empty: 'Chưa có hoạt động được duyệt đang công khai.', emptyLink: '/tinh-nguyen-vien/dang-ky', emptyAction: 'Xem đơn đăng ký',
  },
  history: {
    title: 'Lịch sử tham gia', endpoint: '/participations/history/', heading: 'Các lượt tham gia được ghi nhận', countLabel: 'lượt ghi nhận có mặt',
    description: 'Xem thời gian điểm danh, điểm đóng góp và phản hồi sau khi tham gia.',
    empty: 'Chưa có hoạt động được xác nhận có mặt.', emptyLink: '/hoat-dong', emptyAction: 'Khám phá cơ hội tình nguyện',
  },
}

const registrationStatuses = { all: 'Tất cả', ...participationLabels }
const checkinStatuses = { all: 'Tất cả', open: 'Đang mở điểm danh', upcoming: 'Chưa đến giờ', attended: 'Đã điểm danh', closed: 'Đã hết giờ' }
const feedbackStatuses = { all: 'Tất cả', pending: 'Chưa gửi', submitted: 'Đã gửi' }
const exactTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' })

function TimeValue({ value, now }) {
  return <time dateTime={value} title={exactTime.format(new Date(value))}>{activityTime(value, now)}</time>
}

function HubFilters({ mode, search, dateFrom, dateTo, selected, summary, onChange }) {
  const [dateError, setDateError] = useState('')
  const history = mode === 'history'
  const filters = history ? feedbackStatuses : checkinStatuses
  function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const from = String(values.get('date_from') || '')
    const to = String(values.get('date_to') || '')
    if (history && from && to && from > to) {
      setDateError('Ngày đến phải bằng hoặc sau ngày từ.')
      event.currentTarget.elements.namedItem('date_to').focus()
      return
    }
    setDateError('')
    onChange({ search: String(values.get('search') || '').trim(), ...(history ? { date_from: from, date_to: to } : {}), page: '1' })
  }
  function count(value) {
    if (!summary) return null
    if (value === 'all') return summary.total
    return history ? summary[value === 'submitted' ? 'feedback_count' : 'feedback_pending'] : summary[value]
  }
  const active = search || dateFrom || dateTo || selected !== 'all'
  return <div className="vp-hub-filters">
    <form key={`${search}-${dateFrom}-${dateTo}`} className="vp-hub-search" onSubmit={submit} onChange={() => setDateError('')}>
      <label htmlFor={`hub-search-${mode}`}>Tìm hoạt động {history ? 'đã tham gia' : 'được duyệt'}</label>
      <div className="vp-search-controls"><div className="vp-search-field"><Search size={18} aria-hidden="true" /><input id={`hub-search-${mode}`} name="search" type="search" maxLength={200} defaultValue={search} placeholder="Nhập tên hoạt động" /></div>
        {!history && <button className="button secondary" type="submit">Tìm kiếm</button>}
      </div>
      {history && <div className="vp-history-date-filters">
        <label>Điểm danh từ ngày<input name="date_from" type="date" defaultValue={dateFrom} /></label>
        <label>Điểm danh đến ngày<input name="date_to" type="date" defaultValue={dateTo} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'history-date-error' : undefined} /></label>
        <button className="button secondary" type="submit">Áp dụng bộ lọc</button>
      </div>}
      {dateError && <p id="history-date-error" className="request-error" role="alert">{dateError}</p>}
    </form>
    <div className="vp-status-filters" role="group" aria-label={history ? 'Lọc trạng thái phản hồi' : 'Lọc trạng thái điểm danh'}>{Object.entries(filters).map(([value, label]) => <button type="button" key={value} aria-pressed={selected === value} onClick={() => onChange({ [history ? 'feedback' : 'status']: value === 'all' ? '' : value, page: '1' })}>
      {label}{summary && <span>{count(value) ?? 0}</span>}
    </button>)}</div>
    {active && <button type="button" className="text-button vp-clear-filters" onClick={() => { setDateError(''); onChange({ search: '', status: '', feedback: '', date_from: '', date_to: '', page: '1' }) }}>Xóa bộ lọc</button>}
  </div>
}

function Summary({ mode, summary }) {
  const items = mode === 'checkin'
    ? [[CheckCircle2, 'Hoạt động được duyệt', summary.total], [ScanLine, 'Đang mở điểm danh', summary.open ?? 0], [Clock3, 'Đã điểm danh', summary.attended]]
    : mode === 'history'
      ? [[CheckCircle2, 'Lượt đã tham gia', summary.total], [Award, 'Điểm đóng góp', summary.total_score], [CalendarDays, 'Chưa gửi phản hồi', summary.feedback_pending ?? 0]]
      : [[ClipboardList, 'Tổng đơn đăng ký', summary.total], [Clock3, 'Đang chờ duyệt', summary.pending], [CheckCircle2, 'Được duyệt', summary.approved]]
  return <div className="vs-summary vp-summary" aria-label={`Tổng hợp ${modes[mode].title.toLowerCase()}`}>
    {items.map(([Icon, label, value]) => <div key={label}><Icon size={21} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>
}

function ActivityInfo({ entry, children }) {
  return <div className="vp-activity-info">{children}<h2>{entry.activity.title}</h2><p>{entry.activity.organizer_name}</p></div>
}

function EntryDetails({ entry, history = false }) {
  return <RecordDetails title={entry.activity.title}>
    <p>Nhà tổ chức: {entry.activity.organizer_name}</p><p>Địa điểm: {entry.activity.address}</p>
    <p>Bắt đầu: {activityTime(entry.activity.starts_at)}</p><p>Kết thúc: {activityTime(entry.activity.ends_at)}</p>
    <p>Trạng thái đơn: {participationLabels[entry.status]}</p><p>Đăng ký: {activityTime(entry.registered_at)}</p>
    {entry.reviewed_at && <p>Xét duyệt: {activityTime(entry.reviewed_at)}</p>}
    <AttendanceStatus entry={entry} />
    {history && entry.contribution && <><p>Điểm đóng góp: {entry.contribution.score} điểm</p><p>Cập nhật điểm: {activityTime(entry.contribution.updated_at)}</p></>}
    {history && entry.feedback && <p>Đánh giá của bạn: {entry.feedback.rating}/5</p>}
    {entry.activity.status === 'published' && <Link className="button secondary" to={`/hoat-dong/${entry.activity.id}`}>Xem hoạt động</Link>}
  </RecordDetails>
}

function ChangeNote({ entry }) {
  return entry.activity_changed ? <p className="vs-change-note">Lịch hoặc địa điểm đã thay đổi từ lúc đăng ký.</p> : null
}

function RegistrationRow({ entry, busy, onCancel }) {
  const open = entry.activity.status === 'published' && (entry.activity.time_checks_disabled || new Date(entry.activity.starts_at) > new Date())
  const canCancel = !entry.attendance && ['pending', 'approved'].includes(entry.status) && open
  return <ActionRow className="vs-participation-row vp-row vp-registration" label={`Xem đơn đăng ký: ${entry.activity.title}`}>
    <ActivityInfo entry={entry}><span className={`vp-badge vp-${entry.status}`}>{participationLabels[entry.status]}</span>
      {entry.activity.status !== 'published' && <span className={`activity-status status-${entry.activity.status}`}>{activityStatuses[entry.activity.status]}</span>}
    </ActivityInfo>
    <div className="vp-row-meta"><p><span>Gửi đơn:</span> <time dateTime={entry.registered_at}>{activityTime(entry.registered_at)}</time></p>
      {entry.reviewed_at && ['approved', 'rejected'].includes(entry.status) && <p><span>Xét duyệt:</span> <time dateTime={entry.reviewed_at}>{activityTime(entry.reviewed_at)}</time></p>}
      {entry.cancellation_reason === 'activity_cancelled' && <p>Đơn bị hủy do hoạt động bị hủy.</p>}
      {entry.cancellation_reason === 'volunteer' && <p>Bạn đã hủy đơn đăng ký này.</p>}
      {entry.status === 'pending' && !open && entry.activity.status === 'published' && <p>Đã hết hạn xét duyệt.</p>}
      <ChangeNote entry={entry} />
    </div>
    <div className="vs-row-actions vp-row-actions"><EntryDetails entry={entry} />
      {canCancel && <button type="button" className="button secondary vp-cancel" disabled={busy} onClick={() => onCancel(entry)}>Hủy đăng ký</button>}
    </div>
  </ActionRow>
}

function CheckinRow({ entry, now }) {
  const start = new Date(entry.activity.starts_at).getTime()
  const end = new Date(entry.activity.ends_at).getTime()
  const window = entry.attendance ? 'attended' : entry.activity.status !== 'published' ? 'closed'
    : entry.activity.time_checks_disabled || (start <= now && now <= end) ? 'open' : now < start ? 'upcoming' : 'closed'
  const canCheckin = entry.status === 'approved' && window === 'open'
  return <ActionRow className={`vs-participation-row vp-row vp-checkin vp-window-${window}${entry.attendance ? ' is-attended' : ''}`} label={`Xem điểm danh: ${entry.activity.title}`}>
    <ActivityInfo entry={entry}><span className={`vp-badge ${window === 'open' || window === 'attended' ? 'vp-approved' : window === 'upcoming' ? 'vp-pending' : 'vp-cancelled'}`}>{checkinStatuses[window]}</span></ActivityInfo>
    <div className="vp-row-meta"><p><span>Bắt đầu:</span> <TimeValue value={entry.activity.starts_at} now={now} /></p><p><span>Kết thúc:</span> <TimeValue value={entry.activity.ends_at} now={now} /></p><p>{entry.activity.address}</p>
      {entry.attendance ? <p className="vp-attendance"><CheckCircle2 size={16} aria-hidden="true" />Điểm danh: <TimeValue value={entry.attendance.confirmed_at} now={now} /></p>
        : window !== 'open' && <p className="vp-window-note">{window === 'upcoming' ? 'Chưa đến giờ điểm danh.' : 'Đã hết giờ điểm danh.'}</p>}
      <ChangeNote entry={entry} />
    </div>
    <div className="vs-row-actions vp-row-actions"><EntryDetails entry={entry} />
      {canCheckin && <Link data-row-primary data-row-keep-action className="button primary" to={`/hoat-dong/${entry.activity.id}/check-in`}>Check-in hoạt động</Link>}
      {entry.attendance && <Link className="button secondary" to={`/tinh-nguyen-vien/lich-su?${new URLSearchParams({ search: entry.activity.title })}`}>Xem lịch sử tham gia</Link>}
    </div>
  </ActionRow>
}

function HistoryRow({ entry, now }) {
  return <ActionRow className="vs-participation-row vp-row vp-history" label={`Xem lượt tham gia: ${entry.activity.title}`}>
    <ActivityInfo entry={entry}><span className={`activity-status status-${entry.activity.status}`}>{activityStatuses[entry.activity.status]}</span></ActivityInfo>
    <div className="vp-row-meta"><p className="vp-attendance"><CheckCircle2 size={16} aria-hidden="true" />Đã xác nhận có mặt</p><p><span>Điểm danh:</span> <TimeValue value={entry.attendance.confirmed_at} now={now} /></p>
      {entry.attendance.method && <p>Hình thức: {entry.attendance.method === 'manual' ? 'Nhà tổ chức xác nhận' : entry.attendance.method === 'qr' ? 'Quét QR' : 'Nhập mã'}</p>}
      {entry.activity.status === 'cancelled' && <p>Hoạt động đã hủy; lượt có mặt được giữ lại.</p>}
    </div>
    <div className="vp-history-result">{entry.contribution ? <><strong>{entry.contribution.score}<small>điểm</small></strong><span>Điểm đóng góp</span></>
      : <p>{entry.activity.status === 'completed' && entry.status === 'approved' ? 'Chờ chấm điểm đóng góp' : 'Chưa ghi nhận điểm đóng góp'}</p>}
      <p className={`vp-feedback-state ${entry.feedback ? 'is-submitted' : 'is-pending'}`}>{entry.feedback ? `Đã gửi phản hồi · ${entry.feedback.rating}/5 sao` : entry.can_submit_feedback ? 'Chưa gửi phản hồi' : 'Chưa thể gửi phản hồi'}</p>
    </div>
    <div className="vs-row-actions vp-row-actions"><EntryDetails entry={entry} history />
      {(entry.feedback || entry.can_submit_feedback) && <Link data-row-keep-action className={`button ${entry.feedback ? 'secondary' : 'primary'}`} to={`/hoat-dong/${entry.activity.id}/phan-hoi`}>{entry.feedback ? 'Xem phản hồi của tôi' : 'Gửi phản hồi'}</Link>}
    </div>
  </ActionRow>
}

export default function VolunteerParticipations({ mode = 'registrations' }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const config = modes[mode]
  const registrations = mode === 'registrations'
  const history = mode === 'history'
  const statusOptions = registrations ? registrationStatuses : checkinStatuses
  const status = Object.hasOwn(statusOptions, params.get('status')) ? params.get('status') : 'all'
  const feedback = Object.hasOwn(feedbackStatuses, params.get('feedback')) ? params.get('feedback') : 'all'
  const search = params.get('search')?.trim() || ''
  const dateFrom = history ? params.get('date_from') || '' : ''
  const dateTo = history ? params.get('date_to') || '' : ''
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  if (!history && status !== 'all') query.set('status', status)
  if (search) query.set('search', search)
  if (history) {
    if (feedback !== 'all') query.set('feedback', feedback)
    if (dateFrom) query.set('date_from', dateFrom)
    if (dateTo) query.set('date_to', dateTo)
  }
  const { data, loading, error, retry } = useApi(`${config.endpoint}?${query}`)
  const now = useNow(!registrations)
  useEffect(() => {
    if (mode !== 'checkin' || !data) return
    const current = Date.now()
    const boundaries = data.results.filter(entry => !entry.attendance && !entry.activity.time_checks_disabled)
      .flatMap(entry => [new Date(entry.activity.starts_at).getTime(), new Date(entry.activity.ends_at).getTime() + 1])
      .filter(value => value > current)
    const nextTransition = data.next_transition_at ? new Date(data.next_transition_at).getTime() : Math.min(...boundaries)
    if (!Number.isFinite(nextTransition)) return
    const delay = Math.min(Math.max(nextTransition - current + 30, 1000), 2147483647)
    const timer = window.setTimeout(retry, delay)
    return () => window.clearTimeout(timer)
  }, [data, mode, retry])
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function cancel() {
    if (busy) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/activities/${pending.activity.id}/participation/cancel/`, {})
      setPending(null); setMessage('Đã hủy đăng ký.')
      if (registrations && page > 1) setParams(previous => { const next = new URLSearchParams(previous); next.set('page', '1'); return next })
      retry()
    } catch (problem) { setFailure(problem.message); retry() }
    finally { setBusy(false) }
  }
  function updateFilters(values) {
    setMessage(''); setFailure('')
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([name, value]) => value ? next.set(name, String(value)) : next.delete(name))
      return next
    })
  }
  function movePage(value) {
    updateFilters({ page: value })
  }
  const filtered = search || (history ? feedback !== 'all' || dateFrom || dateTo : status !== 'all')
  const clearFilters = () => updateFilters({ search: '', status: '', feedback: '', date_from: '', date_to: '', page: '1' })
  return <section className={`page-width section interior activity-page vs-participations vp-${mode}`}>
    <div className="vs-page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div><div className="vp-heading-actions"><Link className="button primary" to="/hoat-dong">Tìm hoạt động</Link>
      <button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={retry}>Làm mới</button>
    </div></div>
    {!registrations && data?.summary && <Summary mode={mode} summary={data.summary} />}
    {registrations && <div className="vp-registration-filters">
      <form className="vp-registration-search" onSubmit={event => { event.preventDefault(); updateFilters({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
        <label htmlFor="registration-search">Tìm hoạt động đã đăng ký</label><div className="vp-search-controls"><div className="vp-search-field"><Search size={18} aria-hidden="true" /><input key={search} id="registration-search" name="search" type="search" maxLength={200} defaultValue={search} placeholder="Nhập tên hoạt động" disabled={busy} /></div>
          <button className="button secondary" disabled={busy}>Tìm kiếm</button>{filtered && <button type="button" className="button secondary" disabled={busy} onClick={() => updateFilters({ search: '', status: '', page: '1' })}>Xóa bộ lọc</button>}
        </div>
      </form>
      <div className="vp-status-filters" role="group" aria-label="Lọc trạng thái đơn đăng ký">{Object.entries(registrationStatuses).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} disabled={busy} onClick={() => updateFilters({ status: value === 'all' ? '' : value, page: '1' })}>
        {label}{data?.summary && <span>{data.summary[value === 'all' ? 'total' : value]}</span>}
      </button>)}</div>
    </div>}
    {!registrations && <HubFilters key={JSON.stringify([mode, search, dateFrom, dateTo])} mode={mode} search={search} dateFrom={dateFrom} dateTo={dateTo} selected={history ? feedback : status} summary={data?.summary} onChange={updateFilters} />}
    <div className="vs-list-toolbar list-results-toolbar"><div>{data && <p role="status">{data.count} {config.countLabel}{!history && status !== 'all' ? ` · ${statusOptions[status]}` : ''}{history && feedback !== 'all' ? ` · ${feedbackStatuses[feedback]} phản hồi` : ''}{search ? ` khớp với “${search}”` : ''}.</p>}</div></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {error?.status === 404 && page > 1 && <button className="button secondary" type="button" onClick={() => movePage(1)}>Về trang đầu</button>}
    {message && <p role="status" className="vp-message">{message}</p>}
    {pending && <ConfirmationDialog title="Xác nhận hủy đăng ký" busy={busy} onClose={() => setPending(null)}>
      <p>Bạn muốn hủy đăng ký hoạt động “{pending.activity.title}”?</p>
      {failure && <p role="alert" className="request-error">{failure}</p>}
      <div className="activity-actions"><button type="button" className="button primary" disabled={busy} onClick={cancel}>{busy ? 'Đang xử lý…' : 'Xác nhận hủy đăng ký'}</button><button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>
    </ConfirmationDialog>}
    {data && <>
      {!data.count && <div className="activity-empty"><p>{filtered ? `Không có ${registrations ? 'đơn đăng ký' : history ? 'lượt tham gia' : 'hoạt động'} phù hợp với bộ lọc.` : config.empty}</p>{filtered ? <button type="button" className="button secondary" onClick={clearFilters}>{registrations ? 'Xem tất cả đơn đăng ký' : history ? 'Xem toàn bộ lịch sử' : 'Xem tất cả hoạt động được duyệt'}</button> : <Link className="button secondary arrow-link-button" to={config.emptyLink}>{config.emptyAction}</Link>}</div>}
      <div className={`vp-list vp-list-${mode}`}>{data.results.map(entry => mode === 'history' ? <HistoryRow key={entry.id} entry={entry} now={now} />
        : mode === 'checkin' ? <CheckinRow key={entry.id} entry={entry} now={now} />
          : <RegistrationRow key={entry.id} entry={entry} busy={busy} onCancel={entry => { setPending(entry); setFailure('') }} />)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label={`Phân trang ${config.title.toLowerCase()}`}><button type="button" className="button secondary" disabled={!data.previous || busy} onClick={() => movePage(page - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" className="button secondary" disabled={!data.next || busy} onClick={() => movePage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
