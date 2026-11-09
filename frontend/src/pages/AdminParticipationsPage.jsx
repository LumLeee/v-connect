import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardList, RefreshCw, X } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import RecordDetails from '../components/RecordDetails.jsx'
import ActionRow from '../components/ActionRow.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { metricLabels } from '../api/reportFormat.js'
import { participationLabels } from '../api/participationFormat.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import '../styles/admin-participations.css'

const format = value => new Intl.NumberFormat('vi-VN').format(value)
function DateValue({ value }) { return value && Number.isFinite(Date.parse(value)) ? <time dateTime={value}>{activityTime(value)}</time> : <span>Chưa có thời gian</span> }
function MetricFilter({ metric, loading, apply, reset }) {
  const [selected, setSelected] = useState(metric)
  return <form className="ad-participation-filters" aria-label="Bộ lọc đăng ký" onSubmit={event => { event.preventDefault(); if (!loading) apply(selected) }}><label>Loại số liệu<select aria-label="Loại số liệu" name="metric" value={selected} onChange={event => setSelected(event.target.value)} disabled={loading}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><div><button className="button primary" disabled={loading}>Áp dụng</button><button type="button" className="button secondary" disabled={loading} onClick={reset}>Xóa bộ lọc</button></div></form>
}

function ParticipationDetails({ entry }) {
  return <RecordDetails title={`Đăng ký của ${entry.volunteer_name || 'tình nguyện viên'}`}><dl className="ad-participation-details"><div><dt>Tình nguyện viên</dt><dd>{entry.volunteer_name || 'Chưa có tên'}</dd></div>{entry.volunteer_email && <div><dt>Email</dt><dd>{entry.volunteer_email}</dd></div>}{entry.volunteer_phone && <div><dt>Số điện thoại</dt><dd>{entry.volunteer_phone}</dd></div>}<div><dt>Hoạt động</dt><dd>{entry.activity.title}</dd></div><div><dt>Nhà tổ chức</dt><dd>{entry.activity.organizer_name || 'Chưa có thông tin'}</dd></div><div><dt>Trạng thái hoạt động</dt><dd>{activityStatuses[entry.activity.status] || entry.activity.status}</dd></div><div><dt>Trạng thái đơn</dt><dd>{participationLabels[entry.status] || entry.status}</dd></div><div><dt>Ngày đăng ký</dt><dd><DateValue value={entry.registered_at} /></dd></div>{entry.reviewed_at && <div><dt>Thời gian xét duyệt</dt><dd><DateValue value={entry.reviewed_at} /></dd></div>}<div><dt>Điểm danh</dt><dd>{entry.attendance ? 'Đã ghi nhận có mặt' : 'Chưa ghi nhận có mặt'}</dd></div>{entry.attendance && <><div><dt>Thời gian điểm danh</dt><dd><DateValue value={entry.attendance.confirmed_at} /></dd></div><div><dt>Người xác nhận</dt><dd>{entry.attendance.confirmed_by_name || 'Chưa có thông tin'}</dd></div>{entry.attendance.method && <div><dt>Hình thức</dt><dd>{{ manual: 'Nhà tổ chức ghi nhận', qr: 'Quét QR', code: 'Nhập mã' }[entry.attendance.method] || entry.attendance.method}</dd></div>}</>}{entry.cancellation_reason && <div><dt>Lý do hủy</dt><dd>{entry.cancellation_reason}</dd></div>}</dl><p><Link className="button secondary" to={`/bao-cao/hoat-dong/${entry.activity.id}`}>Kết quả hoạt động</Link></p></RecordDetails>
}

