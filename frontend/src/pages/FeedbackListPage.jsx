import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import FeedbackAiAnalysis from '../components/FeedbackAiAnalysis.jsx'
import AdminFeedbackPage from './AdminFeedbackPage.jsx'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/organizer-feedback.css'

function Rating({ value }) {
  return <span className="organizer-feedback-rating" role="img" aria-label={`${value} trên 5 sao`}><span aria-hidden="true">{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span><span aria-hidden="true">{value}/5</span></span>
}

function FeedbackList({ id, admin }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = ['all', 'hidden', 'visible'].includes(params.get('status')) ? params.get('status') : 'all'
  const rating = ['1', '2', '3', '4', '5'].includes(params.get('rating')) ? params.get('rating') : 'all'
  const ordering = params.get('ordering') === 'oldest' ? 'oldest' : 'newest'
  const { data, loading, error, retry } = useApi(`${admin ? '/admin/feedback/' : `/organizer/activities/${id}/feedback/`}?page=${page}&page_size=12${admin ? `&status=${status}` : `&rating=${rating}&ordering=${ordering}`}`)
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [aiVersion, setAiVersion] = useState(0)
  function refresh() { setPending(null); setAiVersion(value => value + 1); retry() }
  async function hide(event) {
    event.preventDefault(); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/admin/feedback/${pending.id}/hide/`, { reason })
      setPending(null); setReason(''); setMessage('Đã ẩn phản hồi và lưu thông tin xử lý.')
      setAiVersion(value => value + 1)
      // Removing the last visible row may invalidate the current page.
      setParams({ status, page: '1' }); retry()
    } catch (problem) { setFailure(problem.message) }
    finally { setBusy(false) }
  }
  function changePage(value) { setPending(null); setParams({ page: String(value), ...(admin ? { status } : { rating, ordering }) }) }
  function changeFilter(name, value) { setParams({ rating, ordering, [name]: value, page: '1' }) }
  return <section className={`page-width section interior activity-page${admin ? '' : ' organizer-feedback-page'}`}>

    <h1>{admin ? 'Quản lý phản hồi' : 'Phản hồi hoạt động'}</h1>
    {!admin && <OrganizerActivityHeader id={id} selected="feedback" />}

    {admin && <div className="activity-actions" aria-label="Lọc phản hồi">{[['all', 'Tất cả'], ['visible', 'Chưa ẩn'], ['hidden', 'Đã ẩn']].map(([value, label]) =>
      <button key={value} className={`button ${status === value ? 'primary' : 'secondary'}`} aria-pressed={status === value} disabled={busy}
        onClick={() => { setPending(null); setParams({ status: value, page: '1' }) }}>{label}</button>)}</div>}
    {!admin && <div className="organizer-feedback-filters" aria-label="Lọc phản hồi">
      <label>Mức đánh giá<select value={rating} onChange={event => changeFilter('rating', event.target.value)}>
        <option value="all">Tất cả mức sao</option>{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} sao</option>)}
      </select></label>
      <label>Sắp xếp<select value={ordering} onChange={event => changeFilter('ordering', event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option></select></label>
    </div>}
    <div className="list-results-toolbar">{data && <>{!admin && <p className="muted" role="status">{data.summary.count} phản hồi hợp lệ. Điểm trung bình: {data.summary.average_rating === null ? 'Chưa có đánh giá' : `${data.summary.average_rating}/5`}.</p>}
      {admin && <p>{data.count} phản hồi.</p>}</>}<button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={refresh}>{loading ? 'Đang tải…' : 'Làm mới'}</button></div>
    <RequestState loading={loading} error={error} retry={refresh} />
    <FeedbackAiAnalysis key={`${admin ? status : `${rating}-${ordering}`}-${aiVersion}`} endpoint={admin ? '/admin/feedback/ai-analysis/' : `/organizer/activities/${id}/feedback/ai-analysis/`} filters={admin ? { status } : { rating, ordering }}
      scopeLabel={admin ? status === 'hidden' ? 'phản hồi đã ẩn' : status === 'visible' ? 'phản hồi chưa ẩn' : 'tất cả phản hồi' : `${rating === 'all' ? 'mọi mức sao' : `${rating} sao`}, ${ordering === 'newest' ? 'mới nhất trước' : 'cũ nhất trước'}`} disabled={loading || busy || Boolean(error) || !data} />
    {message && <p role="status">{message}</p>}{failure && <p role="alert" className="request-error">{failure}</p>}
    {pending && <ConfirmationDialog title="Ẩn phản hồi" busy={busy} onClose={() => setPending(null)}><form className="activity-confirm" onSubmit={hide} aria-label="Ẩn phản hồi">{failure && <p role="alert" className="request-error">{failure}</p>}
      <p>Ẩn phản hồi của {pending.name}? Nhà tổ chức sẽ không thấy nội dung này và điểm đánh giá sẽ không được tính.</p>
      <div className="activity-field"><label htmlFor="hidden-reason">Lý do ẩn phản hồi</label>
        <textarea id="hidden-reason" required maxLength={1000} rows={4} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></div>
      <button className="button primary" disabled={busy || !reason.trim()}>Xác nhận ẩn phản hồi</button>{' '}
      <button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </form></ConfirmationDialog>}
    {data && <>

      {!admin && rating !== 'all' && <p className="muted" role="status">{data.count} phản hồi {rating} sao.</p>}
      {!data.count && <p className="activity-empty">{!admin && rating !== 'all' ? `Chưa có phản hồi ${rating} sao. Hãy chọn mức sao khác hoặc tất cả mức sao.` : 'Chưa có phản hồi trong danh sách này.'}</p>}
      <div className={`activity-grid${admin ? '' : ' organizer-feedback-list'}`}>{data.results.map(entry => admin ? <ActionRow className="activity-card" key={entry.id}>
        <h2>{entry.volunteer_name}</h2><p>Hoạt động: {entry.activity_title}</p>
        <p><strong>Điểm đánh giá: {entry.rating}/5</strong></p><RecordDetails title={entry.volunteer_name}><p className="activity-description">{entry.content}</p>
        <p>{activityTime(entry.created_at)}</p>
        {admin && entry.is_hidden && <><p>Lý do ẩn: {entry.hidden_reason}</p><p>Người xử lý: {entry.hidden_by_name}</p><p>Thời điểm: {activityTime(entry.hidden_at)}</p></>}
        </RecordDetails>
        {admin && (entry.is_hidden ? <p>Đã ẩn phản hồi</p>
          : <button className="button secondary" disabled={busy} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name }); setReason(''); setFailure(''); setMessage('') }}>Ẩn phản hồi</button>)}
      </ActionRow> : <ActionRow className="activity-card organizer-feedback-row" key={entry.id} label={`Xem phản hồi của ${entry.volunteer_name}`}>
        <div className="organizer-feedback-author"><h2>{entry.volunteer_name}</h2><Rating value={entry.rating} /></div>
        <p className="organizer-feedback-excerpt">{entry.content}</p>
        <time className="organizer-feedback-time" dateTime={entry.created_at}>{activityTime(entry.created_at)}</time>
        <RecordDetails title={`Phản hồi của ${entry.volunteer_name}`}><Rating value={entry.rating} /><p className="activity-description">{entry.content}</p><p>Gửi lúc: {activityTime(entry.created_at)}</p></RecordDetails>
      </ActionRow>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang phản hồi">
        <button className="button secondary" disabled={busy || !data.previous} onClick={() => changePage(page - 1)}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={busy || !data.next} onClick={() => changePage(page + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>
}

export default function FeedbackListPage({ admin = false }) {
  const { id } = useParams()
  if (admin) return <AdminFeedbackPage />
  return <FeedbackList key={admin ? 'admin' : id} id={id} admin={admin} />
}
