import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { apiPost } from '../api/client.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/matching.css'
const errorText = value => typeof value === 'string' ? value : Object.values(value || {}).map(errorText).join(' ')

function InviteButton({ activityId, volunteer }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiPost(`/organizer/activities/${activityId}/invitations/`, { volunteer: volunteer.id, message })
      setSent(true); setOpen(false)
      setError(result.status !== 'pending' ? 'Lời mời này đã được xử lý trước đó; không gửi lại.' : '')
    } catch (failure) { setError(errorText(failure.details?.error?.details) || failure.message) }
    finally { setBusy(false) }
  }
  return <div>{error && <p role="alert">{error}</p>}{sent ? <p role="status">Lời mời đã được ghi nhận. <Link to={`/nha-to-chuc/hoat-dong/${activityId}/loi-moi`}>Xem lời mời đã gửi</Link></p> : open ? <form onSubmit={submit}>
    <label>Lời nhắn (không bắt buộc)<textarea value={message} maxLength={1000} onChange={event => setMessage(event.target.value)} disabled={busy} /></label>
    <p>Lời mời không giữ chỗ. Người nhận chấp nhận đúng hạn và còn chỗ sẽ được tự động duyệt.</p>
    <div className="activity-actions"><button className="button primary" disabled={busy}>Xác nhận gửi lời mời</button><button type="button" className="button secondary" disabled={busy} onClick={() => setOpen(false)}>Quay lại</button></div>
  </form> : <button className="button primary" onClick={() => setOpen(true)}>Gửi lời mời</button>}</div>
}

export default function MatchingPage({ managed = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/matching/` : '/matching/activities/'}?page=${page}&page_size=12`)
  return <section className="page-width section interior activity-page matching-page">
    <Link className="activity-back" to={managed ? `/nha-to-chuc/hoat-dong/${id}` : '/tinh-nguyen-vien'}>← {managed ? 'Về hoạt động' : 'Về tổng quan'}</Link>
    <h1>{managed ? 'Tình nguyện viên phù hợp' : 'Hoạt động phù hợp'}</h1>
    <p>Ghép nối theo kỹ năng, sở thích và lịch rảnh. Bạn tự quyết định tham gia; đăng ký thông thường chờ xét duyệt, chấp nhận lời mời hợp lệ sẽ được tự động duyệt.</p>
    {managed ? <OrganizerActivityHeader id={id} selected="matching" /> : <p><Link className="button secondary" to="/ho-so">Cập nhật hồ sơ ghép nối</Link></p>}
    <button className="text-button" onClick={retry}>Cập nhật gợi ý</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><div className="activity-empty"><p>{data.explanation}</p><p>{data.note}</p></div><p>{data.count} gợi ý có ít nhất một tiêu chí phù hợp.</p>
      {!data.count && <p className="activity-empty">Chưa có gợi ý phù hợp. {managed ? 'Người tham gia cần bật cho phép được gợi ý và có hồ sơ phù hợp. Kiểm tra trạng thái, thời gian và số chỗ còn lại của hoạt động.' : 'Hãy bổ sung hồ sơ hoặc quay lại khi có hoạt động mới. Bạn vẫn có thể tìm và đăng ký hoạt động công khai.'}</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card matching-card" key={managed ? entry.volunteer.id : entry.activity.id}>
        <span className="matching-score">{entry.score}/100 điểm phù hợp</span>
        <h2>{managed ? entry.volunteer.full_name : <Link to={`/hoat-dong/${entry.activity.id}`}>{entry.activity.title}</Link>}</h2>
        {!managed && <p>{activityTime(entry.activity.starts_at)} · {entry.activity.address}</p>}
        <ul>{entry.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
        {!!entry.matched_skills.length && <p>Kỹ năng phù hợp: {entry.matched_skills.join(', ')}.</p>}
        <p className="matching-breakdown">Kỹ năng {entry.components.skills}/50 · Sở thích {entry.components.interests}/20 · Lịch rảnh {entry.components.availability}/30</p>
        {!managed && <Link className="button primary" to={`/hoat-dong/${entry.activity.id}`}>Xem hoạt động để đăng ký</Link>}
        {managed && <InviteButton activityId={id} volunteer={entry.volunteer} />}
      </article>)}</div>
      <ReportPagination data={data} page={page} onPage={value => setParams({ page: String(value) })} />
    </>}
    <p>{managed ? <Link to={`/nha-to-chuc/hoat-dong/${id}/dang-ky`}>Xem và xét duyệt người đã đăng ký →</Link> : <Link to="/hoat-dong">Khám phá tất cả hoạt động công khai →</Link>}</p>
  </section>
}
