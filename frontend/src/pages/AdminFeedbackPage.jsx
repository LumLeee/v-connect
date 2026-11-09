import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EyeOff, MessageSquare, RefreshCw, Star, X } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import RequestState from '../components/RequestState.jsx'
import FeedbackAiAnalysis from '../components/FeedbackAiAnalysis.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/admin-feedback.css'

const statuses = { all: 'Tất cả', visible: 'Chưa ẩn', hidden: 'Đã ẩn' }

function FeedbackTime({ value }) {
  return value && Number.isFinite(Date.parse(value))
    ? <time dateTime={value}>{activityTime(value)}</time>
    : <span>Chưa có thông tin</span>
}

function Rating({ value }) {
  return <span className="ad-feedback-rating" aria-label={`${value} trên 5 sao`}><Star size={15} aria-hidden="true" />{value}/5</span>
}

function HiddenDetails({ entry }) {
  return <div className="ad-feedback-hidden-details"><h3>Thông tin xử lý</h3><dl><dt>Lý do ẩn</dt><dd>{entry.hidden_reason || 'Chưa có thông tin'}</dd><dt>Người xử lý</dt><dd>{entry.hidden_by_name || 'Chưa có thông tin'}</dd><dt>Thời điểm ẩn</dt><dd><FeedbackTime value={entry.hidden_at} /></dd></dl></div>
}

