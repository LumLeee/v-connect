import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/audit.css'

const labels = { title: 'Tên hoạt động / mốc', description: 'Mô tả', address: 'Địa điểm', starts_at: 'Bắt đầu', ends_at: 'Kết thúc', capacity: 'Sức chứa', status: 'Trạng thái', required_skills: 'Kỹ năng yêu cầu', timeline: 'Chương trình hoạt động', cover: 'Tệp ảnh bìa', is_active: 'Tài khoản hoạt động', attended: 'Có mặt', method: 'Cách điểm danh', is_hidden: 'Đã ẩn', minutes: 'Số phút đóng góp', revision: 'Lần xác nhận', issued_at: 'Thời điểm tạo mã', expires_at: 'Hết hạn mã', revoked_at: 'Thu hồi mã' }
const statuses = { draft: 'Nháp', published: 'Công khai', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ duyệt', approved: 'Được duyệt', rejected: 'Bị từ chối', manual: 'Thủ công', qr: 'Quét QR', code: 'Nhập mã' }
labels.certificate_status = 'Trạng thái chứng nhận'
statuses.valid = 'Còn hiệu lực'
statuses.revoked = 'Đã thu hồi'

function Value({ value, field }) {
  if (value == null) return <span className="muted">Chưa có</span>
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.length ? <ol className="audit-value-list">{value.map((item, index) => <li key={index}><Value value={item} field={field} /></li>)}</ol> : 'Danh sách rỗng'
  if (typeof value === 'object') {
    const order = ['title', 'starts_at', 'ends_at', 'description']
    return <dl>{Object.entries(value).sort(([a], [b]) => order.indexOf(a) - order.indexOf(b)).map(([key, item]) => <div key={key}><dt>{labels[key] || key}</dt><dd><Value value={item} field={key} /></dd></div>)}</dl>
  }
  if (field.endsWith('_at')) return activityTime(value)
  if (field === 'status' || field === 'method' || field === 'certificate_status') return statuses[value] || String(value)
  return String(value) || 'Trống'
}

export default function AuditDetailPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { data, loading, error, retry } = useApi(`/admin/audit/${id}/`)
  const fields = data ? [...new Set([...Object.keys(data.before || {}), ...Object.keys(data.after || {})])] : []
  return <section className="page-width section interior activity-page audit-detail">
    <Link className="activity-back" to={`/quan-tri/nhat-ky?${params}`}>← Về nhật ký thao tác</Link><h1>Chi tiết thao tác</h1>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><article className="activity-card"><h2>{data.action_label}</h2><p>{activityTime(data.created_at)} (giờ Việt Nam)</p>
      <dl className="audit-meta"><dt>Người thực hiện</dt><dd>{data.actor_name} <Link to={`/quan-tri/nhat-ky?actor=${data.actor}`}>Xem các thao tác của người này</Link></dd>
        {data.subject && <><dt>Tài khoản liên quan</dt><dd>{data.subject_name} <Link to={`/quan-tri/nhat-ky?subject=${data.subject}`}>Xem lịch sử tài khoản</Link></dd></>}
        {data.activity && <><dt>Hoạt động</dt><dd>{data.activity_title} <Link to={`/quan-tri/nhat-ky?activity=${data.activity}`}>Xem lịch sử hoạt động</Link></dd></>}
        <dt>Mã nhật ký</dt><dd>{data.id}</dd><dt>Mã đối tượng</dt><dd>{data.object_id}</dd><dt>Lý do</dt><dd>{data.reason || 'Không có lý do được ghi nhận.'}</dd>
      </dl><p className="muted">Tên người và hoạt động ở phần thông tin chung lấy theo dữ liệu hiện tại. Nhật ký chỉ đọc.</p>
    </article><h2>Dữ liệu trước và sau thao tác</h2>
      {!fields.length ? <p className="activity-empty">Bản ghi này chưa lưu dữ liệu trước–sau. Không thể dựng lại lịch sử từ dữ liệu hiện tại.</p> : <>
        <p className="muted">Hiển thị các trường được ghi nhận tại thời điểm thao tác. Với sửa hoạt động, chỉ hiển thị trường thay đổi.</p>
        <div className="audit-changes">{fields.map(field => <article className="activity-card audit-change" key={field}><h3>{labels[field] || field}</h3>
          <div className="audit-comparison"><section><h4>Trước</h4><Value value={data.before?.[field]} field={field} /></section><section><h4>Sau</h4><Value value={data.after?.[field]} field={field} /></section></div>
        </article>)}</div>
      </>}
    </>}
  </section>
}
