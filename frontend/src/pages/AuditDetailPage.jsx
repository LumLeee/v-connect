import { Link, useLocation, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/audit.css'
import '../styles/admin-audit.css'

const labels = { title: 'Tên hoạt động / mốc', description: 'Mô tả', address: 'Địa điểm', starts_at: 'Bắt đầu', ends_at: 'Kết thúc', capacity: 'Sức chứa', status: 'Trạng thái', required_skills: 'Kỹ năng yêu cầu', timeline: 'Chương trình hoạt động', cover: 'Tệp ảnh bìa', is_active: 'Tài khoản hoạt động', attended: 'Có mặt', method: 'Cách điểm danh', is_hidden: 'Đã ẩn', score: 'Điểm đóng góp', minutes: 'Số phút đóng góp (lịch sử cũ)', revision: 'Lần xác nhận', issued_at: 'Thời điểm tạo mã', expires_at: 'Hết hạn mã', revoked_at: 'Thu hồi mã', certificate_status: 'Trạng thái chứng nhận (lịch sử cũ)', source: 'Nguồn duyệt đăng ký', invitation_id: 'Mã lời mời' }
const statuses = { draft: 'Nháp', published: 'Công khai', completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ duyệt', approved: 'Được duyệt', rejected: 'Bị từ chối', manual: 'Thủ công', qr: 'Quét QR', code: 'Nhập mã', valid: 'Còn hiệu lực', revoked: 'Đã thu hồi', accepted: 'Đã chấp nhận', declined: 'Đã từ chối', withdrawn: 'Đã thu hồi' }

function DateValue({ value }) {
  return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{activityTime(value)}</time> : <span>{value || 'Chưa có thời gian'}</span>
}

function Value({ value, field, invitation = false, recorded = true }) {
  if (!recorded) return <span className="muted">Không ghi nhận</span>
  if (value == null) return <span className="muted">Chưa có</span>
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.length ? <ol className="audit-value-list">{value.map((item, index) => <li key={index}><Value value={item} field={field} invitation={invitation} /></li>)}</ol> : 'Danh sách rỗng'
  if (typeof value === 'object') {
    const order = ['title', 'starts_at', 'ends_at', 'description']
    const rank = key => order.includes(key) ? order.indexOf(key) : order.length
    return Object.keys(value).length ? <dl>{Object.entries(value).sort(([a], [b]) => rank(a) - rank(b)).map(([key, item]) => <div key={key}><dt>{labels[key] || key}</dt><dd><Value value={item} field={key} invitation={invitation} /></dd></div>)}</dl> : 'Đối tượng rỗng'
  }
  if (field.endsWith('_at') && typeof value === 'string') return <DateValue value={value} />
  if (field === 'status' && invitation && value === 'pending') return 'Chờ phản hồi'
  if (field === 'source' && value === 'invitation') return 'Chấp nhận lời mời'
  if (field === 'status' || field === 'method' || field === 'certificate_status') return statuses[value] || String(value)
  return String(value) || 'Trống'
}

export default function AuditDetailPage() {
  const { id } = useParams()
  const { search } = useLocation()
  const { data, loading, error, retry } = useApi(`/admin/audit/${id}/`)
  const fields = data ? [...new Set([...Object.keys(data.before || {}), ...Object.keys(data.after || {})])] : []
  const listUrl = `/quan-tri/nhat-ky${search}`
  const relatedUrl = (key, value) => `/quan-tri/nhat-ky?${new URLSearchParams({ [key]: value })}`
  return <section className="page-width section interior activity-page audit-detail ad-audit-detail" aria-labelledby="audit-detail-title">
    <header className="ad-audit-heading"><h1 id="audit-detail-title">Chi tiết thao tác</h1><Link className="button secondary" to={listUrl}>Về nhật ký thao tác</Link></header>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><article className="activity-card ad-audit-summary"><div className="ad-audit-summary-heading"><h2>{data.action_label}</h2><DateValue value={data.created_at} /></div>
      <dl className="audit-meta"><div><dt>Người thực hiện</dt><dd>{data.actor_name || 'Không còn thông tin'}{data.actor && <><code>{data.actor}</code><Link to={relatedUrl('actor', data.actor)}>Xem các thao tác của người này</Link></>}</dd></div>
        {data.subject && <div><dt>Tài khoản liên quan</dt><dd>{data.subject_name || 'Không còn thông tin'}<code>{data.subject}</code><Link to={relatedUrl('subject', data.subject)}>Xem lịch sử tài khoản</Link></dd></div>}
        {data.activity && <div><dt>Hoạt động</dt><dd>{data.activity_title || 'Không còn thông tin'}<code>{data.activity}</code><Link to={relatedUrl('activity', data.activity)}>Xem lịch sử hoạt động</Link></dd></div>}
        <div><dt>Mã nhật ký</dt><dd><code>{data.id}</code></dd></div><div><dt>Mã đối tượng</dt><dd><code>{data.object_id || 'Không ghi nhận'}</code></dd></div>
        <div className="ad-audit-detail-reason"><dt>Lý do</dt><dd>{data.reason || 'Không có lý do được ghi nhận.'}</dd></div>
      </dl><p className="ad-audit-note">Tên người và hoạt động ở phần thông tin chung lấy theo dữ liệu hiện tại. Nhật ký chỉ đọc.</p>
    </article><div className="ad-audit-change-heading"><h2>Dữ liệu trước và sau thao tác</h2>{fields.length > 0 && <span>{fields.length} trường được ghi nhận</span>}</div>
      {!fields.length ? <p className="activity-empty">Bản ghi này chưa lưu dữ liệu trước–sau. Không thể dựng lại lịch sử từ dữ liệu hiện tại.</p> : <>
        <p className="ad-audit-note">Hiển thị dữ liệu được lưu tại thời điểm thao tác. Với sửa hoạt động, chỉ hiển thị trường thay đổi.</p>
        <div className="audit-changes">{fields.map(field => <article className="activity-card audit-change" key={field}><h3>{labels[field] || field}</h3>
          <div className="audit-comparison"><section><h4>Trước</h4><Value recorded={Object.hasOwn(data.before || {}, field)} value={data.before?.[field]} field={field} invitation={data.action?.startsWith('invitation_')} /></section><section><h4>Sau</h4><Value recorded={Object.hasOwn(data.after || {}, field)} value={data.after?.[field]} field={field} invitation={data.action?.startsWith('invitation_')} /></section></div>
        </article>)}</div>
      </>}
    </>}
  </section>
}