export default function AdminFeedbackPage() {
  const [params, setParams] = useSearchParams()
  const status = Object.hasOwn(statuses, params.get('status')) ? params.get('status') : 'all'
  const activity = params.get('activity') || ''
  const hasActivity = params.has('activity')
  const pageValue = Number(params.get('page'))
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const scope = hasActivity ? { activity } : {}
  const { data, loading, error, retry } = useApi(`/admin/feedback/?${new URLSearchParams({ ...scope, status, page: String(page), page_size: '12' })}`)
  const context = useApi(activity ? `/reports/activities/${encodeURIComponent(activity)}/` : null)
  const [selected, setSelected] = useState(null)
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [aiVersion, setAiVersion] = useState(0)

  function refresh() {
    if (busy || loading) return
    setMessage(''); setAiVersion(value => value + 1); retry(); if (activity) context.retry()
  }
  function changeStatus(value) {
    if (busy || loading) return
    setSelected(null); setPending(null); setMessage('')
    setParams({ ...scope, status: value })
  }
  function changePage(value) {
    if (busy || loading) return
    setSelected(null); setPending(null); setMessage('')
    setParams({ ...scope, status, page: String(value) })
  }
  function startHide(entry) {
    if (busy || loading || entry.is_hidden) return
    setPending(entry); setReason(''); setFailure(''); setMessage('')
  }
  async function hide(event) {
    event.preventDefault()
    if (!pending || !reason.trim() || submitting.current) return
    submitting.current = true
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/admin/feedback/${pending.id}/hide/`, { reason: reason.trim() })
      setMessage('Đã ẩn phản hồi và lưu thông tin xử lý.')
      setPending(null); setReason(''); setSelected(null)
      setAiVersion(value => value + 1)
      setParams({ ...scope, status }); retry()
    } catch (problem) { setFailure(problem.message) }
    finally { submitting.current = false; setBusy(false) }
  }

  return <section className="page-width section interior activity-page ad-feedback" aria-labelledby="admin-feedback-title">
    <header className="ad-feedback-heading"><div><h1 id="admin-feedback-title">Kiểm duyệt phản hồi</h1><p>Xem đánh giá và xử lý nội dung cần ẩn.</p></div><button type="button" className="button secondary" disabled={busy || loading} onClick={refresh}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></header>
    <div className="ad-feedback-filters" aria-label="Lọc trạng thái phản hồi">{Object.entries(statuses).map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} className={`button ${status === value ? 'primary' : 'secondary'}`} disabled={busy || loading} onClick={() => changeStatus(value)}>{label}</button>)}</div>
    {hasActivity && <div className="ad-feedback-context"><span>Hoạt động: {context.data?.activity?.title || 'Hoạt động đang chọn'}</span><div>{context.data && <Link className="button secondary" to={`/bao-cao/hoat-dong/${encodeURIComponent(activity)}`}>Xem kết quả hoạt động</Link>}<button type="button" className="button secondary" aria-label="Bỏ lọc theo hoạt động" disabled={busy || loading} onClick={() => { setSelected(null); setPending(null); setMessage(''); setParams({ status }) }}><X size={15} aria-hidden="true" />Bỏ lọc hoạt động</button></div></div>}
    {activity && context.error && <p className="request-error" role="alert">Không tải được tên hoạt động. Bộ lọc hoạt động vẫn đang được áp dụng.</p>}
    {message && <p className="ad-feedback-success" role="status">{message}</p>}
    <RequestState loading={loading} error={error} retry={refresh} />
    <FeedbackAiAnalysis key={`${hasActivity}-${activity}-${status}-${aiVersion}`} endpoint="/admin/feedback/ai-analysis/" filters={{ ...scope, status }} scopeLabel={`${status === 'all' ? 'tất cả phản hồi' : status === 'visible' ? 'phản hồi chưa ẩn' : 'phản hồi đã ẩn'}${hasActivity ? ` của hoạt động ${context.data?.activity?.title || 'đang chọn'}` : ''}`} disabled={loading || busy || Boolean(error) || !data} />
    {data && <>
      <div className="ad-feedback-results"><p role="status"><strong>{data.count}</strong> phản hồi{status === 'all' ? hasActivity ? '' : ' trong hệ thống' : status === 'visible' ? ' chưa ẩn' : ' đã ẩn'}{hasActivity ? ' của hoạt động đang chọn' : ''}.</p></div>
      {!data.count ? <div className="ad-feedback-empty"><MessageSquare size={28} aria-hidden="true" /><h2>Chưa có phản hồi{status === 'all' ? '' : status === 'visible' ? ' chưa ẩn' : ' đã ẩn'}</h2><p>{status === 'all' ? 'Phản hồi của tình nguyện viên sẽ xuất hiện tại đây.' : 'Chọn trạng thái khác để xem các phản hồi còn lại.'}</p></div> : <div className="ad-feedback-list">{data.results.map(entry => <ActionRow key={entry.id} className="activity-card ad-feedback-row" label={`Xem phản hồi của ${entry.volunteer_name}`}>
        <div className="ad-feedback-main"><div className="ad-feedback-row-heading"><h2>{entry.volunteer_name || 'Tình nguyện viên'}</h2><Rating value={entry.rating} /><span className={`ad-feedback-state${entry.is_hidden ? ' hidden' : ''}`}>{entry.is_hidden ? 'Đã ẩn' : 'Chưa ẩn'}</span></div><p className="ad-feedback-activity">{entry.activity_title}</p><p className="ad-feedback-excerpt">{entry.content}</p><p className="ad-feedback-time">Gửi lúc: <FeedbackTime value={entry.created_at} /></p>
          <button type="button" data-record-details data-row-primary className="ad-feedback-details-trigger" disabled={busy || loading} onClick={() => setSelected(entry)}>Xem phản hồi của {entry.volunteer_name}</button>
        </div>
        <div className="ad-feedback-actions">{entry.is_hidden ? <span className="ad-feedback-processed"><EyeOff size={15} aria-hidden="true" />Đã xử lý</span> : <button type="button" data-row-keep-action className="button secondary" disabled={busy || loading} onClick={() => startHide(entry)}><EyeOff size={16} aria-hidden="true" />Ẩn phản hồi</button>}</div>
      </ActionRow>)}</div>}
      <ReportPagination data={data} page={page} busy={busy || loading} onPage={changePage} />
    </>}
    {selected && <ConfirmationDialog title={`Phản hồi của ${selected.volunteer_name || 'tình nguyện viên'}`} className="ad-feedback-details-dialog" onClose={() => setSelected(null)}><div className="ad-feedback-detail-meta"><p>{selected.activity_title}</p><Rating value={selected.rating} /><span className={`ad-feedback-state${selected.is_hidden ? ' hidden' : ''}`}>{selected.is_hidden ? 'Đã ẩn' : 'Chưa ẩn'}</span></div><p className="ad-feedback-full-content">{selected.content}</p><p className="ad-feedback-time">Gửi lúc: <FeedbackTime value={selected.created_at} /></p>{selected.is_hidden && <HiddenDetails entry={selected} />}<div className="ad-feedback-dialog-actions"><button type="button" className="button secondary" onClick={() => setSelected(null)}>Đóng</button></div></ConfirmationDialog>}
    {pending && <ConfirmationDialog title="Ẩn phản hồi" busy={busy} className="ad-feedback-hide-dialog" onClose={() => { if (!busy) setPending(null) }}><form aria-label="Xác nhận ẩn phản hồi" onSubmit={hide}><div className="ad-feedback-confirm-target"><strong>{pending.volunteer_name}</strong><span>{pending.activity_title}</span></div><p>Nhà tổ chức sẽ không thấy phản hồi này. Điểm đánh giá của phản hồi sẽ không được tính.</p><div className="activity-field"><label htmlFor="admin-feedback-reason">Lý do ẩn phản hồi</label><textarea id="admin-feedback-reason" rows={4} required maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /><p className="muted">Lý do và người xử lý được lưu lại.</p></div>{failure && <p className="request-error" role="alert">{failure}</p>}<div className="ad-feedback-dialog-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button><button className="button primary" disabled={busy || !reason.trim()}>{busy ? 'Đang lưu…' : 'Xác nhận ẩn phản hồi'}</button></div></form></ConfirmationDialog>}
  </section>
}
