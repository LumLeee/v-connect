import ActionRow from '../components/ActionRow.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ConfirmationDialog from '../components/ConfirmationDialog.jsx'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import MyContributions from '../components/MyContributions.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import '../styles/activities.css'
import '../styles/contributions.css'
import '../styles/organizer-operations.css'

const points = score => `${score} điểm`
const statuses = [['pending', 'Chưa chấm'], ['confirmed', 'Đã chấm'], ['all', 'Tất cả']]

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
  const status = statuses.some(([value]) => value === params.get('status')) ? params.get('status') : managed ? 'pending' : 'all'
  const search = params.get('search')?.trim() || ''
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  query.set('status', status); query.set('search', search)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/contributions/` : '/contributions/'}?${query}`)
  const [pending, setPending] = useState(null)
  const [score, setScore] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  const [history, setHistory] = useState(null)
  const [statisticsVersion, setStatisticsVersion] = useState(0)
  function updateParams(values) {
    setPending(null); setHistory(null)
    setParams(previous => {
      const next = new URLSearchParams(previous)
      Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
      return next
    })
  }
  function refresh() { setPending(null); setHistory(null); setStatisticsVersion(value => value + 1); retry() }
  function movePage(value) { updateParams({ page: String(value) }) }
  async function save(event) {
    event.preventDefault(); setBusy(true); setFailure(''); setMessage('')
    try {
      await apiPost(`/organizer/activities/${id}/contributions/${pending.id}/`, { score: Number(score), revision: pending.contribution?.revision || 0, reason })
      setMessage('Đã lưu điểm đóng góp và lịch sử xác nhận.')
      movePage(1); refresh()
    } catch (problem) { setFailure(problem.message) }
    finally { setBusy(false) }
  }
  if (!managed) return <MyContributions data={data} loading={loading} error={error} refresh={refresh} page={page} movePage={movePage}
    status={status} search={search} updateParams={updateParams} statisticsVersion={statisticsVersion} onHistory={setHistory}
    historyPanel={history && <ConfirmationDialog title="Lịch sử điều chỉnh đóng góp" onClose={() => setHistory(null)}><History key={history.id} entry={history} close={() => setHistory(null)} /></ConfirmationDialog>} />
  return <section className="page-width section interior activity-page organizer-operations">
    <h1>Xác nhận đóng góp</h1>
    <OrganizerActivityHeader key={statisticsVersion} id={id} selected="contributions" />
    <div className="list-results-toolbar">
      {data?.summary && <div className="operation-totals" aria-label="Tổng hợp đóng góp"><span>{data.summary.total} người đủ điều kiện</span><span>{data.summary.pending} người chưa chấm</span><span>{data.summary.confirmed} người đã chấm</span><span>{data.summary.score} điểm được công nhận</span></div>}
      <button type="button" className="button secondary refresh-button" disabled={busy || loading} onClick={refresh}>Làm mới</button>
    </div>
    <div className="operation-toolbar">
      <div className="operation-filters" role="group" aria-label="Lọc trạng thái đóng góp">{statuses.map(([value, label]) => <button type="button" key={value} className={`button secondary${status === value ? ' is-selected' : ''}`} aria-pressed={status === value} disabled={busy} onClick={() => updateParams({ status: value, page: '1' })}>{label}</button>)}</div>
      <form className="operation-search" onSubmit={event => { event.preventDefault(); updateParams({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
        <label htmlFor="contribution-search">Tìm người tham gia</label><div><input key={search} id="contribution-search" name="search" type="search" maxLength={200} defaultValue={search} placeholder="Tên hoặc email" disabled={busy} /><button className="button secondary" disabled={busy}>Tìm kiếm</button></div>
      </form>
    </div>
    <RequestState loading={loading} error={error} retry={retry} />
    {message && <p role="status">{message}</p>}{failure && !pending && <p role="alert" className="request-error">{failure}</p>}
    {pending && <ConfirmationDialog title="Xác nhận điểm đóng góp" busy={busy} onClose={() => setPending(null)}><form className="activity-confirm" aria-label="Xác nhận điểm đóng góp" onSubmit={save}>{failure && <p role="alert" className="request-error">{failure}</p>}<h2>{pending.contribution ? 'Điều chỉnh' : 'Xác nhận'} · {pending.volunteer_name}</h2>
      <p>Chấm điểm nguyên từ 0 đến 10. Điểm 0 là đã chấm; chưa chấm được hiển thị riêng.</p>
      <div className="activity-field"><label htmlFor="contribution-score">Điểm đóng góp</label><input id="contribution-score" type="number" min="0" max={pending.activity.max_score} step="1" required disabled={busy} value={score} onChange={event => setScore(event.target.value)} /></div>
      <div className="activity-field"><label htmlFor="contribution-reason">Lý do {pending.contribution ? 'điều chỉnh (bắt buộc)' : 'xác nhận (không bắt buộc)'}</label><textarea id="contribution-reason" rows={3} maxLength={1000} required={Boolean(pending.contribution)} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} /></div>
      <div className="operation-dialog-actions"><button className="button primary" disabled={busy || score === '' || (Boolean(pending.contribution) && !reason.trim())}>Lưu đóng góp</button><button className="button secondary" type="button" disabled={busy} onClick={() => setPending(null)}>Hủy chỉnh sửa</button></div>
    </form></ConfirmationDialog>}
    {history && <ConfirmationDialog title="Lịch sử điều chỉnh đóng góp" onClose={() => setHistory(null)}><History key={history.id} entry={history} close={() => setHistory(null)} /></ConfirmationDialog>}
    {data && <>
      <p className="operation-result-count" role="status">{data.count} người{search ? ` khớp với “${search}”` : ''} · {statuses.find(([value]) => value === status)[1]}</p>
      {!data.count && <p className="activity-empty">{search || status !== 'all' ? 'Không có người tham gia phù hợp với bộ lọc.' : 'Chưa có lượt tham gia đủ điều kiện xác nhận đóng góp.'}</p>}
      <div className="activity-grid operation-list">{data.results.map(entry => <ActionRow className="activity-card operation-row contribution-operation-row" key={entry.id}>
        <div><h2>{entry.volunteer_name}</h2><RecordDetails title={entry.volunteer_name}><p>Hoạt động: {entry.activity.title}</p><p>Nhà tổ chức: {entry.activity.organizer_name}</p><p>Bắt đầu: {activityTime(entry.activity.starts_at)}</p>{entry.contribution ? <><p>Điểm đóng góp: {points(entry.contribution.score)}</p><p>Người xác nhận: {entry.contribution.confirmed_by_name} · {activityTime(entry.contribution.updated_at)}</p></> : <p>Chưa chấm điểm đóng góp.</p>}</RecordDetails></div>
        <div className="operation-score"><span>Điểm</span><strong>{entry.contribution ? points(entry.contribution.score) : 'Chưa chấm'}</strong></div>
        <div><span className={`operation-status${entry.contribution ? ' is-confirmed' : ''}`}>{entry.contribution ? 'Đã chấm' : 'Chưa chấm'}</span>{entry.contribution && <p>Cập nhật: {activityTime(entry.contribution.updated_at)}</p>}</div>
        <div className="operation-row-actions"><button className="button primary" disabled={busy} onClick={() => { setPending(entry); setScore(entry.contribution ? String(entry.contribution.score) : ''); setReason(''); setFailure(''); setMessage(''); setHistory(null) }}>{entry.contribution ? 'Điều chỉnh đóng góp' : 'Xác nhận đóng góp'}</button>
          {entry.contribution && <button className="button secondary" disabled={busy} onClick={() => { setHistory(entry); setPending(null) }}>Xem lịch sử điều chỉnh</button>}
        </div>
      </ActionRow>)}</div><ReportPagination data={data} page={page} busy={busy} onPage={movePage} />
    </>}
  </section>
}

export default function ContributionsPage({ managed = false }) {
  const { id } = useParams()
  return <Contributions key={id || 'mine'} managed={managed} />
}
