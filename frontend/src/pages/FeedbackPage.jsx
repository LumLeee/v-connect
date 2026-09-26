import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

function FeedbackForm({ id }) {
  const activity = useApi(`/activities/${id}/`)
  const { data, loading, error, retry } = useApi(`/activities/${id}/feedback/`)
  const [rating, setRating] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  async function submit(event) {
    event.preventDefault(); setBusy(true); setFailure('')
    try {
      await apiPost(`/activities/${id}/feedback/`, { rating: Number(rating), content })
      retry()
    } catch (problem) {
      setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message)
      // Fetch any successful submission whose response was lost, without erasing the draft.
      retry()
    } finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to="/tinh-nguyen-vien/lich-su">← Lịch sử tham gia</Link>
    <h1>Phản hồi của tôi</h1>
    <RequestState loading={activity.loading} error={activity.error} retry={activity.retry} />
    {activity.data && <h2>{activity.data.title}</h2>}
    <RequestState loading={loading} error={error} retry={retry} />
    {failure && <p role="alert" className="request-error">{failure}</p>}
    {data?.feedback ? <article className="activity-editor">
      <p role="status">Bạn đã gửi phản hồi cho hoạt động này.</p>
      <p><strong>Điểm đánh giá: {data.feedback.rating}/5</strong></p>
      <p className="activity-description">{data.feedback.content}</p>
      <p>Đã gửi: {activityTime(data.feedback.created_at)} (giờ Việt Nam).</p>
      {data.feedback.is_hidden && <div className="activity-empty"><p>Phản hồi đã bị Admin ẩn và không được tính vào điểm trung bình.</p><p>Lý do: {data.feedback.hidden_reason}</p></div>}
    </article> : data?.can_submit ? <form className="activity-editor" onSubmit={submit}>
      <p>Chia sẻ trải nghiệm thực tế của bạn với Nhà tổ chức. Mỗi người chỉ gửi một lần, không sửa hoặc xóa sau khi gửi.</p>
      <fieldset disabled={busy}>
        <legend className="sr-only">Nội dung phản hồi</legend>
        <div className="activity-field"><label htmlFor="feedback-rating">Điểm đánh giá (1–5)</label>
          <input id="feedback-rating" type="number" min="1" max="5" step="1" required value={rating} onChange={event => setRating(event.target.value)} /></div>
        <div className="activity-field"><label htmlFor="feedback-content">Nội dung phản hồi</label>
          <textarea id="feedback-content" required maxLength={2000} rows={7} value={content} onChange={event => setContent(event.target.value)} />
          <p className="muted">{content.length}/2.000 ký tự.</p></div>
        <button className="button primary" disabled={busy || !content.trim()}>{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
      </fieldset>
    </form> : data && <p className="activity-empty">Bạn chỉ có thể gửi phản hồi khi đã được xác nhận có mặt và hoạt động đã Hoàn thành.</p>}
    <p><Link to={`/hoat-dong/${id}`}>Xem hoạt động</Link></p>
  </section>
}

export default function FeedbackPage() {
  const { id } = useParams()
  return <FeedbackForm key={id} id={id} />
}
