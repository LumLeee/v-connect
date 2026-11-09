import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import ReportAiDraft from '../components/ReportAiDraft.jsx'
import { activityTime } from '../api/activityFormat.js'
import { points } from '../api/documentFormat.js'
import '../styles/documents.css'
import '../styles/admin-summary.css'

const reportTime = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
})

function SummaryTime({ value }) {
  if (!value || Number.isNaN(new Date(value).getTime())) return <span>Chưa có thông tin</span>
  return <time dateTime={value}>
    <span className="summary-screen-time">{activityTime(value)}</span>
    <span className="summary-print-time">{reportTime.format(new Date(value))}</span>
  </time>
}

export default function ActivitySummaryDocumentPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data, loading, error, retry } = useApi(`/reports/activities/${id}/summary-document/`)
  const failure = error?.status === 400 ? { ...error, message: 'Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành và đã kết thúc.' } : error
  const aiDraft = <ReportAiDraft key={id} id={id} sourceData={data} disabled={!data || loading || Boolean(error)} />
  return <section className={`page-width section interior document-page summary-document-page${isAdmin ? ' ad-summary' : ''}`} aria-busy={loading}>
    <div className="no-print">
      <div className={`summary-document-toolbar${isAdmin ? ' ad-summary-toolbar' : ''}`}>
        <h1>Mẫu báo cáo tổng kết</h1>
        <div className="summary-document-actions">
          {isAdmin && <Link className="button secondary" to={`/bao-cao/hoat-dong/${id}`}>Kết quả hoạt động</Link>}
          <button type="button" className="button primary" disabled={!data || loading || Boolean(error)} onClick={() => window.print()}>In / Lưu PDF</button>
          <button type="button" className="button secondary refresh-button" disabled={loading} onClick={retry}>Làm mới</button>
        </div>
      </div>
      {isAdmin ? <div className="ad-summary-guide">
        <p>Bản báo cáo bên dưới lấy số liệu từ hệ thống. Bản nháp AI có thể chỉnh sửa và sao chép riêng sau khi rà soát.</p>
        <a href="#ban-nhap-ai" className="button secondary">Bản nháp AI</a>
      </div> : <p className="summary-print-hint">Để lưu bản đang xem thành PDF, chọn “Lưu dưới dạng PDF” trong hộp thoại in.</p>}
      <RequestState loading={loading} error={failure} retry={retry} />
      {!isAdmin && aiDraft}
    </div>
    {data && <article className="document-sheet summary-sheet">
      <header className="summary-document-heading">
        <div className="document-brand">V-CONNECT · KẾT NỐI TÌNH NGUYỆN</div>
        <h2>BÁO CÁO TỔNG KẾT HOẠT ĐỘNG</h2>
        <h3 className="summary-title">{data.activity.title}</h3>
        <dl className="summary-activity-info">
          <div><dt>Đơn vị tổ chức</dt><dd>{data.activity.organizer_name || 'Chưa có thông tin'}</dd></div>
          <div><dt>Thời gian</dt><dd><SummaryTime value={data.activity.starts_at} /> — <SummaryTime value={data.activity.ends_at} /></dd></div>
          {data.activity.address && <div><dt>Địa điểm</dt><dd>{data.activity.address}</dd></div>}
        </dl>
      </header>

      <section className="summary-document-section" aria-labelledby="summary-content-heading">
        <h3 id="summary-content-heading">1. Nội dung hoạt động</h3>
        <p className="activity-description">{data.activity.description || 'Chưa có mô tả hoạt động.'}</p>
        {!!data.activity.skill_details?.length && <p>Kỹ năng yêu cầu: {data.activity.skill_details.map(item => item.name).join(', ')}.</p>}
      </section>

      <section className="summary-document-section" aria-labelledby="summary-results-heading">
        <h3 id="summary-results-heading">2. Kết quả hoạt động</h3>
        <div className="summary-metrics">
          <section className="summary-metric-group" aria-labelledby="summary-registration-heading">
            <h4 id="summary-registration-heading">Đăng ký tham gia</h4>
            <dl className="summary-metric-list">{[
              ['Tổng đơn đăng ký', data.metrics.registered], ['Được duyệt', data.metrics.approved], ['Chờ duyệt', data.metrics.pending], ['Bị từ chối', data.metrics.rejected], ['Đã hủy', data.metrics.cancelled],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
          <section className="summary-metric-group" aria-labelledby="summary-contributions-heading">
            <h4 id="summary-contributions-heading">Điểm danh và đóng góp</h4>
            <dl className="summary-metric-list">{[
              ['Đã tham gia (được duyệt và có điểm danh)', data.metrics.attended_completed], ['Số người đã xác nhận đóng góp', data.contributions.confirmed], ['Số người chờ xác nhận đóng góp', data.contributions.pending], ['Tổng điểm đóng góp', points(data.contributions.score)],
            ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </section>
          <section className="summary-metric-group" aria-labelledby="summary-feedback-heading">
            <h4 id="summary-feedback-heading">Phản hồi của người tham gia</h4>
            <dl className="summary-metric-list">
              <div><dt>Số phản hồi hợp lệ</dt><dd>{data.metrics.feedback?.count ?? 0}</dd></div>
              <div><dt>Điểm trung bình</dt><dd>{data.metrics.feedback?.average_rating == null ? 'Chưa có đánh giá' : `${data.metrics.feedback.average_rating}/5`}</dd></div>
            </dl>
          </section>
        </div>
        <p className="summary-metric-note">Không tính phản hồi bị ẩn. Điểm đóng góp do Nhà tổ chức chấm theo thang 0–10, độc lập với điểm phản hồi /5; tổng điểm được cộng qua các lượt tham gia.</p>
      </section>

      {!!data.activity.timeline?.length && <section className="summary-document-section" aria-labelledby="summary-program-heading">
        <h3 id="summary-program-heading">3. Chương trình hoạt động</h3>
        <ol className="summary-timeline">{data.activity.timeline.map((item, index) => <li key={index}>
          <strong>{item.title}</strong>
          <p className="summary-timeline-time"><SummaryTime value={item.starts_at} /> — <SummaryTime value={item.ends_at} /></p>
          {item.description && <p className="activity-description">{item.description}</p>}
        </li>)}</ol>
      </section>}

      <footer className="summary-footer">
        {data.prepared_by && <p>Người lập trên hệ thống: {data.prepared_by}</p>}
        <p>Thời điểm lấy số liệu: <SummaryTime value={data.generated_at} /></p>
        <p>Mã hoạt động: {data.activity.id}</p>
      </footer>
    </article>}
    {isAdmin && <div className="no-print ad-summary-ai">{aiDraft}</div>}
  </section>
}
