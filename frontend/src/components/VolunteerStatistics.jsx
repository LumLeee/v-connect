import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'
import { Link } from 'react-router-dom'
import { metricLabels } from '../api/reportFormat.js'

export default function VolunteerStatistics() {
  const { data, loading, error, retry } = useApi('/reports/overview/')
  return <details className="mc-statistics" aria-label="Thống kê tham gia">
    <summary>Thống kê tham gia</summary>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="mc-stat-grid">{['registered', 'approved', 'pending', 'attended_completed'].map(key => <Link key={key} to={`/bao-cao/dang-ky?metric=${key}`}><span>{metricLabels[key]}</span><strong>{data.metrics[key]}</strong></Link>)}</div>
      <div className="mc-more-statistics">
        <div className="mc-stat-grid">{['rejected', 'cancelled', 'attended_ongoing', 'attended_cancelled'].map(key => <Link key={key} to={`/bao-cao/dang-ky?metric=${key}`}><span>{metricLabels[key]}</span><strong>{data.metrics[key]}</strong></Link>)}</div>
        <p>{data.metrics.feedback.count} phản hồi hợp lệ · {data.metrics.feedback.average_rating === null ? 'Chưa có điểm đánh giá' : `Điểm đánh giá trung bình: ${data.metrics.feedback.average_rating}/5`}</p>
      </div>
    </>}
  </details>
}
