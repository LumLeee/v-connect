import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LockKeyhole, RefreshCw, Search, ShieldCheck, UnlockKeyhole, X } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import useApi from '../hooks/useApi.js'
import { roleLabels } from '../auth/context.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/admin-accounts.css'

const statusLabels = { active: 'Hoạt động', locked: 'Bị khóa' }

function AccountDate({ value }) {
  return value && Number.isFinite(Date.parse(value))
    ? <time dateTime={value}>{activityTime(value)}</time>
    : <span className="muted">Chưa có thông tin</span>
}

function AccountFilters({ search, role, status, busy, onApply, onReset }) {
  const [keyword, setKeyword] = useState(search)
  const [selectedRole, setSelectedRole] = useState(role)
  const [selectedStatus, setSelectedStatus] = useState(status)
  return <form className="ad-account-filters" aria-label="Bộ lọc tài khoản" onSubmit={event => {
    event.preventDefault()
    if (!busy) onApply({ search: keyword.trim(), role: selectedRole, status: selectedStatus })
  }}>
    <div className="ad-account-filter-search"><label htmlFor="account-search">Tìm tài khoản</label>
      <div className="ad-account-search-input"><Search size={18} aria-hidden="true" /><input id="account-search" name="search" placeholder="Họ tên, email hoặc username" maxLength={200} value={keyword} disabled={busy} onChange={event => setKeyword(event.target.value)} /></div>
    </div>
    <div><label htmlFor="account-role">Vai trò</label><select id="account-role" name="role" value={selectedRole} disabled={busy} onChange={event => setSelectedRole(event.target.value)}><option value="">Tất cả vai trò</option>{Object.entries(roleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div><label htmlFor="account-status">Trạng thái</label><select id="account-status" name="status" value={selectedStatus} disabled={busy} onChange={event => setSelectedStatus(event.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <div className="ad-account-filter-actions"><button className="button primary" disabled={busy}>Áp dụng</button><button className="button secondary" type="button" disabled={busy} onClick={() => { setKeyword(''); setSelectedRole(''); setSelectedStatus(''); onReset() }}>Xóa bộ lọc</button></div>
  </form>
}

export default function AdminAccountsPage() {
  const [params, setParams] = useSearchParams()
  const pageValue = Number(params.get('page'))
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const search = params.get('search') || ''
  const role = params.get('role') || ''
  const status = params.get('status') || ''
  const query = new URLSearchParams({ search, role, status, page: String(page), page_size: '12' })
  const { data, loading, error, retry } = useApi(`/admin/accounts/?${query}`)
  const [pending, setPending] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const filters = [search && ['search', `Tìm: ${search}`], role && ['role', roleLabels[role] || role], status && ['status', statusLabels[status] || status]].filter(Boolean)

  function updateFilters(values) {
    if (busy) return
    setMessage(''); setPending(null)
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value)
    setParams(next)
  }
  function movePage(value) {
    if (busy || loading) return
    setPending(null)
    setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next })
  }
  function openStatus(entry) {
    if (busy || loading || entry.role === 'admin') return
    setPending(entry); setReason(''); setFailure(''); setMessage('')
  }
  async function save(event) {
    event.preventDefault()
    if (!pending || !reason.trim() || submitting.current) return
    submitting.current = true
    setBusy(true); setFailure(''); setMessage('')
    const account = pending
    try {
      await apiPost(`/admin/accounts/${account.id}/status/`, { is_active: !account.is_active, reason: reason.trim() })
      setMessage(`Đã ${account.is_active ? 'khóa' : 'mở khóa'} tài khoản ${account.full_name || account.email || account.username}.`)
      setPending(null); setReason('')
      setParams(previous => { const next = new URLSearchParams(previous); next.delete('page'); return next })
      retry()
    } catch (problem) { setFailure(problem.message) }
    finally { submitting.current = false; setBusy(false) }
  }

  return <section className="page-width section interior activity-page ad-accounts" aria-labelledby="accounts-title">
    <header className="ad-account-heading"><div><h1 id="accounts-title">Tài khoản hệ thống</h1><p>Tra cứu tài khoản và quản lý trạng thái truy cập.</p></div>
      <button className="button secondary" type="button" disabled={busy || loading} onClick={retry}><RefreshCw size={17} aria-hidden="true" />Làm mới</button>
    </header>
    <AccountFilters key={`${search}\u0000${role}\u0000${status}`} search={search} role={role} status={status} busy={busy} onApply={updateFilters} onReset={() => updateFilters({})} />
    {filters.length > 0 && <div className="ad-account-active-filters" aria-label="Bộ lọc đang áp dụng">{filters.map(([key, label]) => <button type="button" key={key} disabled={busy} aria-label={`Bỏ bộ lọc ${label}`} onClick={() => updateFilters(Object.fromEntries([['search', search], ['role', role], ['status', status]].filter(([name]) => name !== key)))}>{label}<X size={14} aria-hidden="true" /></button>)}</div>}
    {message && <p className="ad-account-success" role="status">{message}</p>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="ad-account-results"><p role="status"><strong>{data.count}</strong> tài khoản{filters.length ? ' phù hợp bộ lọc' : ' trong hệ thống'}.</p><Link to="/quan-tri/nhat-ky" className="button secondary">Lịch sử thao tác</Link></div>
      {!data.count ? <div className="ad-account-empty"><Search size={28} aria-hidden="true" /><h2>Không có tài khoản phù hợp</h2><p>Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.</p></div> : <>
        <div className="ad-account-columns" aria-hidden="true"><span>Tài khoản</span><span>Vai trò</span><span>Trạng thái</span><span>Ngày tham gia</span><span>Thao tác</span></div>
        <div className="ad-account-list">{data.results.map(entry => <ActionRow className="activity-card ad-account-row" label={`Xem chi tiết tài khoản ${entry.full_name || entry.email || entry.username}`} key={entry.id}>
          <div className="ad-account-identity"><h2>{entry.full_name || entry.email || entry.username}</h2><p>{entry.email || entry.username}</p>
            <RecordDetails title={entry.full_name || entry.email || entry.username}><dl className="ad-account-details"><dt>Họ tên</dt><dd>{entry.full_name || 'Chưa có thông tin'}</dd><dt>Email</dt><dd>{entry.email || 'Chưa có thông tin'}</dd>{entry.username && <><dt>Username</dt><dd>{entry.username}</dd></>}<dt>Vai trò</dt><dd>{roleLabels[entry.role] || entry.role}</dd><dt>Trạng thái</dt><dd>{entry.is_active ? 'Hoạt động' : 'Bị khóa'}</dd><dt>Ngày tham gia</dt><dd><AccountDate value={entry.date_joined} /></dd></dl></RecordDetails>
          </div>
          <div className="ad-account-cell"><span className="ad-account-mobile-label">Vai trò</span>{roleLabels[entry.role] || entry.role}</div>
          <div className="ad-account-cell"><span className="ad-account-mobile-label">Trạng thái</span><span className={`ad-account-state${entry.is_active ? '' : ' locked'}`}>{entry.is_active ? 'Hoạt động' : 'Bị khóa'}</span></div>
          <div className="ad-account-cell ad-account-date"><span className="ad-account-mobile-label">Ngày tham gia</span><AccountDate value={entry.date_joined} /></div>
          <div className="ad-account-row-actions">{entry.role === 'admin' ? <span className="ad-account-protected"><ShieldCheck size={16} aria-hidden="true" />Được bảo vệ</span> : <button type="button" className="button secondary" data-row-keep-action disabled={busy || loading} onClick={() => openStatus(entry)}>{entry.is_active ? <LockKeyhole size={16} aria-hidden="true" /> : <UnlockKeyhole size={16} aria-hidden="true" />}{entry.is_active ? 'Khóa' : 'Mở khóa'}</button>}</div>
        </ActionRow>)}</div>
      </>}
      <ReportPagination data={data} page={page} busy={busy || loading} onPage={movePage} />
    </>}
    {pending && <ConfirmationDialog title={pending.is_active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} busy={busy} onClose={() => { if (!busy) setPending(null) }} className="ad-account-status-dialog"><form className="ad-account-confirm" aria-label="Xác nhận trạng thái tài khoản" onSubmit={save}>
      <div className="ad-account-confirm-target"><strong>{pending.full_name || pending.email || pending.username}</strong><span>{pending.email || pending.username}</span></div>
      <p>{pending.is_active ? 'Tài khoản sẽ không thể đăng nhập sau khi bị khóa.' : 'Tài khoản sẽ được đăng nhập trở lại sau khi mở khóa.'}</p>
      <div className="activity-field"><label htmlFor="account-reason">Lý do {pending.is_active ? 'khóa' : 'mở khóa'} tài khoản</label><textarea id="account-reason" required maxLength={1000} rows={4} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /><p className="muted">Lý do được lưu trong lịch sử thao tác.</p></div>
      {failure && <p role="alert" className="request-error">{failure}</p>}
      <div className="ad-account-confirm-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => setPending(null)}>Quay lại</button><button className="button primary" disabled={busy || !reason.trim()}>{busy ? 'Đang lưu…' : pending.is_active ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}</button></div>
    </form></ConfirmationDialog>}
  </section>
}
