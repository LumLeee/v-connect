import { Link, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/audit.css'

const actions = { account_locked: 'Khóa tài khoản', account_unlocked: 'Mở khóa tài khoản', review_approved: 'Duyệt đăng ký', review_rejected: 'Từ chối đăng ký', attendance_confirmed: 'Xác nhận có mặt', attendance_code_issued: 'Tạo mã điểm danh', attendance_code_revoked: 'Thu hồi mã điểm danh', feedback_hidden: 'Ẩn phản hồi', activity_created: 'Tạo hoạt động', activity_updated: 'Sửa hoạt động', activity_status_changed: 'Đổi trạng thái hoạt động', activity_cover_changed: 'Đổi ảnh bìa', contribution_confirmed: 'Xác nhận đóng góp', contribution_updated: 'Điều chỉnh đóng góp' }
const errorText = value => typeof value === 'string' ? value : Object.values(value || {}).map(errorText).join(' ')
actions.certificate_issued = 'Cấp chứng nhận'
actions.certificate_revoked = 'Thu hồi chứng nhận'

export default function AuditPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`/admin/audit/?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page), page_size: '12' })}`)
  function filter(event) {
    event.preventDefault()
    setParams(Object.fromEntries([...new FormData(event.currentTarget)].filter(([, value]) => value.trim())))
  }
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to="/quan-tri">← Về quản trị</Link><h1>Nhật ký thao tác</h1>
    <p>Tra cứu thao tác và thay đổi trước–sau. Bộ lọc ngày dùng giờ Việt Nam, tính cả ngày bắt đầu và kết thúc. Nhật ký cũ chưa có bản chụp dữ liệu vẫn được giữ nguyên.</p>
    <form className="audit-filters" key={params.toString()} onSubmit={filter}>
      <div className="audit-filter-grid"><div className="activity-field"><label htmlFor="audit-action">Loại thao tác</label><select name="action" id="audit-action" defaultValue={params.get('action') || ''} onChange={event => event.currentTarget.form.requestSubmit()}>
        <option value="">Tất cả</option>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        {[['date_from', 'Từ ngày', 'date'], ['date_to', 'Đến ngày', 'date'], ['actor_search', 'Người thực hiện', 'text'], ['subject_search', 'Tài khoản liên quan', 'text'], ['activity_search', 'Tên hoạt động', 'text']].map(([name, label, type]) => <div className="activity-field" key={name}><label htmlFor={`audit-${name}`}>{label}</label><input id={`audit-${name}`} name={name} type={type} maxLength={200} defaultValue={params.get(name) || ''} /></div>)}
      </div>
      <p className="muted">Tìm người theo tên, email hoặc username hiện tại.</p>
      <details open={['actor', 'subject', 'activity', 'object_id'].some(key => params.has(key)) || undefined}><summary>Tra cứu bằng mã định danh</summary><div className="audit-filter-grid">
        {[['actor', 'Mã người thực hiện'], ['subject', 'Mã tài khoản liên quan'], ['activity', 'Mã hoạt động'], ['object_id', 'Mã đối tượng']].map(([name, label]) => <div className="activity-field" key={name}><label htmlFor={`audit-${name}`}>{label}</label><input id={`audit-${name}`} name={name} defaultValue={params.get(name) || ''} maxLength={36} /></div>)}
      </div></details>
      <div className="activity-actions"><button className="button primary">Áp dụng bộ lọc</button><button className="button secondary" type="button" onClick={() => setParams({})}>Xóa bộ lọc</button></div>
    </form>
    <button className="text-button" onClick={retry}>Cập nhật nhật ký</button><RequestState loading={loading} error={error?.status === 400 ? { ...error, message: errorText(error.details?.error?.details) || error.message } : error} retry={retry} />
    {data && <><p>{data.count} thao tác.</p>{!data.count && <p className="activity-empty">Chưa có thao tác phù hợp.</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card ad-audit-row" key={entry.id}>
        <h2>{entry.action_label}</h2><p>Người thực hiện: {entry.actor_name}</p>{entry.subject_name && <p>Tài khoản liên quan: {entry.subject_name}</p>}
        {entry.activity_title && <p>Hoạt động: {entry.activity_title}</p>}{entry.reason && <p className="activity-description">Lý do: {entry.reason}</p>}
        <time dateTime={entry.created_at}>{activityTime(entry.created_at)} (giờ Việt Nam)</time>
        <p><Link to={`/quan-tri/nhat-ky/${entry.id}?${params}`}>Xem chi tiết thao tác</Link></p>
      </article>)}</div><ReportPagination data={data} page={page} onPage={changePage} /></>}
  </section>
}
