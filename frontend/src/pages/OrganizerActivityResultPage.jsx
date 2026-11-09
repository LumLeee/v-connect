import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import ActionRow from '../components/ActionRow.jsx'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { metricLabels } from '../api/reportFormat.js'
import { points } from '../api/documentFormat.js'
import '../styles/activities.css'
import '../styles/analytics.css'
import '../styles/organizer-activity-result.css'
import '../styles/local-ai.css'

const format = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
const metricPath = (id, metric) => `/bao-cao/dang-ky?${new URLSearchParams({ metric, activity: id })}`

function MetricGroup({ id, title, keys, metrics }) {
  return <section className="organizer-result-panel"><h2>{title}</h2><dl>{keys.map(key => <div key={key}><dt><Link to={metricPath(id, key)}>{metricLabels[key]}</Link></dt><dd>{format(metrics[key])}</dd></div>)}</dl></section>
}

export default function OrganizerActivityResultPage() {
  const { id } = useParams()
  const result = useApi(`/reports/activities/${id}/`)
  const completed = result.data?.activity.status === 'completed'
  const contributions = useApi(completed ? `/organizer/activities/${id}/contributions/?page_size=1&status=all` : null)
  const data = result.data
  function refresh() { result.retry(); contributions.retry() }
  return <section className="page-width section interior activity-page organizer-result-page">
    <div className="om-page-heading om-management-heading"><div><h1>Kết quả hoạt động</h1></div><div className="om-management-actions">
      <Link className="button secondary" to="/bao-cao">Báo cáo tổng hợp</Link>
      {completed && <Link className="button primary" to={`/bao-cao/hoat-dong/${id}/tong-ket`}>Mẫu báo cáo tổng kết</Link>}
      <button className="button secondary refresh-button" disabled={result.loading || contributions.loading} onClick={refresh}>Làm mới</button>
    </div></div>
    <RequestState loading={result.loading} error={result.error} retry={result.retry} />
    {data && <>
      <OrganizerActivityHeader activity={data.activity} selected="reports" />
      {!completed && <p className="activity-empty" role="status">Đây là số liệu hiện tại. Hoạt động chưa hoàn thành hoặc đã bị hủy.</p>}
      <div className="analytics-summary organizer-result-summary" aria-label="Chỉ số chính">{['registered', 'approved', 'attended_completed'].map(key => <ActionRow key={key} className="organizer-result-metric">
        <h2><Link to={metricPath(id, key)}>{metricLabels[key]}</Link></h2><strong className="lead">{format(data.metrics[key])}</strong>
      </ActionRow>)}<ActionRow className="organizer-result-metric"><h2><Link to={`/nha-to-chuc/hoat-dong/${id}/phan-hoi`}>Phản hồi hợp lệ</Link></h2><strong className="lead">{format(data.metrics.feedback.count)}</strong></ActionRow></div>
      <div className="organizer-result-groups">
        <MetricGroup id={id} title="Trạng thái đăng ký" metrics={data.metrics} keys={['pending', 'approved', 'rejected', 'cancelled']} />
        <MetricGroup id={id} title="Kết quả điểm danh" metrics={data.metrics} keys={['attended_completed', 'attended_ongoing', 'attended_cancelled']} />
        <section className="organizer-result-panel"><h2>Điểm đóng góp</h2>
          {completed ? <><RequestState loading={contributions.loading} error={contributions.error} retry={contributions.retry} />{contributions.data && <dl>
            <div><dt>Tổng điểm đóng góp</dt><dd>{points(format(contributions.data.summary.score))}</dd></div>
            <div><dt>Đã chấm điểm</dt><dd>{format(contributions.data.summary.confirmed)}</dd></div>
            <div><dt>Chưa chấm điểm</dt><dd>{format(contributions.data.summary.pending)}</dd></div>
          </dl>}</> : <p>Điểm đóng góp được tổng hợp sau khi hoạt động hoàn thành.</p>}
          <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${id}/dong-gop`}>Quản lý đóng góp</Link>
        </section>
        <section className="organizer-result-panel"><h2>Phản hồi người tham gia</h2><dl>
          <div><dt>Phản hồi hợp lệ</dt><dd>{format(data.metrics.feedback.count)}</dd></div>
          <div><dt>Điểm trung bình</dt><dd>{data.metrics.feedback.average_rating == null ? 'Chưa có đánh giá' : `${format(data.metrics.feedback.average_rating)}/5`}</dd></div>
        </dl><Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${id}/phan-hoi`}>Xem phản hồi hoạt động</Link></section>
      </div>
      {completed && <section className="local-ai-panel"><div className="local-ai-heading"><div><h2>Soạn nhận xét tổng kết</h2><p>Dùng AI trên backend để chọn chủ đề phản hồi và soạn bản nháp từ số liệu thực tế, sau đó tự rà soát và chỉnh sửa.</p></div><Link className="button secondary" to={`/bao-cao/hoat-dong/${id}/tong-ket#ban-nhap-ai`}>Soạn bản nháp AI</Link></div></section>}
      <details className="organizer-report-rules"><summary>Quy tắc tính số liệu</summary><p>Mỗi người/hoạt động tính một đơn theo trạng thái hiện tại. Đã tham gia chỉ tính đăng ký được duyệt, có điểm danh tại hoạt động Hoàn thành và đáp ứng điều kiện thời gian đang áp dụng. Phản hồi bị ẩn không được tính. Điểm đóng góp theo thang 0–10, độc lập với đánh giá /5.</p></details>
    </>}
  </section>
}
