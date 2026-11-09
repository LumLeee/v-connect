import ActionRow from '../components/ActionRow.jsx'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, CheckCheck, Mail } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiMutation, apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import { useAuth } from '../auth/context.js'
import AdminNotificationsPage from './AdminNotificationsPage.jsx'
import '../styles/notifications.css'

const calendarDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
const fullDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeZone: 'Asia/Ho_Chi_Minh' })

function notificationGroups(items) {
  const now = Date.now()
  const today = calendarDay.format(now)
  const yesterday = calendarDay.format(now - 86400000)
  const groups = new Map()
  for (const item of items) {
    const date = new Date(item.created_at)
    const day = calendarDay.format(date)
    if (!groups.has(day)) groups.set(day, { day, label: day === today ? 'Hôm nay' : day === yesterday ? 'Hôm qua' : fullDate.format(date), items: [] })
    groups.get(day).items.push(item)
  }
  return [...groups.values()]
}

export default function NotificationsPage() {
  const { user } = useAuth()
  return user?.role === 'admin' ? <AdminNotificationsPage /> : <MemberNotificationsPage />
}

function MemberNotificationsPage() {
  const { user } = useAuth()
  const organizer = user?.role === 'organizer'
  const volunteer = user?.role === 'volunteer'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const state = ['unread', 'read'].includes(params.get('state')) ? params.get('state') : 'all'
  const { data, loading, error, retry } = useApi(`/notifications/?page=${page}&page_size=12&state=${state}`)
  const preferences = useApi('/notifications/preferences/')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [operation, setOperation] = useState('')
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [emailValue, setEmailValue] = useState(null)
  useEffect(() => {
    if (volunteer && error?.status === 404 && page > 1) setParams(current => {
      const next = new URLSearchParams(current); next.delete('page'); return next
    }, { replace: true })
  }, [volunteer, error, page, setParams])
  const summary = data?.summary
  function refresh() {
    retry()
    window.dispatchEvent(new Event('notifications:changed'))
  }
  async function markRead(item, open = false) {
    if (busyRef.current) return
    if (open && (!item?.href || !item.href.startsWith('/') || item.href.startsWith('//'))) {
      setFailure('Thông báo này chưa có nội dung liên quan để mở.'); return
    }
    if (open && item.read_at) { navigate(item.href); return }
    busyRef.current = true
    setOperation(item ? item.id : 'all'); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(item ? `/notifications/${item.id}/read/` : '/notifications/read-all/', {})
      if (page > 1) setParams(current => { const next = new URLSearchParams(current); next.delete('page'); return next })
      refresh()
      if (open) navigate(item.href)
      else setMessage(item ? 'Đã đánh dấu thông báo là đã đọc.' : 'Đã đánh dấu tất cả thông báo là đã đọc.')
    } catch (problem) { setFailure(problem.message) }
    finally { busyRef.current = false; setBusy(false); setOperation('') }
  }
  async function toggleEmail() {
    if (busyRef.current || !preferences.data) return
    busyRef.current = true
    setBusy(true); setFailure(''); setMessage('')
    const previous = emailValue ?? preferences.data.email_enabled
    setEmailValue(!previous)
    try {
      const result = await apiMutation('/notifications/preferences/', { email_enabled: !previous })
      setEmailValue(result.email_enabled)
      setMessage(result.email_enabled ? 'Đã bật email thông báo.' : 'Đã tắt email thông báo.')
    } catch (problem) { setEmailValue(previous); setFailure(problem.message) }
    finally { busyRef.current = false; setBusy(false) }
  }
  const emailSettings = <>
    <p>{user?.role === 'volunteer'
      ? 'Nhận email nghiệp vụ và nhắc lịch trước 1 giờ. Nhắc lịch chỉ áp dụng khi bạn đã được duyệt trước mốc nhắc.'
      : 'Nhận các cập nhật liên quan đến hoạt động và tài khoản qua email.'}</p>
    <RequestState loading={preferences.loading} error={preferences.error} retry={preferences.retry} />
    {preferences.data && <><label><input type="checkbox" checked={emailValue ?? preferences.data.email_enabled} disabled={busy} onChange={toggleEmail} /> Nhận thông báo qua email</label>
      {!preferences.data.email_available && <p>Tài khoản chưa có email nên hiện chỉ nhận thông báo trong website.</p>}</>}
  </>
  const CardHeading = organizer ? 'h3' : 'h2'
  function renderNotification(item) {
    return <ActionRow key={item.id} className={`notification-card ${item.read_at ? '' : 'is-unread'}`}>
      <div className="notification-card-title"><CardHeading>{item.title}</CardHeading><span>{item.read_at ? 'Đã đọc' : 'Chưa đọc'}</span></div>
      <p>{item.body}</p><time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}>{activityTime(item.created_at)}</time>
      <div className="notification-actions"><button className={volunteer ? 'button secondary' : 'text-button'} disabled={busy} onClick={() => markRead(item, true)}>Mở nội dung liên quan</button>
        {!item.read_at && <button className="text-button" disabled={busy} onClick={() => markRead(item)}>Đánh dấu đã đọc</button>}</div>
    </ActionRow>
  }
  return <section className={`page-width section interior notifications-page${organizer ? ' organizer-notifications' : ''}${volunteer ? ' volunteer-notifications' : ''}`}>
    <div className="notifications-heading"><div>{!organizer && !volunteer && <span className="notifications-eyebrow">LUÔN KẾT NỐI</span>}<h1><Bell aria-hidden="true" /> Thông báo</h1>
      </div>
      <button className="button secondary" disabled={busy || loading || (volunteer && summary ? !summary.unread : !data?.count)} onClick={() => markRead(null)}><CheckCheck size={18} aria-hidden="true" /> {operation === 'all' ? 'Đang đánh dấu…' : 'Đánh dấu tất cả đã đọc'}</button></div>
    {organizer || volunteer ? <details className="notification-preference notification-preference-disclosure">
      <summary><Mail size={20} aria-hidden="true" /> Email thông báo</summary><div>{emailSettings}</div>
    </details> : <div className="notification-preference"><Mail aria-hidden="true" /><div><h2>Email thông báo</h2>{emailSettings}</div></div>}
    {volunteer && <div className="notification-state-tabs" role="group" aria-label="Trạng thái thông báo">{[['all', 'Tất cả', 'total'], ['unread', 'Chưa đọc', 'unread'], ['read', 'Đã đọc', 'read']].map(([value, label, count]) => <button key={value} type="button" aria-label={label} aria-pressed={state === value} disabled={busy} onClick={() => { setFailure(''); setMessage(''); setParams(value === 'all' ? {} : { state: value }) }}>{label}{summary && <span aria-hidden="true">{summary[count]}</span>}</button>)}</div>}
    <div className="notification-tools list-results-toolbar">{data && <p>{data.count} thông báo{state === 'unread' ? ' chưa đọc' : state === 'read' ? ' đã đọc' : ''}.</p>}{!volunteer && <label>Hiển thị <select aria-label="Hiển thị" value={state} disabled={busy} onChange={event => setParams({ state: event.target.value })}>
      <option value="all">Tất cả</option><option value="unread">Chưa đọc</option><option value="read">Đã đọc</option>
    </select></label>}<button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={refresh}>Làm mới</button></div>
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {message && <p role="status">{message}</p>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      {!data.count && <div className="notification-empty"><Bell size={32} aria-hidden="true" /><h2>Chưa có thông báo trong danh sách này</h2><p>Các cập nhật mới sẽ xuất hiện tại đây.</p></div>}
      {organizer ? <div className="notification-groups">{notificationGroups(data.results).map(group => <section className="notification-day" key={group.day} aria-label={group.label}>
        <h2>{group.label}</h2><div className="notification-list">{group.items.map(renderNotification)}</div>
      </section>)}</div> : <div className="notification-list">{data.results.map(renderNotification)}</div>}
      {(data.previous || data.next || page > 1) && <nav className="notification-pagination" aria-label="Phân trang thông báo">
        <button className="button secondary" disabled={page <= 1 || busy} onClick={() => setParams({ state, page: String(page - 1) })}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next || busy} onClick={() => setParams({ state, page: String(page + 1) })}>Trang sau</button>
      </nav>}</>}
  </section>
}
