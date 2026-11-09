import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, RefreshCw, X } from 'lucide-react'
import ActionRow from '../components/ActionRow.jsx'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/audit.css'
import '../styles/admin-audit.css'

const actions = { account_locked: 'Khóa tài khoản', account_unlocked: 'Mở khóa tài khoản', review_approved: 'Duyệt đăng ký', review_rejected: 'Từ chối đăng ký', attendance_confirmed: 'Xác nhận có mặt', attendance_code_issued: 'Tạo mã điểm danh', attendance_code_revoked: 'Thu hồi mã điểm danh', feedback_hidden: 'Ẩn phản hồi', activity_created: 'Tạo hoạt động', activity_updated: 'Sửa hoạt động', activity_status_changed: 'Đổi trạng thái hoạt động', activity_cover_changed: 'Đổi ảnh bìa', contribution_confirmed: 'Xác nhận đóng góp', contribution_updated: 'Điều chỉnh đóng góp', invitation_sent: 'Gửi lời mời', invitation_accepted: 'Chấp nhận lời mời', invitation_declined: 'Từ chối lời mời', invitation_withdrawn: 'Thu hồi lời mời' }
const searchFields = [['date_from', 'Từ ngày', 'date'], ['date_to', 'Đến ngày', 'date'], ['actor_search', 'Người thực hiện', 'text'], ['subject_search', 'Tài khoản liên quan', 'text'], ['activity_search', 'Tên hoạt động', 'text']]
const idFields = [['actor', 'Mã người thực hiện'], ['subject', 'Mã tài khoản liên quan'], ['activity', 'Mã hoạt động'], ['object_id', 'Mã đối tượng']]
const filterLabels = Object.fromEntries([['action', 'Thao tác'], ...searchFields, ...idFields])
const keys = Object.keys(filterLabels)

function AuditFilters({ values, onApply, onReset }) {
  const [draft, setDraft] = useState(values)
  const [error, setError] = useState('')
  function apply(next) {
    if (next.date_from && next.date_to && next.date_from > next.date_to) {
      setError('Ngày kết thúc phải từ ngày bắt đầu trở đi.'); return
    }
    setError(''); onApply(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value.trim()])))
  }
  return <form className="audit-filters" aria-label="Bộ lọc nhật ký" onSubmit={event => { event.preventDefault(); apply(draft) }}>
    <div className="audit-filter-grid"><div className="activity-field"><label htmlFor="audit-action">Loại thao tác</label><select id="audit-action" name="action" value={draft.action} onChange={event => { const next = { ...draft, action: event.target.value }; setDraft(next); apply(next) }}>
      <option value="">Tất cả thao tác</option>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {searchFields.map(([name, label, type]) => <div className="activity-field" key={name}><label htmlFor={`audit-${name}`}>{label}</label><input id={`audit-${name}`} name={name} type={type} maxLength={200} max={name === 'date_from' ? draft.date_to || undefined : undefined} min={name === 'date_to' ? draft.date_from || undefined : undefined} value={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></div>)}
    </div>
    <details open={idFields.some(([key]) => values[key]) || undefined}><summary>Tra cứu bằng mã định danh</summary><div className="audit-filter-grid">
      {idFields.map(([name, label]) => <div className="activity-field" key={name}><label htmlFor={`audit-${name}`}>{label}</label><input id={`audit-${name}`} name={name} maxLength={36} value={draft[name]} onChange={event => setDraft({ ...draft, [name]: event.target.value })} /></div>)}
    </div></details>
    {error && <p role="alert" className="request-error">{error}</p>}
    <div className="ad-audit-filter-footer"><p>Tìm người theo tên, email hoặc username hiện tại.</p><div className="activity-actions"><button className="button primary">Áp dụng bộ lọc</button><button className="button secondary" type="button" onClick={onReset}>Xóa bộ lọc</button></div></div>
  </form>
}

function AuditTime({ value }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{activityTime(value)}</time> : <span>Chưa có thời gian</span>
}

export default function AuditPage() {
  const [params, setParams] = useSearchParams()
  const pageValue = Number(params.get('page'))
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const values = Object.fromEntries(keys.map(key => [key, params.get(key) || '']))
  const selected = Object.entries(values).filter(([, value]) => value)
  const query = new URLSearchParams([...selected, ['page', String(page)], ['page_size', '12']])
  const { data, loading, error, retry } = useApi(`/admin/audit/?${query}`)
  function updateFilters(next) { setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value))) }
  function changePage(value) { if (!loading) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) } }
  return <section className="page-width section interior activity-page ad-audit-page" aria-labelledby="audit-title">
    <header className="ad-audit-heading"><div><h1 id="audit-title">Nhật ký thao tác</h1><p>Tra cứu các thay đổi đã được ghi nhận trong hệ thống.</p></div><button type="button" className="button secondary refresh-button" disabled={loading} onClick={retry}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></header>
    <AuditFilters key={keys.map(key => values[key]).join('\u0000')} values={values} onApply={updateFilters} onReset={() => updateFilters({})} />
    {selected.length > 0 && <div className="ad-audit-chips" aria-label="Bộ lọc đang áp dụng">{selected.map(([key, value]) => {
      const label = `${filterLabels[key]}: ${key === 'action' ? actions[value] || value : value}`
      return <button type="button" key={key} aria-label={`Bỏ bộ lọc ${label}`} onClick={() => updateFilters(Object.fromEntries(selected.filter(([name]) => name !== key)))}>{label}<X size={14} aria-hidden="true" /></button>
    })}</div>}
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><p className="ad-audit-count" role="status"><strong>{data.count}</strong> thao tác{selected.length ? ' phù hợp bộ lọc' : ' được ghi nhận'}.</p>
      {!data.count ? <div className="ad-audit-empty"><ClipboardList size={28} aria-hidden="true" /><h2>Chưa có thao tác phù hợp</h2><p>Thử từ khóa khác hoặc xóa bộ lọc để xem lại danh sách.</p></div> : <>
        <div className="ad-audit-columns" aria-hidden="true"><span>Thao tác / Người thực hiện</span><span>Thông tin liên quan</span><span>Thời gian</span></div>
        <div className="activity-grid ad-audit-list">{data.results.map(entry => <ActionRow className="activity-card ad-audit-row" key={entry.id}>
          <div className="ad-audit-primary"><h2><Link to={`/quan-tri/nhat-ky/${encodeURIComponent(entry.id)}${params.size ? `?${params}` : ''}`}>{entry.action_label || actions[entry.action] || entry.action}</Link></h2><p>Người thực hiện: <strong>{entry.actor_name || 'Không còn thông tin'}</strong></p>{entry.reason && <p className="ad-audit-reason">Lý do: {entry.reason}</p>}</div>
          <div className="ad-audit-related">{entry.subject_name && <p><span>Tài khoản</span>{entry.subject_name}</p>}{entry.activity_title && <p><span>Hoạt động</span>{entry.activity_title}</p>}{!entry.subject_name && !entry.activity_title && <p className="muted">Không có thông tin liên quan</p>}</div>
          <div className="ad-audit-time"><AuditTime value={entry.created_at} /></div>
        </ActionRow>)}</div>
      </>}<ReportPagination data={data} page={page} busy={loading} onPage={changePage} /></>}
  </section>
}
