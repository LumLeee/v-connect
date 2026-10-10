import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import { duration } from '../api/documentFormat.js'
import '../styles/documents.css'

export default function ActivitySummaryDocumentPage() {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`/reports/activities/${id}/summary-document/`)
  const failure = error?.status === 400 ? { ...error, message: 'Báo cáo tổng kết chỉ lập cho hoạt động Hoàn thành và đã kết thúc.' } : error
  return <section className="page-width section interior document-page summary-document-page">
    <div className="no-print"><Link className="activity-back" to={`/bao-cao/hoat-dong/${id}`}>← Về kết quả hoạt động</Link><h1>Mẫu báo cáo tổng kết</h1>
      <p>Bản in sử dụng số liệu đang xem. Để lưu PDF, chọn “Lưu dưới dạng PDF” trong hộp thoại in.</p><div className="activity-actions"><button className="button primary" disabled={!data || loading || Boolean(error)} onClick={() => window.print()}>In / Lưu PDF</button><button className="button secondary" onClick={retry}>Cập nhật số liệu</button></div><RequestState loading={loading} error={failure} retry={retry} />
    </div>
    {data && <article className="document-sheet summary-sheet"><div className="document-brand">V-CONNECT · KẾT NỐI TÌNH NGUYỆN</div><h2>BÁO CÁO TỔNG KẾT HOẠT ĐỘNG</h2><h3 className="summary-title">{data.activity.title}</h3>
      <p>Đơn vị tổ chức: <strong>{data.activity.organizer_name}</strong></p><p>Thời gian: {activityTime(data.activity.starts_at)} — {activityTime(data.activity.ends_at)} (giờ Việt Nam)</p><p>Địa điểm: {data.activity.address}</p>
      <h3>1. Nội dung hoạt động</h3><p className="activity-description">{data.activity.description}</p>
      {!!data.activity.skill_details.length && <p>Kỹ năng yêu cầu: {data.activity.skill_details.map(item => item.name).join(', ')}.</p>}
      <h3>2. Kết quả tham gia và đóng góp</h3><dl className="summary-metrics">{[
        ['Tổng đơn đăng ký', data.metrics.registered], ['Được duyệt', data.metrics.approved], ['Chờ duyệt', data.metrics.pending], ['Bị từ chối', data.metrics.rejected], ['Đã hủy', data.metrics.cancelled],
        ['Đã tham gia (được duyệt và có điểm danh)', data.metrics.attended_completed], ['Số người đã xác nhận đóng góp', data.contributions.confirmed], ['Số người chờ xác nhận đóng góp', data.contributions.pending],
        ['Tổng thời gian được công nhận', duration(data.contributions.minutes)], ['Chứng nhận đang hiệu lực', data.certificates],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <h3>3. Phản hồi của người tham gia</h3><p>Số phản hồi hợp lệ: {data.metrics.feedback.count}. Điểm trung bình: {data.metrics.feedback.average_rating == null ? 'Chưa có đánh giá' : `${data.metrics.feedback.average_rating}/5`}.</p><p className="muted">Không tính phản hồi bị ẩn. Giờ đóng góp lấy từ xác nhận của Nhà tổ chức; không suy ra từ giờ điểm danh.</p>
      {!!data.activity.timeline.length && <><h3>4. Chương trình hoạt động</h3><ol className="summary-timeline">{data.activity.timeline.map((item, index) => <li key={index}><strong>{item.title}</strong><p>{activityTime(item.starts_at)} — {activityTime(item.ends_at)}</p>{item.description && <p className="activity-description">{item.description}</p>}</li>)}</ol></>}
      <div className="summary-footer"><p>Người lập trên hệ thống: {data.prepared_by}</p><p>Thời điểm lấy số liệu: {activityTime(data.generated_at)} (giờ Việt Nam)</p><p>Mã hoạt động: {data.activity.id}</p></div>
    </article>}
  </section>
}
