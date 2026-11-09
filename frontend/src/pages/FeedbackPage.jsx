import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import RequestState from '../components/RequestState.jsx'
import useUnsavedChanges from '../hooks/useUnsavedChanges.js'
import { apiGet, apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import { CheckCircle2, RefreshCw, Star } from 'lucide-react'
import '../styles/activities.css'
import '../styles/volunteer-feedback.css'

const ratingLabels = ['Rất không hài lòng', 'Chưa hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng']

function FeedbackForm({ id }) {
  const [attempt, setAttempt] = useState(0)
  const [resource, setResource] = useState({ data: null, loading: true, error: null })
  const [submitted, setSubmitted] = useState(null)
  const [rating, setRating] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [validation, setValidation] = useState({})
  const ratingRef = useRef(null)
  const contentRef = useRef(null)
  const { data, loading, error } = resource
  const feedback = [401, 403, 404].includes(error?.status) ? null : data?.feedback || submitted
  const canSubmit = Boolean(data?.can_submit && !feedback)
  const dirty = canSubmit && Boolean(rating || content)
  const allowNavigation = useUnsavedChanges(dirty)
  const retry = () => setAttempt(value => value + 1)

  useEffect(() => {
    const controller = new AbortController()
    // Refresh checks the saved state without replacing an unfinished draft.
    setResource(previous => ({ ...previous, loading: true, error: null }))
    apiGet(`/activities/${id}/feedback/`, { signal: controller.signal })
      .then(next => {
        if (!controller.signal.aborted) setResource({ data: next, loading: false, error: null })
      })
      .catch(problem => {
        if (!controller.signal.aborted) setResource(previous => ({
          data: [401, 403, 404].includes(problem.status) ? null : previous.data,
          loading: false, error: problem,
        }))
      })
    return () => controller.abort()
  }, [id, attempt])

  async function submit(event) {
    event.preventDefault()
    if (busy || loading || error || !canSubmit) return
    const invalid = {}
    if (!rating) invalid.rating = 'Vui lòng chọn từ 1 đến 5 sao.'
    if (!content.trim()) invalid.content = 'Vui lòng nhập nội dung phản hồi.'
    setValidation(invalid)
    if (Object.keys(invalid).length) {
      (invalid.rating ? ratingRef : contentRef).current?.focus()
      return
    }
    setBusy(true); setFailure('')
    try {
      const saved = await apiPost(`/activities/${id}/feedback/`, { rating: Number(rating), content: content.trim() })
      setSubmitted(saved)
      allowNavigation()
      retry()
    } catch (problem) {
      setFailure(problem.message)
      // Recover a saved submission whose response was lost; keep the draft if this GET fails too.
      retry()
    } finally { setBusy(false) }
  }

  return <section className="page-width section interior activity-page volunteer-feedback">
    <div className="activity-heading vf-heading"><h1>Phản hồi của tôi</h1>
      <button type="button" className="button secondary" disabled={busy || loading} onClick={retry}><RefreshCw size={17} aria-hidden="true" />Làm mới</button>
    </div>
    {data?.activity && <div className="vf-context"><h2>{data.activity.title}</h2><p>{activityTime(data.activity.starts_at)}{data.activity.address && ` · ${data.activity.address}`}</p></div>}
    <RequestState loading={loading} error={error} retry={retry} />
    {!feedback && failure && <div role="alert" className="request-error vf-submit-error"><p>{failure}</p><p>Nội dung đang nhập được giữ lại. Kiểm tra trạng thái rồi thử gửi lại.</p></div>}
    {feedback ? <article className="activity-editor vf-card vf-submitted" aria-label="Phản hồi đã gửi">
      <div className="vf-submitted-heading"><CheckCircle2 size={24} aria-hidden="true" /><p role="status">Bạn đã gửi phản hồi cho hoạt động này.</p></div>
      <div className="vf-saved-rating"><span className="vf-display-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map(value => <Star key={value} size={24} className={value <= feedback.rating ? 'selected' : ''} />)}</span>
        <strong>Điểm đánh giá: {feedback.rating}/5</strong><span>{ratingLabels[feedback.rating - 1]}</span></div>
      <h3>Nội dung phản hồi</h3><p className="activity-description vf-content">{feedback.content}</p>
      <p className="vf-sent-at">Đã gửi: <time dateTime={feedback.created_at}>{activityTime(feedback.created_at)}</time>.</p>
      {feedback.is_hidden && <div className="vf-hidden"><p>Phản hồi đã bị Admin ẩn và không được tính vào điểm trung bình.</p><p>Lý do: {feedback.hidden_reason}</p></div>}
    </article> : canSubmit ? <form className="activity-editor vf-card" onSubmit={submit} noValidate aria-label="Gửi phản hồi hoạt động" aria-busy={busy}>
      <p className="vf-once-note" id="feedback-once-note">Chỉ gửi một lần. Bạn không thể sửa hoặc xóa sau khi gửi.</p>
      <fieldset className="vf-form-fields" disabled={busy || loading || Boolean(error)}>
        <legend className="sr-only">Nội dung phản hồi</legend>
        <fieldset className="vf-rating" aria-describedby={`feedback-rating-meaning${validation.rating ? ' feedback-rating-error' : ''}`}>
          <legend>Điểm đánh giá <span className="muted">(1–5 sao)</span></legend>
          <div className="vf-star-options">{[1, 2, 3, 4, 5].map(value => <label key={value} className={`vf-star-option${Number(rating) >= value ? ' selected' : ''}`}>
            <input ref={value === 1 ? ratingRef : undefined} type="radio" name="feedback-rating" required value={value} checked={Number(rating) === value}
              aria-label={`${value} sao`} aria-invalid={Boolean(validation.rating)} onChange={() => { setRating(String(value)); setValidation(previous => ({ ...previous, rating: '' })) }} />
            <Star size={30} aria-hidden="true" />
          </label>)}</div>
          <p id="feedback-rating-meaning" className="vf-rating-meaning" role="status">{rating ? `${rating}/5 — ${ratingLabels[Number(rating) - 1]}` : 'Chọn số sao để đánh giá trải nghiệm của bạn.'}</p>
          {validation.rating && <p id="feedback-rating-error" className="vf-validation" role="alert">{validation.rating}</p>}
        </fieldset>
        <div className="activity-field vf-content-field"><label htmlFor="feedback-content">Nội dung phản hồi</label>
          <textarea ref={contentRef} id="feedback-content" required maxLength={2000} rows={6} value={content} aria-invalid={Boolean(validation.content)}
            aria-describedby={`feedback-content-count${validation.content ? ' feedback-content-error' : ''}`} onChange={event => { setContent(event.target.value); setValidation(previous => ({ ...previous, content: '' })) }} />
          <p id="feedback-content-count" className="vf-character-count">{content.length}/2.000 ký tự</p>
          {validation.content && <p id="feedback-content-error" className="vf-validation" role="alert">{validation.content}</p>}
        </div>
        <div className="vf-savebar"><span className="vf-dirty" role="status">{dirty ? 'Phản hồi chưa gửi' : 'Chưa có nội dung phản hồi'}</span>
          <button className="button primary" disabled={busy || loading || Boolean(error)} aria-describedby="feedback-once-note">{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button></div>
      </fieldset>
    </form> : data && <p className="activity-empty">Bạn chỉ có thể gửi phản hồi khi đã được xác nhận có mặt và hoạt động đã Hoàn thành.</p>}
    <div className="vf-page-actions"><Link className="button secondary" to="/tinh-nguyen-vien/lich-su">Về lịch sử hoạt động</Link>
      {data?.activity?.status === 'published' && <Link className="button secondary" to={`/hoat-dong/${id}`}>Xem hoạt động</Link>}
    </div>
  </section>
}

export default function FeedbackPage() {
  const { id } = useParams()
  return <FeedbackForm key={id} id={id} />
}
