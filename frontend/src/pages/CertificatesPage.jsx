import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import RequestState from '../components/RequestState.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import { duration } from '../api/documentFormat.js'
import '../styles/activities.css'
import '../styles/documents.css'

const errorText = problem => Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message

function Candidates({ id, changed }) {
  const [page, setPage] = useState(1)
  const { data, loading, error, retry } = useApi(`/reports/activities/${id}/certificate-candidates/?page=${page}&page_size=12`)
  const [pending, setPending] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [message, setMessage] = useState('')
  async function issue() {
    setBusy(true); setFailure('')
    try { await apiPost(`/reports/activities/${id}/certificates/`, { attendance: pending.id }); setPending(null); setMessage('Đã cấp chứng nhận.'); retry(); changed() }
    catch (problem) { setFailure(errorText(problem)) }
    finally { setBusy(false) }
  }
  return <section className="certificate-candidates"><h2>Người tham gia đã điểm danh</h2>
    <p>Chỉ cấp khi hoạt động Hoàn thành và số phút đóng góp đã xác nhận lớn hơn 0. Chứng nhận được cấp có thể tra cứu công khai theo mã.</p>
    <button className="text-button" onClick={() => { setPending(null); retry() }}>Cập nhật điều kiện cấp</button>
    <RequestState loading={loading} error={error} retry={retry} />
    {failure && <p className="request-error" role="alert">{failure}</p>}{message && <p role="status">{message}</p>}
    {pending && <div className="activity-confirm" aria-label="Xác nhận cấp chứng nhận"><h3>Cấp chứng nhận cho {pending.volunteer_name}?</h3><p>{duration(pending.minutes)}. Họ tên, hoạt động, số giờ và trạng thái sẽ được hiển thị khi tra cứu đúng mã.</p>
      <button className="button primary" disabled={busy} onClick={issue}>Xác nhận cấp chứng nhận</button>{' '}<button className="button secondary" disabled={busy} onClick={() => setPending(null)}>Quay lại</button></div>}
    {data && <>{!data.count && <p className="activity-empty">Chưa có người đã được duyệt và điểm danh.</p>}<div className="activity-grid">{data.results.map(entry => <article className="activity-card" key={entry.id}><h3>{entry.volunteer_name}</h3><p>{entry.minutes == null ? 'Chưa xác nhận giờ đóng góp.' : duration(entry.minutes)}</p>
      {entry.certificate_id ? <Link to={`/chung-nhan/${entry.certificate_id}`}>Xem chứng nhận đang hiệu lực</Link> : <button className="button secondary" disabled={!entry.eligible || busy} onClick={() => { setPending(entry); setFailure(''); setMessage('') }}>Cấp chứng nhận</button>}
      {!entry.eligible && <p className="muted">Chưa đủ điều kiện cấp chứng nhận.</p>}
    </article>)}</div><ReportPagination data={data} page={page} onPage={value => { setPending(null); setPage(value) }} /></>}
  </section>
}

export default function CertificatesPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ ...Object.fromEntries(params), page: String(page), page_size: '12' })
  if (id) query.set('activity', id)
  const { data, loading, error, retry } = useApi(`/certificates/?${query}`)
  return <section className="page-width section interior activity-page">
    <Link className="activity-back" to={id ? `/bao-cao/hoat-dong/${id}` : user.role === 'volunteer' ? '/tinh-nguyen-vien' : '/bao-cao'}>← {id ? 'Về kết quả hoạt động' : 'Về tổng quan'}</Link>
    <h1>{user.role === 'volunteer' ? 'Chứng nhận của tôi' : 'Quản lý chứng nhận'}</h1>
    {id && user.role !== 'volunteer' && <Candidates id={id} changed={retry} />}
    {!id && user.role !== 'volunteer' && <p><Link to="/bao-cao/hoat-dong">Chọn hoạt động để cấp chứng nhận →</Link></p>}
    <h2>Chứng nhận đã cấp</h2><form className="activity-search" key={params.toString()} onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); setParams({ search: form.get('search'), status: form.get('status') }) }}>
      <label htmlFor="certificate-search">Tìm tên người hoặc hoạt động</label><input id="certificate-search" name="search" maxLength={200} defaultValue={params.get('search') || ''} />
      <label htmlFor="certificate-status">Trạng thái chứng nhận</label><select id="certificate-status" name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả</option><option value="valid">Còn hiệu lực</option><option value="revoked">Đã thu hồi</option></select><button className="button secondary">Lọc chứng nhận</button>
    </form><button className="text-button" onClick={retry}>Cập nhật danh sách</button><RequestState loading={loading} error={error} retry={retry} />
    {data && <><p>{data.count} chứng nhận.</p>{!data.count && <p className="activity-empty">Chưa có chứng nhận phù hợp.</p>}<div className="activity-grid">{data.results.map(item => <article className="activity-card" key={item.id}>
      <span className={`certificate-status ${item.status}`}>{item.status === 'valid' ? 'Còn hiệu lực' : 'Đã thu hồi'}</span><h2>{item.volunteer_name}</h2><p>{item.activity_title}</p><p>{duration(item.minutes)} · Cấp ngày {activityTime(item.issued_at)}</p><Link to={`/chung-nhan/${item.id}`}>Xem và in chứng nhận</Link>
    </article>)}</div><ReportPagination data={data} page={page} onPage={value => { const next = new URLSearchParams(params); next.set('page', value); setParams(next) }} /></>}
  </section>
}
