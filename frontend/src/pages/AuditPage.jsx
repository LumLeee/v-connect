import { Link, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'

const actions = { account_locked: 'Khóa tài khoản', account_unlocked: 'Mở khóa tài khoản', review_approved: 'Duyệt đăng ký', review_rejected: 'Từ chối đăng ký', attendance_confirmed: 'Xác nhận có mặt', feedback_hidden: 'Ẩn phản hồi' }

export default function AuditPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`/admin/audit/?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page), page_size: '12' })}`)
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to="/quan-tri">← Về quản trị</Link><h1>Nhật ký thao tác</h1>
    <p>Ghi nhận thao tác từ khi triển khai chức năng nhật ký. Các bản ghi cũ về xét duyệt, điểm danh và ẩn phản hồi vẫn được giữ trong dữ liệu nghiệp vụ.</p>
    <div className="activity-field"><label htmlFor="audit-action">Loại thao tác</label><select id="audit-action" value={params.get('action') || ''} onChange={event => setParams({ action: event.target.value, page: '1' })}>
      <option value="">Tất cả</option>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    <button className="text-button" onClick={retry}>Cập nhật nhật ký</button><RequestState loading={loading} error={error} retry={retry} />
    {data && <><p>{data.count} thao tác.</p>{!data.count && <p className="activity-empty">Chưa có thao tác phù hợp.</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}>
        <h2>{entry.action_label}</h2><p>Người thực hiện: {entry.actor_name}</p>{entry.subject_name && <p>Tài khoản liên quan: {entry.subject_name}</p>}
        {entry.activity_title && <p>Hoạt động: {entry.activity_title}</p>}{entry.reason && <p className="activity-description">Lý do: {entry.reason}</p>}
        <p>{activityTime(entry.created_at)} (giờ Việt Nam)</p>
      </article>)}</div><ReportPagination data={data} page={page} onPage={value => setParams({ action: params.get('action') || '', page: String(value) })} /></>}
  </section>
}
