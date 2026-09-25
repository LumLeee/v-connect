import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiPost } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import ParticipationPanel from '../components/ParticipationPanel.jsx'

function ActivityDetail({ activity, managed, refresh }) {
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function transition() {
    setBusy(true); setError('')
    try { await apiPost(`/organizer/activities/${activity.id}/status/`, { status: pending }); setPending(null); refresh() }
    catch (failure) { setError(Object.values(failure.details?.error?.details || {}).flat().join(' ') || failure.message) }
    finally { setBusy(false) }
  }
  const editable = ['draft', 'published'].includes(activity.status)
  return <>
    <span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span>
    <h1>{activity.title}</h1>
    <p className="lead">Nhà tổ chức: {activity.organizer_name}</p>
    <dl className="activity-facts"><div><dt>Bắt đầu</dt><dd>{activityTime(activity.starts_at)}</dd></div><div><dt>Kết thúc</dt><dd>{activityTime(activity.ends_at)}</dd></div>
      <div><dt>Địa điểm</dt><dd>{activity.address}</dd></div><div><dt>Sức chứa</dt><dd>{activity.capacity} người</dd></div></dl>
    <p className="muted">Thời gian hiển thị theo giờ Việt Nam (UTC+7).</p>
    <h2>Về hoạt động</h2><p className="activity-description">{activity.description}</p>
    {activity.status === 'cancelled' && <p role="status">Hoạt động này đã bị hủy.</p>}
    <p>Đã được duyệt: {activity.approved_count}/{activity.capacity} người.</p>
    {!managed && <ParticipationPanel activity={activity} refresh={refresh} />}
    {managed && <div className="activity-actions">
      <Link className="button primary" to={`/nha-to-chuc/hoat-dong/${activity.id}/dang-ky`}>Xem danh sách đăng ký</Link>
      <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/diem-danh`}>Điểm danh người tham gia</Link>
      {editable && <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/sua`}>Chỉnh sửa hoạt động</Link>}
      {activity.status === 'draft' && <button className="button primary" onClick={() => { setPending('published'); setError('') }}>Công khai hoạt động</button>}
      {activity.status === 'published' && <button className="button primary" disabled={new Date(activity.ends_at) > new Date()} onClick={() => { setPending('completed'); setError('') }}>Hoàn thành hoạt động</button>}
      {editable && <button className="button secondary" onClick={() => { setPending('cancelled'); setError('') }}>Hủy hoạt động</button>}
    </div>}
    {managed && activity.status === 'published' && <p className="muted">Chỉ có thể hoàn thành sau thời gian kết thúc.</p>}
    {pending && <div className="activity-confirm" role="region" aria-label="Xác nhận chuyển trạng thái">
      <p>Chuyển hoạt động sang “{activityStatuses[pending]}”?{pending !== 'published' && ' Sau đó bạn không thể chỉnh sửa hoạt động.'}</p>
      {error && <p role="alert" className="request-error">{error}</p>}
      <button className="button primary" disabled={busy} onClick={transition}>{busy ? 'Đang cập nhật…' : 'Xác nhận'}</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </div>}
  </>
}

export default function ActivityDetailPage({ managed = false }) {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`${managed ? '/organizer' : ''}/activities/${id}/`)
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={managed ? '/nha-to-chuc/hoat-dong' : '/hoat-dong'}>← Danh sách hoạt động</Link>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <ActivityDetail key={`${id}-${data.status}`} activity={data} managed={managed} refresh={retry} />}
  </section>
}
