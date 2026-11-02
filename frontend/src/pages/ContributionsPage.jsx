import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import '../styles/activities.css'
import '../styles/contributions.css'

const points = score => `${score} điểm`

function History({ entry, close }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useApi(`/contributions/${entry.id}/history/?page=${page}&page_size=10`)
  return <section className="activity-confirm" aria-label="Lịch sử điều chỉnh đóng góp"><h2>Lịch sử đóng góp · {entry.volunteer_name}</h2><p>{entry.activity.title}</p>
    <button className="button secondary" onClick={close}>Đóng lịch sử</button><RequestState loading={loading} error={error} retry={retry} />
    {data && <>{!data.count && <p>Chưa có lần xác nhận nào.</p>}{data.results.map(change => <article key={change.revision} className="activity-card"><h3>Lần {change.revision} · {change.previous_score === null ? 'Xác nhận lần đầu' : 'Điều chỉnh'}</h3><p>{change.previous_score === null ? 'Chưa xác nhận' : points(change.previous_score)} → {points(change.score)}</p><p>{change.actor_name} · {activityTime(change.created_at)}</p><p>Lý do: {change.reason || 'Xác nhận lần đầu'}</p></article>)}<ReportPagination data={data} page={page} onPage={setPage} /></>}
  </section>
}

function Contributions({ managed = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/contributions/` : '/contributions/'}?page=${page}&page_size=12`)
  const [pending, setPending] = useState(null)
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState(null)
  function refresh() { setPending(null); setHistory(null); retry() }
  function movePage(value) { setPending(null); setHistory(null); setParams({ page: String(value) }) }
  async function save(event) {
    event.preventDefault(); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/contributions/${pending.id}/`, { score: Number(score), revision: pending.contribution?.revision || 0, reason })
      setMessage('Đã lưu điểm đóng góp và lịch sử xác nhận.'); refresh()
    } catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={managed ? `/nha-to-chuc/hoat-dong/${id}` : '/tinh-nguyen-vien'}>← {managed ? 'Về hoạt động' : 'Về tổng quan'}</Link>
    <h1>{managed ? 'Xác nhận đóng góp' : 'Đóng góp của tôi'}</h1>
    <p>Chỉ tính người đã được duyệt, có điểm danh và hoạt động Hoàn thành. Nhà tổ chức chấm điểm nguyên từ 0–10 cho từng người, không tự suy ra từ thời lượng hoạt động.</p>
    <p><Link className="button secondary" to="/bang-xep-hang">Xem bảng xếp hạng và cấp bậc</Link></p>
    {managed && <OrganizerActivityHeader id={id} selected="contributions" />}
    <button className="text-button" disabled={busy} onClick={refresh}>Cập nhật đóng góp</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}{failure && <p role="alert" className="request-error">{failure}</p>}
    {data?.summary && <div className="contribution-summary" aria-label="Tổng hợp đóng góp"><div><span>Tổng điểm đóng góp</span><strong>{points(data.summary.score)}</strong></div><div><span>Hoạt động đã xác nhận</span><strong>{data.summary.confirmed}</strong></div><div><span>Hoạt động chờ xác nhận</span><strong>{data.summary.pending}</strong></div></div>}
    {pending && <ConfirmationDialog title="Xác nhận điểm đóng góp" busy={busy} onClose={() => setPending(null)}><form className="activity-confirm" aria-label="Xác nhận điểm đóng góp" onSubmit={save}>{failure && <p role="alert" className="request-error">{failure}</p>}<h2>{pending.contribution ? 'Điều chỉnh' : 'Xác nhận'} · {pending.volunteer_name}</h2>
      <p>Chấm điểm nguyên từ 0 đến 10. Điểm 0 là đã chấm; chưa chấm được hiển thị riêng.</p>
      <div className="activity-field"><label htmlFor="contribution-score">Điểm đóng góp</label><input id="contribution-score" type="number" min="0" max={pending.activity.max_score} step="1" required disabled={busy} value={score} onChange={event => setScore(event.target.value)} /></div>
      <div className="activity-field"><label htmlFor="contribution-reason">Lý do {pending.contribution ? 'điều chỉnh (bắt buộc)' : 'xác nhận (không bắt buộc)'}</label><textarea id="contribution-reason" rows={3} maxLength={1000} required={Boolean(pending.contribution)} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></div>
      <button className="button primary" disabled={busy || score === '' || (Boolean(pending.contribution) && !reason.trim())}>Lưu đóng góp</button>{' '}<button className="button secondary" type="button" disabled={busy} onClick={() => setPending(null)}>Hủy chỉnh sửa</button>
    </form></ConfirmationDialog>}
    {history && <History key={history.id} entry={history} close={() => setHistory(null)} />}
    {data && <><p>{data.count} lượt tham gia đủ điều kiện.</p>{!data.count && <p className="activity-empty">Chưa có lượt tham gia đủ điều kiện xác nhận đóng góp.</p>}
      <div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}><h2>{managed ? entry.volunteer_name : entry.activity.title}</h2><p>{managed ? entry.activity.title : entry.activity.organizer_name} · {activityTime(entry.activity.starts_at)}</p>
        <p>{entry.contribution ? <>Được công nhận: <strong>{points(entry.contribution.score)}</strong></> : 'Chờ Nhà tổ chức chấm điểm.'}</p>
        {entry.contribution && <p>Người xác nhận: {entry.contribution.confirmed_by_name} · {activityTime(entry.contribution.updated_at)}</p>}
        <div className="activity-actions">{managed && <button className="button primary" disabled={busy} onClick={() => { setPending(entry); setScore(entry.contribution ? String(entry.contribution.score) : ''); setReason(''); setFailure(''); setMessage(''); setHistory(null) }}>{entry.contribution ? 'Điều chỉnh đóng góp' : 'Xác nhận đóng góp'}</button>}
        {entry.contribution && <button className="button secondary" disabled={busy} onClick={() => { setHistory(entry); setPending(null) }}>Xem lịch sử điều chỉnh</button>}</div>
      </article>)}</div><ReportPagination data={data} page={page} busy={busy} onPage={movePage} /></>}
  </section>
}

export default function ContributionsPage({ managed = false }) {
  const { id } = useParams()
  return <Contributions key={id || 'mine'} managed={managed} />
}
