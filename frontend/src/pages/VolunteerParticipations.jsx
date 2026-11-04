import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, CalendarDays, CheckCircle2, ClipboardList, Clock3, ScanLine } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import RequestState from '../components/RequestState.jsx'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { participationLabels } from '../api/participationFormat.js'
import '../styles/volunteer-participations.css'

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

function Summary({ mode, summary }) {
  const items = mode === 'checkin'
    ? [[CheckCircle2, 'Hoạt động được duyệt', summary.total], [ScanLine, 'Chưa điểm danh', summary.pending], [Clock3, 'Đã điểm danh', summary.attended]]
    : mode === 'history'
      ? [[CheckCircle2, 'Lượt đã tham gia', summary.total], [CalendarDays, 'Hoạt động hoàn thành', summary.completed], [Award, 'Điểm đóng góp', summary.total_score]]
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
    <div className="vp-row-meta"><p><span>Đăng ký:</span> <time dateTime={entry.registered_at}>{activityTime(entry.registered_at)}</time></p>
      {entry.reviewed_at && ['approved', 'rejected'].includes(entry.status) && <p><span>Xét duyệt:</span> {activityTime(entry.reviewed_at)}</p>}
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

function CheckinRow({ entry }) {
  const now = new Date()
  const open = entry.activity.time_checks_disabled || (now >= new Date(entry.activity.starts_at) && now < new Date(entry.activity.ends_at))
  const canCheckin = entry.status === 'approved' && entry.activity.status === 'published' && !entry.attendance && open
  return <ActionRow className={`vs-participation-row vp-row vp-checkin${entry.attendance ? ' is-attended' : ''}`} label={`Xem điểm danh: ${entry.activity.title}`}>
    <ActivityInfo entry={entry}><span className={`vp-badge ${entry.attendance ? 'vp-approved' : 'vp-pending'}`}>{entry.attendance ? 'Đã điểm danh' : 'Chưa điểm danh'}</span></ActivityInfo>
    <div className="vp-row-meta"><p><span>Bắt đầu:</span> {activityTime(entry.activity.starts_at)}</p><p><span>Kết thúc:</span> {activityTime(entry.activity.ends_at)}</p><p>{entry.activity.address}</p>
      {entry.attendance ? <p className="vp-attendance"><CheckCircle2 size={16} aria-hidden="true" />Điểm danh: <time dateTime={entry.attendance.confirmed_at}>{activityTime(entry.attendance.confirmed_at)}</time></p>
        : !open && <p className="vp-window-note">{now < new Date(entry.activity.starts_at) ? 'Chưa đến giờ điểm danh.' : 'Đã hết giờ điểm danh.'}</p>}
      <ChangeNote entry={entry} />
    </div>
    <div className="vs-row-actions vp-row-actions"><EntryDetails entry={entry} />
      {canCheckin && <Link data-row-primary data-row-keep-action className="button primary" to={`/hoat-dong/${entry.activity.id}/check-in`}>Check-in hoạt động</Link>}
      {entry.attendance && <Link className="button secondary" to="/tinh-nguyen-vien/lich-su">Xem lịch sử tham gia</Link>}
    </div>
  </ActionRow>
}

function HistoryRow({ entry }) {
  return <ActionRow className="vs-participation-row vp-row vp-history" label={`Xem lượt tham gia: ${entry.activity.title}`}>
    <ActivityInfo entry={entry}><span className={`activity-status status-${entry.activity.status}`}>{activityStatuses[entry.activity.status]}</span></ActivityInfo>
    <div className="vp-row-meta"><p className="vp-attendance"><CheckCircle2 size={16} aria-hidden="true" />Đã xác nhận có mặt</p><p><span>Điểm danh:</span> <time dateTime={entry.attendance.confirmed_at}>{activityTime(entry.attendance.confirmed_at)}</time></p>
      {entry.attendance.method && <p>Hình thức: {entry.attendance.method === 'manual' ? 'Nhà tổ chức xác nhận' : entry.attendance.method === 'qr' ? 'Quét QR' : 'Nhập mã'}</p>}
      {entry.activity.status === 'cancelled' && <p>Hoạt động đã hủy; lượt có mặt được giữ lại.</p>}
    </div>
    <div className="vp-history-result">{entry.contribution ? <><strong>{entry.contribution.score}<small>điểm</small></strong><span>Điểm đóng góp</span></>
      : <p>{entry.activity.status === 'completed' && entry.status === 'approved' ? 'Chờ chấm điểm đóng góp' : 'Chưa ghi nhận điểm đóng góp'}</p>}
      {entry.feedback && <p>Đã đánh giá: {entry.feedback.rating}/5</p>}
    </div>
    <div className="vs-row-actions vp-row-actions"><EntryDetails entry={entry} history />
      {(entry.feedback || entry.can_submit_feedback) && <Link data-row-keep-action className="button secondary" to={`/hoat-dong/${entry.activity.id}/phan-hoi`}>{entry.feedback ? 'Xem phản hồi của tôi' : 'Gửi phản hồi'}</Link>}
    </div>
  </ActionRow>
}

export default function VolunteerParticipations({ mode = 'registrations' }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const config = modes[mode]
  const { data, loading, error, retry } = useApi(`${config.endpoint}?page=${page}&page_size=12`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function cancel() {
    if (busy) return
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/activities/${pending.activity.id}/participation/cancel/`, {})
      setPending(null); setMessage('Đã hủy đăng ký.'); retry()
    } catch (problem) { setFailure(problem.message); retry() }
    finally { setBusy(false) }
  }
  function movePage(value) { setParams({ page: String(value) }); setMessage('') }
  return <section className={`page-width section interior activity-page vs-participations vp-${mode}`}>
    <div className="vs-page-heading"><div><h1>{config.title}</h1><p>{config.description}</p></div><Link className="button primary" to="/hoat-dong">Tìm hoạt động</Link></div>
    {data?.summary && <Summary mode={mode} summary={data.summary} />}
    <div className="vs-list-toolbar list-results-toolbar"><div><h2>{config.heading}</h2>{data && <p>{data.count} {config.countLabel}.{mode === 'history' && data.summary?.feedback_count > 0 && ` ${data.summary.feedback_count} phản hồi đã gửi.`}</p>}</div><button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={retry}>Làm mới</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {error?.status === 404 && page > 1 && <button className="button secondary" type="button" onClick={() => movePage(1)}>Về trang đầu</button>}
    {message && <p role="status" className="vp-message">{message}</p>}
    {pending && <ConfirmationDialog title="Xác nhận hủy đăng ký" busy={busy} onClose={() => setPending(null)}>
      <p>Bạn muốn hủy đăng ký hoạt động “{pending.activity.title}”?</p>
      {failure && <p role="alert" className="request-error">{failure}</p>}
      <div className="activity-actions"><button type="button" className="button primary" disabled={busy} onClick={cancel}>{busy ? 'Đang xử lý…' : 'Xác nhận hủy đăng ký'}</button><button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>
    </ConfirmationDialog>}
    {data && <>
      {!data.count && <div className="activity-empty"><p>{config.empty}</p><Link className="button secondary arrow-link-button" to={config.emptyLink}>{config.emptyAction}</Link></div>}
      <div className={`vp-list vp-list-${mode}`}>{data.results.map(entry => mode === 'history' ? <HistoryRow key={entry.id} entry={entry} />
        : mode === 'checkin' ? <CheckinRow key={entry.id} entry={entry} />
          : <RegistrationRow key={entry.id} entry={entry} busy={busy} onCancel={entry => { setPending(entry); setFailure('') }} />)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label={`Phân trang ${config.title.toLowerCase()}`}><button type="button" className="button secondary" disabled={!data.previous || busy} onClick={() => movePage(page - 1)}>Trang trước</button><span>Trang {page}</span><button type="button" className="button secondary" disabled={!data.next || busy} onClick={() => movePage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
