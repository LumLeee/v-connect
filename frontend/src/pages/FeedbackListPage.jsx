import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

function FeedbackList({ id, admin }) {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const status = ['all', 'hidden', 'visible'].includes(params.get('status')) ? params.get('status') : 'all'
  const { data, loading, error, retry } = useApi(`${admin ? '/admin/feedback/' : `/organizer/activities/${id}/feedback/`}?page=${page}&page_size=12${admin ? `&status=${status}` : ''}`)
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function hide(event) {
    event.preventDefault(); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/admin/feedback/${pending.id}/hide/`, { reason })
      setPending(null); setReason(''); setMessage('Đã ẩn phản hồi và lưu thông tin xử lý.')
      // Removing the last visible row may invalidate the current page.
      setParams({ status, page: '1' }); retry()
    } catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  function changePage(value) { setPending(null); setParams({ page: String(value), ...(admin ? { status } : {}) }) }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={admin ? '/quan-tri' : `/nha-to-chuc/hoat-dong/${id}`}>← {admin ? 'Về quản trị' : 'Về hoạt động'}</Link>
    <h1>{admin ? 'Quản lý phản hồi' : 'Phản hồi hoạt động'}</h1>
    <p>{admin ? 'Ẩn nội dung không phù hợp cần có lý do. Bản gốc và người xử lý được giữ để đối chiếu.' : 'Chỉ hiển thị phản hồi hợp lệ của người đã được xác nhận tham gia. Phản hồi bị ẩn không tính vào thống kê.'}</p>
    {admin && <div className="activity-actions" aria-label="Lọc phản hồi">{[['all', 'Tất cả'], ['visible', 'Chưa ẩn'], ['hidden', 'Đã ẩn']].map(([value, label]) =>
      <button key={value} className={`button ${status === value ? 'primary' : 'secondary'}`} aria-pressed={status === value} disabled={busy}
        onClick={() => { setPending(null); setParams({ status: value, page: '1' }) }}>{label}</button>)}</div>}
    <button className="text-button" disabled={busy} onClick={() => { setPending(null); retry() }}>Cập nhật phản hồi</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}{failure && <p role="alert" className="request-error">{failure}</p>}
    {pending && <form className="activity-confirm" onSubmit={hide} aria-label="Ẩn phản hồi">
      <p>Ẩn phản hồi của {pending.name}? Nhà tổ chức sẽ không thấy nội dung này và điểm đánh giá sẽ không được tính.</p>
      <div className="activity-field"><label htmlFor="hidden-reason">Lý do ẩn phản hồi</label>
        <textarea id="hidden-reason" required maxLength={1000} rows={4} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></div>
      <button className="button primary" disabled={busy || !reason.trim()}>Xác nhận ẩn phản hồi</button>{' '}
      <button type="button" className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </form>}
    {data && <>
      {!admin && <p className="activity-empty" role="status">{data.summary.count} phản hồi hợp lệ. Điểm trung bình: {data.summary.average_rating === null ? 'Chưa có đánh giá' : `${data.summary.average_rating}/5`}.</p>}
      {admin && <p>{data.count} phản hồi.</p>}
      {!data.count && <p className="activity-empty">Chưa có phản hồi trong danh sách này.</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}>
        <h2>{entry.volunteer_name}</h2><p>Hoạt động: {entry.activity_title}</p>
        <p><strong>Điểm đánh giá: {entry.rating}/5</strong></p><p className="activity-description">{entry.content}</p>
        <p>{activityTime(entry.created_at)} (giờ Việt Nam)</p>
        {admin && (entry.is_hidden ? <div className="activity-empty"><p>Đã ẩn phản hồi</p><p>Lý do: {entry.hidden_reason}</p>
          <p>Người xử lý: {entry.hidden_by_name}</p><p>Thời điểm: {activityTime(entry.hidden_at)} (giờ Việt Nam)</p></div>
          : <button className="button secondary" disabled={busy} onClick={() => { setPending({ id: entry.id, name: entry.volunteer_name }); setReason(''); setFailure(''); setMessage('') }}>Ẩn phản hồi</button>)}
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang phản hồi">
        <button className="button secondary" disabled={busy || !data.previous} onClick={() => changePage(page - 1)}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={busy || !data.next} onClick={() => changePage(page + 1)}>Trang sau</button>
      </nav>}
    </>}
  </section>
}

export default function FeedbackListPage({ admin = false }) {
  const { id } = useParams()
  return <FeedbackList key={admin ? 'admin' : id} id={id} admin={admin} />
}
