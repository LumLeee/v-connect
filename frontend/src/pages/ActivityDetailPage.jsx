import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
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
import ActivityTimeline from '../components/ActivityTimeline.jsx'
import '../styles/organizer-activity-detail.css'
import '../styles/volunteer-activity-detail.css'

function RequiredSkills({ activity }) {
  return activity.skill_details?.length ? <section className="activity-required-skills"><h2>Kỹ năng yêu cầu</h2><div className="activity-skill-tags">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div><p className="muted">Nhà tổ chức xét duyệt từng đơn; kỹ năng không tự động giới hạn quyền đăng ký.</p></section> : null
}

export function PublicActivityDetail({ activity, refresh, preview = false }) {
  const remaining = Math.max(0, activity.capacity - activity.approved_count)
  return <div className={`va-detail${preview ? ' va-detail-preview' : ''}`}>
    <header className="activity-detail-heading va-detail-heading">
      <span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span>
      <h1>{activity.title}</h1>
      <p><UserRound size={17} aria-hidden="true" />{activity.organizer_name}</p>
    </header>
    <div className="activity-detail-layout va-detail-layout">
      <div className="va-detail-cover"><ActivityVisual id={activity.id} coverUrl={activity.cover_url} large /></div>
      <aside className="activity-side-column va-detail-side" aria-label="Thông tin và đăng ký tham gia">
        {!preview && <ParticipationPanel activity={activity} refresh={refresh} />}
        <section className="activity-logistics"><h2>Thông tin tham gia</h2>
          <div className="activity-logistic-item"><CalendarDays size={20} aria-hidden="true" /><div><h3>Thời gian</h3><dl><dt>Bắt đầu</dt><dd><time dateTime={activity.starts_at}>{activityTime(activity.starts_at)}</time></dd><dt>Kết thúc</dt><dd><time dateTime={activity.ends_at}>{activityTime(activity.ends_at)}</time></dd></dl></div></div>
          <div className="activity-logistic-item"><MapPin size={20} aria-hidden="true" /><div><h3>Địa điểm</h3><p>{activity.address}</p></div></div>
          <div className="activity-logistic-item"><Users size={20} aria-hidden="true" /><div><h3>Người tham gia</h3><dl className="va-detail-capacity">
            <div><dt>Đã duyệt</dt><dd>{activity.approved_count} người</dd></div>
            <div><dt>Cần tuyển</dt><dd>{activity.capacity} người</dd></div>
            <div><dt>Còn lại</dt><dd>{remaining} chỗ</dd></div>
          </dl></div></div>
        </section>
      </aside>
      <section className="activity-info-card va-detail-content">
        {activity.skill_details?.length > 0 && <section className="activity-required-skills"><h2>Kỹ năng yêu cầu</h2><div className="activity-skill-tags">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div><p className="muted">Nhà tổ chức xét duyệt từng đơn; kỹ năng không tự động giới hạn quyền đăng ký.</p></section>}
        <h2>Về hoạt động</h2><p className="activity-description">{activity.description}</p>
        <ActivityTimeline items={activity.timeline} />
        {activity.status === 'cancelled' && <p className="activity-empty" role="status">Hoạt động này đã bị hủy.</p>}
      </section>
    </div>
  </div>
}

function ActivityDetail({ activity, managed, refresh }) {
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function transition() {
    setBusy(true); setError('')
    try { await apiPost(`/organizer/activities/${activity.id}/status/`, { status: pending }); setPending(null); refresh() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  const editable = ['draft', 'published'].includes(activity.status)
  const completionBlocked = !activity.time_checks_disabled && new Date(activity.ends_at) > new Date()
  if (!managed) return <PublicActivityDetail activity={activity} refresh={refresh} />
  return <>
    <section className="om-detail-overview" aria-label="Tổng quan hoạt động">
      <div className="om-detail-heading">
        <div className="om-detail-title"><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><h1>{activity.title}</h1></div>
        {editable && <div className="om-detail-actions" aria-label="Thao tác quản lý hoạt động">
          <div className="om-detail-main-actions">
            <Link className="button secondary" to={`/nha-to-chuc/hoat-dong/${activity.id}/sua`}>Chỉnh sửa hoạt động</Link>
            {activity.status === 'draft' && <button className="button primary" onClick={() => { setPending('published'); setError('') }}>Công khai hoạt động</button>}
            {activity.status === 'published' && <button className="button primary" disabled={completionBlocked} aria-describedby={completionBlocked ? 'completion-hint' : undefined} onClick={() => { setPending('completed'); setError('') }}>Hoàn thành hoạt động</button>}
          </div>
          <div className="om-detail-cancel"><button className="button secondary" onClick={() => { setPending('cancelled'); setError('') }}>Hủy hoạt động</button></div>
        </div>}
      </div>
      {activity.status === 'published' && completionBlocked && <p id="completion-hint" className="om-detail-hint">Chỉ có thể hoàn thành sau thời gian kết thúc.</p>}
      <dl className="om-detail-facts">
        <div><dt><CalendarDays size={17} aria-hidden="true" />Bắt đầu</dt><dd>{activityTime(activity.starts_at)}</dd></div>
        <div><dt><CalendarDays size={17} aria-hidden="true" />Kết thúc</dt><dd>{activityTime(activity.ends_at)}</dd></div>
        <div><dt><MapPin size={17} aria-hidden="true" />Địa điểm</dt><dd>{activity.address}</dd></div>
        <div><dt><Users size={17} aria-hidden="true" />Người tham gia</dt><dd>Đã duyệt: {activity.approved_count} người<span>Cần tuyển: {activity.capacity} người</span></dd></div>
      </dl>
    </section>
    <OrganizerActivityHeader activity={activity} selected="detail" navigationOnly />
    <div className="om-detail-body">
    <ActivityCoverEditor activity={activity} refresh={refresh} />
    <RequiredSkills activity={activity} />
    <h2>Về hoạt động</h2><p className="activity-description">{activity.description}</p>
    <ActivityTimeline items={activity.timeline} />
    </div>
    {activity.time_checks_disabled && <p className="activity-empty" role="note">Đang thử nghiệm: các giới hạn thời gian hoạt động đang tạm tắt.</p>}
    {pending && <ConfirmationDialog title="Xác nhận chuyển trạng thái" busy={busy} onClose={() => setPending(null)}><div className="activity-confirm" aria-label="Xác nhận chuyển trạng thái">
      <p>Chuyển hoạt động sang “{activityStatuses[pending]}”?{pending !== 'published' && ' Sau đó bạn không thể chỉnh sửa hoạt động.'}</p>
      {error && <p role="alert" className="request-error">{error}</p>}
      <button className="button primary" disabled={busy} onClick={transition}>{busy ? 'Đang cập nhật…' : 'Xác nhận'}</button>{' '}
      <button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button>
    </div></ConfirmationDialog>}
  </>
}

export default function ActivityDetailPage({ managed = false }) {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`${managed ? '/organizer' : ''}/activities/${id}/`)
  return <section className={`page-width section interior activity-page${managed ? '' : ' activity-public-detail'}`}>

    {!managed && error?.status === 404 ? <p className="activity-empty" role="alert">Hoạt động không tồn tại hoặc không còn công khai.</p> : <RequestState loading={loading} error={error} retry={retry} />}
    {data && <ActivityDetail key={`${id}-${data.status}`} activity={data} managed={managed} refresh={retry} />}
  </section>
}
