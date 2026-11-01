import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import '../styles/activities.css'

const statuses = { pending: 'Chờ phản hồi', accepted: 'Đã chấp nhận', declined: 'Đã từ chối', withdrawn: 'Đã thu hồi' }
const errorText = value => typeof value === 'string' ? value : Object.values(value || {}).map(errorText).join(' ')

export default function InvitationsPage({ managed = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const base = managed ? `/organizer/activities/${id}/invitations/` : '/invitations/'
  const { data, loading, error, retry } = useApi(`${base}?page=${page}&page_size=12`)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  async function submit() {
    const { item, action } = confirmation
    setBusy(true); setProblem(''); setSuccess('')
    try {
      await apiPost(managed ? `${base}${item.id}/withdraw/` : `/invitations/${item.id}/respond/`, managed ? {} : { status: action })
      setSuccess(action === 'accepted' ? 'Đã xác nhận tham gia. Đăng ký của bạn đã được tự động duyệt.' : action === 'declined' ? 'Đã từ chối lời mời.' : 'Đã thu hồi lời mời.')
      setConfirmation(null)
      retry()
      window.dispatchEvent(new Event('notifications:changed'))
    } catch (failure) { setProblem(errorText(failure.details?.error?.details) || failure.message); retry() }
    finally { setBusy(false) }
  }

  return <section className="page-width section interior activity-page">
    <h1>{managed ? 'Lời mời tham gia hoạt động' : 'Lời mời của tôi'}</h1>
    <p>Lời mời không giữ chỗ. Chấp nhận trước giờ bắt đầu và khi còn chỗ sẽ tạo đăng ký Đã duyệt, không cần chờ xét duyệt.</p>
    {managed && <><OrganizerActivityHeader id={id} selected="invitations" /><p><Link className="button primary" to={`/nha-to-chuc/hoat-dong/${id}/ghep-noi`}>Tìm người phù hợp để gửi lời mời</Link></p></>}
    <button className="text-button" onClick={retry} disabled={busy}>Cập nhật lời mời</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {problem && <p role="alert" className="request-error">{problem}</p>}
    {success && <p role="status">{success}</p>}
    {confirmation && <div className="activity-empty" role="region" aria-label="Xác nhận xử lý lời mời">
      <h2>{confirmation.action === 'accepted' ? 'Xác nhận tham gia hoạt động?' : confirmation.action === 'declined' ? 'Từ chối lời mời này?' : 'Thu hồi lời mời này?'}</h2>
      <p>{confirmation.item.activity.title}</p>
      <p>{activityTime(confirmation.item.activity.starts_at)} – {activityTime(confirmation.item.activity.ends_at)} · {confirmation.item.activity.address}</p>
      <p>{confirmation.action === 'accepted' ? 'Bạn đồng ý tham gia theo thời gian, địa điểm hiện tại ở trên. Hệ thống sẽ kiểm tra số chỗ và tự động duyệt đăng ký.' : 'Phản hồi đã xác nhận không thể đổi; Nhà tổ chức không gửi lại cùng lời mời.'}</p>
      <div className="activity-actions"><button className="button primary" disabled={busy} onClick={submit}>Xác nhận {confirmation.action === 'accepted' ? 'tham gia' : confirmation.action === 'declined' ? 'từ chối' : 'thu hồi'}</button><button className="button secondary" disabled={busy} onClick={() => { setConfirmation(null); setProblem('') }}>Quay lại</button></div>
    </div>}
    {data && <><p>{data.count} lời mời.</p>{!data.count && <p className="activity-empty">Chưa có lời mời.</p>}
      <div className="activity-grid">{data.results.map(item => <article className="activity-card" key={item.id}>
        <span className={`activity-status status-${item.status}`}>{statuses[item.status]}</span>
        <h2>{item.activity.title}</h2>
        <p>{managed ? `Người nhận: ${item.volunteer_name}` : `Nhà tổ chức: ${item.organizer_name}`}</p>
        <p>{activityTime(item.activity.starts_at)} – {activityTime(item.activity.ends_at)}</p><p>{item.activity.address}</p>
        <p>Gửi lúc {activityTime(item.created_at)}</p>
        {item.message && <p className="activity-description">Lời nhắn: {item.message}</p>}
        {item.activity_changed && <p role="note">Thời gian hoặc địa điểm đã thay đổi sau khi gửi lời mời. Thông tin trên là lịch hiện tại.</p>}
        {item.unavailable_reason && <p>{item.unavailable_reason}</p>}
        {item.activity.status === 'published' && <p><Link to={managed ? `/nha-to-chuc/hoat-dong/${id}` : `/hoat-dong/${item.activity.id}`}>Xem hoạt động</Link></p>}
        {item.status === 'accepted' && !managed && <p><Link to="/tinh-nguyen-vien/dang-ky">Xem trạng thái đăng ký hiện tại</Link></p>}
        {item.status === 'pending' && <div className="activity-actions">
          {!managed && <button className="button primary" disabled={busy || !!item.unavailable_reason} onClick={() => { setProblem(''); setConfirmation({ item, action: 'accepted' }) }}>Chấp nhận lời mời</button>}
          <button className="button secondary" disabled={busy} onClick={() => { setProblem(''); setConfirmation({ item, action: managed ? 'withdrawn' : 'declined' }) }}>{managed ? 'Thu hồi lời mời' : 'Từ chối lời mời'}</button>
        </div>}
      </article>)}</div><ReportPagination data={data} page={page} onPage={value => { setConfirmation(null); setParams({ page: String(value) }) }} />
    </>}
  </section>
}
