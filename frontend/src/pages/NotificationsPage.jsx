import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, CheckCheck, Mail } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiMutation, apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/notifications.css'

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const state = ['unread', 'read'].includes(params.get('state')) ? params.get('state') : 'all'
  const { data, loading, error, retry } = useApi(`/notifications/?page=${page}&page_size=12&state=${state}`)
  const preferences = useApi('/notifications/preferences/')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [emailValue, setEmailValue] = useState(null)
  function refresh() {
    retry()
    window.dispatchEvent(new Event('notifications:changed'))
  }
  async function markRead(item, open = false) {
    setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(item ? `/notifications/${item.id}/read/` : '/notifications/read-all/', {})
      if (state === 'unread') setParams({ state })
      refresh()
      if (open) navigate(item.href)
      else setMessage(item ? 'Đã đánh dấu thông báo là đã đọc.' : 'Đã đánh dấu tất cả thông báo là đã đọc.')
    } catch (problem) { setFailure(problem.message) }
    finally { setBusy(false) }
  }
  async function toggleEmail() {
    setBusy(true); setFailure(''); setMessage('')
    const previous = emailValue ?? preferences.data.email_enabled
    setEmailValue(!previous)
    try {
      const result = await apiMutation('/notifications/preferences/', { email_enabled: !previous })
      setEmailValue(result.email_enabled)
      setMessage(result.email_enabled ? 'Đã bật email thông báo.' : 'Đã tắt email thông báo.')
    } catch (problem) { setEmailValue(previous); setFailure(problem.message) }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior notifications-page">
    <div className="notifications-heading"><div><span className="notifications-eyebrow">LUÔN KẾT NỐI</span><h1><Bell aria-hidden="true" /> Thông báo</h1>
      <p>Theo dõi đăng ký, hoạt động và những cập nhật dành cho bạn.</p></div>
      <button className="button secondary" disabled={busy || loading || !data?.count} onClick={() => markRead(null)}><CheckCheck size={18} aria-hidden="true" /> Đánh dấu tất cả đã đọc</button></div>
    <div className="notification-preference"><Mail aria-hidden="true" /><div><h2>Email thông báo</h2>
      <p>Nhận email nghiệp vụ và nhắc lịch trước 1 giờ. Nhắc lịch chỉ áp dụng khi bạn đã được duyệt trước mốc nhắc.</p>
      <RequestState loading={preferences.loading} error={preferences.error} retry={preferences.retry} />
      {preferences.data && <><label><input type="checkbox" checked={emailValue ?? preferences.data.email_enabled} disabled={busy} onChange={toggleEmail} /> Nhận thông báo qua email</label>
        {!preferences.data.email_available && <p>Tài khoản chưa có email nên hiện chỉ nhận thông báo trong website.</p>}</>}</div></div>
    <div className="notification-tools"><label>Hiển thị <select value={state} disabled={busy} onChange={event => setParams({ state: event.target.value })}>
      <option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option>
    </select></label><button className="text-button" disabled={busy} onClick={refresh}>Cập nhật danh sách</button></div>
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {message && <p role="status">{message}</p>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><p>{data.count} thông báo{state === 'unread' ? ' chưa đọc' : state === 'read' ? ' đã đọc' : ''}.</p>
      {!data.count && <div className="notification-empty"><Bell size={32} aria-hidden="true" /><h2>Chưa có thông báo trong danh sách này</h2><p>Các cập nhật mới sẽ xuất hiện tại đây.</p></div>}
      <div className="notification-list">{data.results.map(item => <article key={item.id} className={`notification-card ${item.read_at ? '' : 'is-unread'}`}>
        <div className="notification-card-title"><h2>{item.title}</h2><span>{item.read_at ? 'Đã đọc' : 'Chưa đọc'}</span></div>
        <p>{item.body}</p><time dateTime={item.created_at}>{activityTime(item.created_at)} (giờ Việt Nam)</time>
        <div className="notification-actions"><button className="text-button" disabled={busy} onClick={() => markRead(item, true)}>Xem chi tiết</button>
          {!item.read_at && <button className="text-button" disabled={busy} onClick={() => markRead(item)}>Đánh dấu đã đọc</button>}</div>
      </article>)}</div>
      {(data.previous || data.next || page > 1) && <nav className="notification-pagination" aria-label="Phân trang thông báo">
        <button className="button secondary" disabled={page <= 1 || busy} onClick={() => setParams({ state, page: String(page - 1) })}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next || busy} onClick={() => setParams({ state, page: String(page + 1) })}>Trang sau</button>
      </nav>}</>}
  </section>
}
