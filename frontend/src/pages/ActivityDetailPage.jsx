import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { apiPost } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import ParticipationPanel from '../components/ParticipationPanel.jsx'
import ActivityVisual from '../components/ActivityVisual.jsx'
import { CalendarDays, MapPin, Users, UserRound } from 'lucide-react'
import '../styles/activities.css'
import ActivityCoverEditor from '../components/ActivityCoverEditor.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'

function RequiredSkills({ activity }) {
  return activity.skill_details?.length ? <section className="activity-required-skills"><h2>Kỹ năng yêu cầu</h2><div className="activity-skill-tags">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div><p className="muted">Nhà tổ chức xét duyệt từng đơn; kỹ năng không tự động giới hạn quyền đăng ký.</p></section> : null
}

function PublicActivityDetail({ activity, refresh }) {
  return <>
    <div className="activity-detail-heading"><h1>{activity.title}</h1><p>{activity.organizer_name} · {activityTime(activity.starts_at)} (giờ Việt Nam)</p></div>
    <div className="activity-detail-layout">
      <div className="activity-main-column">
        <ActivityVisual id={activity.id} coverUrl={activity.cover_url} large />
        <section className="activity-info-card"><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span>
          <div className="activity-organizer-block"><span><UserRound size={22} aria-hidden="true" /></span><div><small>NHÀ TỔ CHỨC</small><p>{activity.organizer_name}</p></div></div>
          <RequiredSkills activity={activity} />
          <h2>Về hoạt động</h2><p className="activity-description">{activity.description}</p>
          {activity.status === 'cancelled' && <p className="activity-empty" role="status">Hoạt động này đã bị hủy.</p>}
        </section>
      </div>
      <aside className="activity-side-column" aria-label="Thông tin và đăng ký tham gia">
        <section className="activity-logistics"><h2>Thông tin tham gia</h2>
          <div className="activity-logistic-item"><CalendarDays size={20} aria-hidden="true" /><div><h3>Thời gian</h3><dl><dt>Bắt đầu</dt><dd>{activityTime(activity.starts_at)}</dd><dt>Kết thúc</dt><dd>{activityTime(activity.ends_at)}</dd></dl><p>Giờ Việt Nam (UTC+7)</p></div></div>
          <div className="activity-logistic-item"><MapPin size={20} aria-hidden="true" /><div><h3>Địa điểm</h3><p>{activity.address}</p></div></div>
          <div className="activity-logistic-item"><Users size={20} aria-hidden="true" /><div><h3>Người tham gia</h3><p>Đã được duyệt: {activity.approved_count}/{activity.capacity} người.</p><p>Sức chứa: {activity.capacity} người</p></div></div>
        </section>
        <ParticipationPanel activity={activity} refresh={refresh} />
      </aside>
    </div>
  </>
}

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
  if (!managed) return <PublicActivityDetail activity={activity} refresh={refresh} />
  return <>
    <h1>{activity.title}</h1>
    <p className="lead">Nhà tổ chức: {activity.organizer_name}</p>
    <OrganizerActivityHeader activity={activity} selected="detail" />
    <div className="om-detail-body">
    <ActivityCoverEditor activity={activity} refresh={refresh} />
    <RequiredSkills activity={activity} />
    <dl className="activity-facts"><div><dt>Bắt đầu</dt><dd>{activityTime(activity.starts_at)}</dd></div><div><dt>Kết thúc</dt><dd>{activityTime(activity.ends_at)}</dd></div>
      <div><dt>Địa điểm</dt><dd>{activity.address}</dd></div><div><dt>Sức chứa</dt><dd>{activity.capacity} người</dd></div></dl>
    <p className="muted">Thời gian hiển thị theo giờ Việt Nam (UTC+7).</p>
    <h2>Về hoạt động</h2><p className="activity-description">{activity.description}</p>
    {activity.status === 'cancelled' && <p role="status">Hoạt động này đã bị hủy.</p>}
    <p>Đã được duyệt: {activity.approved_count}/{activity.capacity} người.</p>
    </div>
    {!managed && <ParticipationPanel activity={activity} refresh={refresh} />}
    {managed && <div className="activity-actions">
      <Link className="button primary" to={`/nha-to-chuc/hoat-dong/${activity.id}/dang-ky`}>Xem danh sách đăng ký</Link>
      <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/diem-danh`}>Điểm danh người tham gia</Link>
      <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/phan-hoi`}>Xem phản hồi hoạt động</Link>
      {activity.status === 'completed' && <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/dong-gop`}>Xác nhận giờ đóng góp</Link>}
      <Link className="button secondary" to={`/bao-cao/hoat-dong/${activity.id}`}>Xem kết quả hoạt động</Link>
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
  return <section className={`page-width section interior activity-page${managed ? '' : ' activity-public-detail'}`}>
    <Link className="activity-back" to={managed ? '/nha-to-chuc/hoat-dong' : '/hoat-dong'}>← Danh sách hoạt động</Link>
    {!managed && error?.status === 404 ? <p className="activity-empty" role="alert">Hoạt động không tồn tại hoặc không còn công khai.</p> : <RequestState loading={loading} error={error} retry={retry} />}
    {data && <ActivityDetail key={`${id}-${data.status}`} activity={data} managed={managed} refresh={retry} />}
  </section>
}
