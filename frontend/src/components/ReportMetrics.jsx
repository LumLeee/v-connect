import { Link } from 'react-router-dom'
import { metricLabels } from '../api/reportFormat.js'

export default function ReportMetrics({ metrics, activity }) {
  return <>
    <p>Mỗi người/hoạt động được tính một đơn. Đã tham gia chỉ tính hoạt động Hoàn thành có điểm danh; không bao gồm hoạt động bị hủy.</p>
    <div className="activity-grid">{Object.entries(metricLabels).map(([key, label]) => <article className="activity-card" key={key}>
      <h2>{label}</h2><p className="lead">{metrics[key]}</p>
      <Link to={`/bao-cao/dang-ky?metric=${key}${activity ? `&activity=${activity}` : ''}`}>Xem chi tiết: {label.toLocaleLowerCase('vi-VN')}</Link>
    </article>)}</div>
    <p className="activity-empty">{metrics.feedback.count} phản hồi hợp lệ. Điểm trung bình: {metrics.feedback.average_rating === null ? 'Chưa có đánh giá' : `${metrics.feedback.average_rating}/5`}. Phản hồi bị ẩn không được tính.</p>
  </>
}

export function ReportPagination({ data, page, onPage, busy = false }) {
  if (!data.previous && !data.next) return null
  return <nav className="activity-pagination" aria-label="Phân trang">
    <button className="button secondary" disabled={busy || !data.previous} onClick={() => onPage(page - 1)}>Trang trước</button>
    <span>Trang {page}</span><button className="button secondary" disabled={busy || !data.next} onClick={() => onPage(page + 1)}>Trang sau</button>
  </nav>
}
