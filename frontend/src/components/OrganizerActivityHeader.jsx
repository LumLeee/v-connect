import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from './RequestState.jsx'
import { activityStatuses } from '../api/activityFormat.js'

function Summary({ activity, selected, navigationOnly }) {
  const tabsRef = useRef(null)
  useEffect(() => {
    const tabs = tabsRef.current
    const current = tabs?.querySelector('[aria-current="page"]')
    if (!current || !window.matchMedia('(max-width: 700px)').matches) return
    const left = current.getBoundingClientRect().left - tabs.getBoundingClientRect().left + tabs.scrollLeft - (tabs.clientWidth - current.offsetWidth) / 2
    tabs.scrollTo({ left: Math.max(0, left) })
  }, [selected])
  const base = `/nha-to-chuc/hoat-dong/${activity.id}`
  const links = [['detail', base, 'Tổng quan hoạt động'], ['registrations', `${base}/dang-ky`, 'Đăng ký tham gia'],
    ['attendance', `${base}/diem-danh`, 'Bảng điểm danh'], ['feedback', `${base}/phan-hoi`, 'Đánh giá'],
    ['matching', `${base}/ghep-noi`, 'Người phù hợp'], ['invitations', `${base}/loi-moi`, 'Lời mời'], ['contributions', `${base}/dong-gop`, 'Điểm đóng góp'], ['reports', `/bao-cao/hoat-dong/${activity.id}`, 'Báo cáo kết quả']]
  return <div className={`om-activity-context${navigationOnly ? ' om-activity-context--navigation-only' : ''}`}>
    {!navigationOnly && <div className="om-context-main"><div><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><strong>{activity.title}</strong></div>
      <div className="om-capacity"><strong>{activity.approved_count}/{activity.capacity}</strong><span>người được duyệt</span><progress value={activity.approved_count} max={activity.capacity} aria-label="Tỷ lệ người được duyệt" /></div></div>}
    <nav ref={tabsRef} className="om-activity-tabs" aria-label="Quản lý hoạt động đã chọn">{links.map(([key, to, label]) => <Link key={key} to={to} aria-current={selected === key ? 'page' : undefined}>{label}</Link>)}</nav>
  </div>
}

function FetchedSummary({ id, selected, navigationOnly }) {
  const { data, loading, error, retry } = useApi(`/organizer/activities/${id}/`)
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <Summary activity={data} selected={selected} navigationOnly={navigationOnly} />}</>
}

export default function OrganizerActivityHeader({ activity, id, selected, navigationOnly = false }) {
  return activity ? <Summary activity={activity} selected={selected} navigationOnly={navigationOnly} /> : <FetchedSummary key={id} id={id} selected={selected} navigationOnly={navigationOnly} />
}
