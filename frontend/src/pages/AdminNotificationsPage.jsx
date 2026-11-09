import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bell, CheckCheck, Mail, RefreshCw } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import useApi from '../hooks/useApi.js'
import { apiMutation, apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/admin-notifications.css'

const states = [['all', 'Tất cả', 'total'], ['unread', 'Chưa đọc', 'unread'], ['read', 'Đã đọc', 'read']]
const safeLink = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
  && !value.includes('\\') && [...value].every(character => character.codePointAt(0) >= 32 && character.codePointAt(0) !== 127)
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short' })
const dateFormat = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'long' })

function groups(items) {
  const today = dayFormat.format(Date.now()), yesterday = dayFormat.format(Date.now() - 86400000)
  const result = new Map()
  for (const item of items) {
    const valid = Number.isFinite(Date.parse(item.created_at)), day = valid ? dayFormat.format(new Date(item.created_at)) : 'unknown'
    const label = day === today ? 'Hôm nay' : day === yesterday ? 'Hôm qua' : valid ? dateFormat.format(new Date(item.created_at)) : 'Chưa có thời gian'
    if (!result.has(day)) result.set(day, { label, items: [] })
    result.get(day).items.push(item)
  }
  return [...result.entries()]
}

export default function AdminNotificationsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const state = ['unread', 'read'].includes(params.get('state')) ? params.get('state') : 'all'
  const pageValue = Number(params.get('page')), page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const { data, loading, error, retry } = useApi(`/notifications/?${new URLSearchParams({ state, page: String(page), page_size: '12' })}`)
  const preferences = useApi('/notifications/preferences/')
  const [busy, setBusy] = useState(false), [operation, setOperation] = useState('')
  const [failure, setFailure] = useState(''), [message, setMessage] = useState('')
  const [emailValue, setEmailValue] = useState(null)
  const submitting = useRef(false)
  useEffect(() => {
    if (error?.status === 404 && page > 1) setParams(current => {
      const next = new URLSearchParams(current); next.delete('page'); return next
    }, { replace: true })
  }, [error, page, setParams])
  function refresh() {
    if (submitting.current || loading) return
    setFailure(''); setMessage(''); retry()
    window.dispatchEvent(new Event('notifications:changed'))
  }
  function filter(value) {
    if (submitting.current || loading) return
    setFailure(''); setMessage(''); setParams(value === 'all' ? {} : { state: value })
  }
  async function markRead(item, open = false) {
    if (submitting.current || loading) return
    if (open && !safeLink(item?.href)) return
    if (open && item.read_at) { navigate(item.href); return }
    submitting.current = true; setBusy(true); setOperation(item?.id || 'all'); setFailure(''); setMessage('')
    try {
      await apiPost(item ? `/notifications/${item.id}/read/` : '/notifications/read-all/', {})
      if (page > 1) setParams(state === 'all' ? {} : { state })
      retry(); window.dispatchEvent(new Event('notifications:changed'))
      if (open) navigate(item.href)
      else setMessage(item ? 'Đã đánh dấu thông báo là đã đọc.' : 'Đã đánh dấu tất cả thông báo là đã đọc.')
    } catch (problem) { setFailure(problem.message) }
    finally { submitting.current = false; setBusy(false); setOperation('') }
  }
  async function toggleEmail() {
    if (submitting.current || !preferences.data) return
    const previous = emailValue ?? preferences.data.email_enabled
    submitting.current = true; setBusy(true); setFailure(''); setMessage(''); setEmailValue(!previous)
    try {
      const result = await apiMutation('/notifications/preferences/', { email_enabled: !previous })
      setEmailValue(result.email_enabled); setMessage(result.email_enabled ? 'Đã bật email thông báo.' : 'Đã tắt email thông báo.')
    } catch (problem) { setEmailValue(previous); setFailure(problem.message) }
    finally { submitting.current = false; setBusy(false) }
  }
  const unread = data?.summary?.unread
  return <section className="page-width section interior ad-notifications" aria-labelledby="admin-notification-title" aria-busy={loading || busy}>
    <header className="ad-notification-heading"><h1 id="admin-notification-title">Thông báo</h1><div><button type="button" className="button secondary" disabled={busy || loading || !data || (unread != null ? !unread : !data.count)} onClick={() => markRead(null)}><CheckCheck size={17} aria-hidden="true" />{operation === 'all' ? 'Đang đánh dấu…' : 'Đánh dấu tất cả đã đọc'}</button><button type="button" className="button secondary" disabled={busy || loading} onClick={refresh}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></div></header>
    <details className="ad-notification-preferences"><summary><Mail size={18} aria-hidden="true" />Email thông báo</summary><div>
      <RequestState loading={preferences.loading} error={preferences.error} retry={preferences.retry} />
      {preferences.data && <><label><input type="checkbox" checked={emailValue ?? preferences.data.email_enabled} disabled={busy} onChange={toggleEmail} />Nhận thông báo qua email</label><p>{preferences.data.email_available ? 'Nhận cập nhật liên quan đến tài khoản qua email.' : 'Tài khoản chưa có email nên hiện chỉ nhận thông báo trong website.'}</p></>}
    </div></details>
    <div className="ad-notification-filters" role="group" aria-label="Trạng thái thông báo">{states.map(([value, label, key]) => <button type="button" key={value} aria-label={label} aria-pressed={state === value} disabled={busy || loading} onClick={() => filter(value)}>{label}{data?.summary && <span aria-hidden="true">{data.summary[key]}</span>}</button>)}</div>
    {failure && <p className="request-error" role="alert">{failure}</p>}{message && <p className="ad-notification-success" role="status">{message}</p>}
    <RequestState loading={loading} error={error} retry={refresh} />
    {data && <><p className="ad-notification-count" role="status">{data.count} thông báo{state === 'unread' ? ' chưa đọc' : state === 'read' ? ' đã đọc' : ''}.</p>
      {!data.count && <div className="ad-notification-empty"><Bell size={28} aria-hidden="true" /><h2>{state === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo trong danh sách này'}</h2><p>Các cập nhật mới sẽ xuất hiện tại đây.</p></div>}
      <div className="ad-notification-groups">{groups(data.results).map(([day, group]) => <section key={day} aria-label={group.label}><h2>{group.label}</h2><div className="ad-notification-list">{group.items.map(item => {
        const canOpen = safeLink(item.href), Row = canOpen ? ActionRow : 'article'
        return <Row key={item.id} className={`ad-notification-row${item.read_at ? '' : ' unread'}`} {...(canOpen ? { label: `Mở thông báo ${item.title}` } : {})}>
          <div className="ad-notification-main"><div className="ad-notification-row-heading"><h3>{item.title}</h3><span>{item.read_at ? 'Đã đọc' : 'Chưa đọc'}</span></div><p>{item.body}</p><p className="ad-notification-time">{item.created_at && Number.isFinite(Date.parse(item.created_at)) ? <time dateTime={item.created_at}>{activityTime(item.created_at)}</time> : 'Chưa có thời gian'}</p>
            {canOpen && <button type="button" data-row-primary className="ad-notification-open" disabled={busy || loading} onClick={() => markRead(item, true)}>Mở nội dung liên quan</button>}
          </div>{!item.read_at && <button type="button" className="button secondary" data-row-keep-action disabled={busy || loading} onClick={() => markRead(item)}>{operation === item.id ? 'Đang đánh dấu…' : 'Đánh dấu đã đọc'}</button>}
        </Row>
      })}</div></section>)}</div>
      <ReportPagination data={data} page={page} busy={busy || loading} onPage={value => { setFailure(''); setMessage(''); setParams({ state, page: String(value) }) }} />
    </>}
  </section>
}
