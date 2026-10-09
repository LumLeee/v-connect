import { Link } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'

function Summary({ activity, selected }) {
  const base = `/nha-to-chuc/hoat-dong/${activity.id}`
  const links = [['detail', base, 'Tổng quan hoạt động'], ['registrations', `${base}/dang-ky`, 'Đăng ký tham gia'],
    ['attendance', `${base}/diem-danh`, 'Bảng điểm danh'], ['feedback', `${base}/phan-hoi`, 'Đánh giá'],
    ['matching', `${base}/ghep-noi`, 'Người phù hợp'], ['contributions', `${base}/dong-gop`, 'Giờ đóng góp'], ['reports', `/bao-cao/hoat-dong/${activity.id}`, 'Báo cáo kết quả']]
  return <div className="om-activity-context">
    <div className="om-context-main"><div><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><strong>{activity.title}</strong><p>{activityTime(activity.starts_at)} · {activity.address}</p></div>
      <div className="om-capacity"><strong>{activity.approved_count}/{activity.capacity}</strong><span>người được duyệt</span><progress value={activity.approved_count} max={activity.capacity} aria-label="Tỷ lệ người được duyệt" /></div></div>
    <nav className="om-activity-tabs" aria-label="Quản lý hoạt động đã chọn">{links.map(([key, to, label]) => <Link key={key} to={to} aria-current={selected === key ? 'page' : undefined}>{label}</Link>)}</nav>
  </div>
}

function FetchedSummary({ id, selected }) {
  const { data, loading, error, retry } = useApi(`/organizer/activities/${id}/`)
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <Summary activity={data} selected={selected} />}</>
}

export default function OrganizerActivityHeader({ activity, id, selected }) {
  return activity ? <Summary activity={activity} selected={selected} /> : <FetchedSummary key={id} id={id} selected={selected} />
}