export default function AdminParticipationsPage() {
  const [params, setParams] = useSearchParams()
  const metric = params.get('metric') || 'registered', activity = params.get('activity') || ''
  const pageValue = Number(params.get('page')), page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const query = new URLSearchParams({ metric, page: String(page), page_size: '12' }); if (activity) query.set('activity', activity)
  const { data, loading, error, retry } = useApi(`/reports/participations/?${query}`)
  const context = useApi(activity ? `/reports/activities/${encodeURIComponent(activity)}/` : null)
  function update(changes) { setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key); next.delete('page'); return next }) }
  function changePage(value) { if (!loading) setParams(previous => { const next = new URLSearchParams(previous); next.set('page', String(value)); return next }) }
  return <section className="page-width section interior ad-participations" aria-labelledby="admin-participations-title" aria-busy={loading}>
    <header className="ad-participation-heading"><div><h1 id="admin-participations-title">Chi tiết đăng ký</h1><p>Đối chiếu đăng ký và điểm danh theo số liệu báo cáo.</p></div><button type="button" className="button secondary" disabled={loading || context.loading} onClick={() => { retry(); if (activity) context.retry() }}><RefreshCw size={17} aria-hidden="true" />Làm mới</button></header>
    {activity && <section className="ad-participation-context" aria-label="Hoạt động đang xem">{context.loading && <p role="status">Đang tải thông tin hoạt động…</p>}<RequestState error={context.error} retry={context.retry} />{context.data && <><h2>{context.data.activity.title}</h2><p>{activityStatuses[context.data.activity.status] || context.data.activity.status} · {context.data.activity.organizer_name || 'Chưa có nhà tổ chức'}</p><Link className="button secondary" to={`/bao-cao/hoat-dong/${context.data.activity.id}`}>Kết quả hoạt động</Link></>}<button type="button" className="ad-participation-clear-scope" disabled={loading} onClick={() => update({ activity: '' })}>Bỏ phạm vi hoạt động<X size={14} aria-hidden="true" /></button></section>}
    <MetricFilter key={metric} metric={metric} loading={loading} apply={value => update({ metric: value === 'registered' ? '' : value })} reset={() => update({ metric: '', activity: '' })} />
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><div className="ad-participation-results"><p role="status"><strong>{format(data.count)}</strong> đơn · {metricLabels[metric] || metric}</p>{!activity && <span>Toàn hệ thống</span>}</div>
      {!data.results.length ? <div className="ad-participation-empty"><ClipboardList size={28} aria-hidden="true" /><h2>{data.count ? 'Trang này không có đơn đăng ký' : 'Không có đăng ký phù hợp'}</h2><p>{data.count ? 'Quay về trang đầu để xem danh sách hiện tại.' : 'Thử loại số liệu khác hoặc bỏ phạm vi hoạt động.'}</p>{data.count > 0 && <button type="button" className="button secondary" onClick={() => changePage(1)}>Về trang đầu</button>}</div> : <><div className="ad-participation-columns" aria-hidden="true"><span>Tình nguyện viên / Hoạt động</span><span>Trạng thái đơn</span><span>Điểm danh</span><span>Ngày đăng ký</span></div><div className="ad-participation-list">{data.results.map(entry => <ActionRow key={entry.id} className="ad-participation-row" label={`Xem đăng ký của ${entry.volunteer_name || 'tình nguyện viên'} cho ${entry.activity.title}`}><div className="ad-participation-identity"><h2>{entry.volunteer_name || 'Chưa có tên tình nguyện viên'}</h2>{entry.volunteer_email && <p>{entry.volunteer_email}</p>}<h3>{entry.activity.title}</h3><span className="ad-participation-activity-status">{activityStatuses[entry.activity.status] || entry.activity.status}</span></div><div className="ad-participation-cell"><span className="ad-participation-mobile-label">Trạng thái đơn</span><span className={`ad-participation-status status-${entry.status}`}>{participationLabels[entry.status] || entry.status}</span></div><div className="ad-participation-cell ad-participation-attendance"><span className="ad-participation-mobile-label">Điểm danh</span><strong>{entry.attendance ? 'Đã có mặt' : 'Chưa ghi nhận có mặt'}</strong>{entry.attendance && <DateValue value={entry.attendance.confirmed_at} />}</div><div className="ad-participation-cell"><span className="ad-participation-mobile-label">Ngày đăng ký</span><DateValue value={entry.registered_at} /></div><ParticipationDetails entry={entry} /></ActionRow>)}</div></>}
      <ReportPagination data={data} page={page} busy={loading} onPage={changePage} /></>}
  </section>
}
