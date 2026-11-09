import { Link, useParams } from 'react-router-dom'
import { BarChart3, CalendarDays, CheckCircle2, ClipboardList, RefreshCw } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import useNow from '../hooks/useNow.js'
import RequestState from '../components/RequestState.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { metricLabels } from '../api/reportFormat.js'
import '../styles/activities.css'
import '../styles/admin-activity-result.css'

const number = value => value != null && Number.isFinite(Number(value)) ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value)) : 'Chưa có dữ liệu'
const metricPath = (id, metric) => `/bao-cao/dang-ky?${new URLSearchParams({ metric, activity: id })}`
function DateValue({ value }) { return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{activityTime(value)}</time> : 'Chưa có thông tin' }
function MetricGroup({ id, title, metrics, keys }) { return <section className="ad-result-panel"><h2>{title}</h2><dl>{keys.map(key => <div key={key}><dt><Link to={metricPath(id, key)}>{metricLabels[key]}</Link></dt><dd>{number(metrics[key])}</dd></div>)}</dl></section> }

export default function AdminActivityResultPage() {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`/reports/activities/${id}/`)
  const activity = data?.activity, metrics = data?.metrics, feedback = metrics?.feedback
  const completed = activity?.status === 'completed'
  const now = useNow(completed && !activity?.time_checks_disabled)
  const endTime = Date.parse(activity?.ends_at)
  const summaryAvailable = completed && (activity.time_checks_disabled === true || (Number.isFinite(endTime) && endTime <= now))
  const principal = [['registered', 'Tổng đơn đăng ký', ClipboardList], ['approved', 'Người được duyệt', CheckCircle2], ['attended_completed', 'Đã tham gia hoàn thành', BarChart3]]
  return <section className="page-width section interior activity-page ad-activity-result" aria-labelledby="admin-result-title" aria-busy={loading}>
    <header className="ad-result-heading"><div><h1 id="admin-result-title">Kết quả hoạt động</h1></div><div className="ad-result-heading-actions"><Link className="button secondary" to="/bao-cao/hoat-dong">Danh sách hoạt động</Link><button type="button" className="button secondary" disabled={loading} onClick={retry}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></div></header>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <section className="ad-result-context" aria-label="Thông tin hoạt động"><div className="ad-result-context-title"><span className={`ad-result-status status-${activity.status}`}>{activityStatuses[activity.status] || activity.status}</span><h2>{activity.title}</h2><p>Nhà tổ chức: <strong>{activity.organizer_name || 'Chưa có thông tin'}</strong></p></div>
        <dl><div><dt>Bắt đầu</dt><dd><DateValue value={activity.starts_at} /></dd></div><div><dt>Kết thúc</dt><dd><DateValue value={activity.ends_at} /></dd></div><div><dt>Địa điểm</dt><dd>{activity.address || 'Chưa có thông tin'}</dd></div><div><dt>Số người cần tuyển</dt><dd>{number(activity.capacity)} người</dd></div></dl>
        {activity.status === 'published' && <Link className="button secondary" to={`/hoat-dong/${id}`}>Xem hoạt động</Link>}
      </section>
      {!completed && <p className="ad-result-notice" role="status"><CalendarDays size={18} aria-hidden="true" /><span>Số liệu hiện tại của hoạt động {activityStatuses[activity.status]?.toLocaleLowerCase('vi-VN') || activity.status}. Kết quả tham gia hoàn thành được tính khi hoạt động hoàn thành.</span></p>}
      <div className="ad-result-metrics" aria-label="Chỉ số hoạt động">{principal.map(([key, title, Icon]) => <Link className="ad-result-metric" key={key} to={metricPath(id, key)}><span className="ad-result-metric-icon"><Icon size={21} aria-hidden="true" /></span><div><span>{title}</span><strong>{number(metrics[key])}</strong></div></Link>)}</div>
      <div className="ad-result-groups">
        <MetricGroup id={id} title="Trạng thái đăng ký" metrics={metrics} keys={['pending', 'approved', 'rejected', 'cancelled']} />
        <MetricGroup id={id} title="Kết quả điểm danh" metrics={metrics} keys={['attended_completed', 'attended_ongoing', 'attended_cancelled']} />
        <section className="ad-result-panel ad-result-feedback"><h2>Phản hồi người tham gia</h2>{feedback ? <dl><div><dt>Phản hồi hợp lệ</dt><dd>{number(feedback.count)}</dd></div><div><dt>Điểm trung bình</dt><dd>{feedback.average_rating == null ? 'Chưa có đánh giá' : `${number(feedback.average_rating)}/5`}</dd></div></dl> : <p>Chưa có dữ liệu phản hồi.</p>}<p>Phản hồi bị ẩn không được tính trong số liệu này.</p><Link className="button secondary" to={`/quan-tri/phan-hoi?${new URLSearchParams({ activity: id, status: 'visible' })}`}>Kiểm duyệt phản hồi</Link></section>
        <section className="ad-result-panel ad-result-report"><h2>Báo cáo tổng kết</h2>{summaryAvailable ? <><p>Mở báo cáo từ số liệu hoạt động hoặc soạn bản nháp nhận xét để rà soát trước khi sử dụng.</p><div className="ad-result-report-actions"><Link className="button primary" to={`/bao-cao/hoat-dong/${id}/tong-ket`}>Mẫu báo cáo tổng kết</Link><Link className="button secondary" to={`/bao-cao/hoat-dong/${id}/tong-ket#ban-nhap-ai`}>Soạn bản nháp AI</Link></div></> : <p>Báo cáo tổng kết được mở sau khi hoạt động hoàn thành và đáp ứng điều kiện thời gian kết thúc.</p>}</section>
      </div>
      <details className="ad-result-rules"><summary>Quy tắc tính số liệu</summary><p>Mỗi người/hoạt động tính một đơn theo trạng thái hiện tại. Đã tham gia hoàn thành chỉ tính đơn được duyệt, có điểm danh và hoạt động hoàn thành. Có mặt tại hoạt động công khai hoặc bị hủy được thống kê riêng. Phản hồi hợp lệ loại trừ phản hồi bị ẩn.</p></details>
    </>}
  </section>
}
