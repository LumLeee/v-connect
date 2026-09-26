import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { roleLabels } from '../auth/context.js'
import { apiPost } from '../api/client.js'
import '../styles/activities.css'

export default function AdminAccountsPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`/admin/accounts/?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page), page_size: '12' })}`)
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  function movePage(value) { setPending(null); setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next }) }
  async function save(event) {
    event.preventDefault(); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/admin/accounts/${pending.id}/status/`, { is_active: !pending.is_active, reason })
      setMessage(`Đã ${pending.is_active ? 'khóa' : 'mở khóa'} tài khoản và lưu lý do.`)
      setPending(null); setReason(''); movePage(1); retry()
    } catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to="/quan-tri">← Về quản trị</Link><h1>Quản lý tài khoản</h1>
    <p>Khóa/mở khóa Volunteer và Organizer cần lý do. Tài khoản được mở khóa phải đăng nhập lại. Tài khoản Admin được bảo vệ.</p>
    <form className="activity-search" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setPending(null); setParams({ search: form.get('search'), role: form.get('role'), status: form.get('status'), page: '1' }) }}>
      <label htmlFor="account-search">Tìm họ tên, email hoặc username</label><input id="account-search" name="search" maxLength={200} defaultValue={params.get('search') || ''} />
      <label htmlFor="account-role">Vai trò</label><select id="account-role" name="role" defaultValue={params.get('role') || ''}><option value="">Tất cả</option>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <label htmlFor="account-status">Trạng thái tài khoản</label><select id="account-status" name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả</option><option value="active">Hoạt động</option><option value="locked">Bị khóa</option></select>
      <button className="button secondary" disabled={busy}>Lọc tài khoản</button>
    </form>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}{failure && <p role="alert" className="request-error">{failure}</p>}
    {pending && <form className="activity-confirm" aria-label="Xác nhận trạng thái tài khoản" onSubmit={save}>
      <p>{pending.is_active ? 'Khóa' : 'Mở khóa'} tài khoản {pending.full_name} ({pending.email || pending.username})?</p>
      <div className="activity-field"><label htmlFor="account-reason">Lý do thay đổi trạng thái</label><textarea id="account-reason" required maxLength={1000} rows={4} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></div>
      <button className="button primary" disabled={busy || !reason.trim()}>Xác nhận thay đổi</button>{' '}
      <button className="button secondary" type="button" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </form>}
    {data && <><p>{data.count} tài khoản.</p>{!data.count && <p className="activity-empty">Chưa có tài khoản phù hợp.</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}>
        <h2>{entry.full_name}</h2><p>{entry.email || entry.username}</p><p>{roleLabels[entry.role]}</p><p>Trạng thái: {entry.is_active ? 'Hoạt động' : 'Bị khóa'}</p>
        {entry.role !== 'admin' && <button className="button secondary" disabled={busy} onClick={() => { setPending(entry); setReason(''); setFailure(''); setMessage('') }}>{entry.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}</button>}
      </article>)}</div><ReportPagination data={data} page={page} busy={busy} onPage={movePage} /></>}
    <p><Link to="/quan-tri/nhat-ky">Xem nhật ký thao tác</Link></p>
  </section>
}
