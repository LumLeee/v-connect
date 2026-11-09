import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, Download, Printer, RefreshCw, X } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { metricLabels } from '../api/reportFormat.js'
import useApi from '../hooks/useApi.js'
import useReportOrganizers from '../hooks/useReportOrganizers.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/admin-reports.css'

const filterNames = ['search', 'status', 'date_from', 'date_to', 'organizer']
const tabs = { summary: 'Tổng hợp', activities: 'Theo hoạt động', charts: 'Biểu đồ' }
const format = value => value != null && Number.isFinite(Number(value)) ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value)) : 'Chưa có thông tin'
const average = value => value == null ? 'Chưa có đánh giá' : `${format(value)}/5`
const validPage = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : 1

function ReportFilters({ initial, organizers, loading, apply }) {
  const [values, setValues] = useState(initial)
  const update = event => setValues(previous => ({ ...previous, [event.target.name]: event.target.value }))
  const unknownOrganizer = values.organizer && !organizers.data.some(user => user.id === values.organizer)
  return <form className="ad-report-filters no-print" aria-label="Bộ lọc báo cáo" onSubmit={event => { event.preventDefault(); if (!loading) apply(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))) }}>
    <fieldset disabled={loading}><legend className="sr-only">Bộ lọc báo cáo</legend><div className="ad-report-filter-grid">
      <label>Tên hoạt động<input name="search" maxLength={200} placeholder="Nhập tên hoạt động" value={values.search} onChange={update} /></label>
      <label>Trạng thái hoạt động<select aria-label="Trạng thái hoạt động" name="status" value={values.status} onChange={update}><option value="">Tất cả trạng thái</option>{Object.entries(activityStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Ngày bắt đầu từ<input type="date" name="date_from" value={values.date_from} onChange={update} /></label>
      <label>Ngày bắt đầu đến<input type="date" name="date_to" min={values.date_from || undefined} value={values.date_to} onChange={update} /></label>
      <label>Nhà tổ chức<select aria-label="Nhà tổ chức" name="organizer" value={values.organizer} onChange={update} disabled={organizers.loading || Boolean(organizers.error)}><option value="">Tất cả nhà tổ chức</option>{unknownOrganizer && <option value={values.organizer}>Nhà tổ chức đã chọn</option>}{organizers.data.map(user => <option key={user.id} value={user.id}>{user.name}{user.is_active ? '' : ' (bị khóa)'}</option>)}</select></label>
    </div><div className="ad-report-filter-actions"><button className="button primary">Áp dụng</button><button type="button" className="button secondary" onClick={() => apply({})}>Xóa bộ lọc</button></div></fieldset>
    {organizers.loading && <p role="status">Đang tải nhà tổ chức…</p>}
    <RequestState error={organizers.error} retry={organizers.retry} />
  </form>
}

function Bars({ title, values }) {
  const max = Math.max(1, ...values.map(item => Number(item.value) || 0))
  return <section className="ad-report-chart" aria-label={title}><h2>{title}</h2><ul>{values.map(({ key, label, value }) => <li key={key}><div><span>{label}</span><strong>{format(value)}</strong></div><div className="ad-report-track" aria-hidden="true"><span style={{ width: `${Math.max(0, Number(value) || 0) / max * 100}%` }} /></div></li>)}</ul></section>
}

function ReportResults({ data, tab, page, changePage }) {
  const pageCount = Math.max(1, Math.ceil(data.rows.length / 12)), currentPage = Math.min(page, pageCount)
  return <>
    <div className="ad-report-context"><p><strong>Phạm vi:</strong> {data.scope}</p><p><strong>Ngày bắt đầu:</strong> {data.filters.date_from || 'Không giới hạn'} – {data.filters.date_to || 'Không giới hạn'}</p><p><strong>Trạng thái:</strong> {activityStatuses[data.filters.status] || 'Tất cả'}{data.filters.search && <> · <strong>Từ khóa:</strong> {data.filters.search}</>}</p><p><strong>Số liệu lúc:</strong> {data.generated_at && Number.isFinite(Date.parse(data.generated_at)) ? <time dateTime={data.generated_at}>{activityTime(data.generated_at)}</time> : 'Chưa có thời gian'}</p></div>
    <div className="ad-report-summary">{[['Hoạt động', data.activity_count], ['Đơn đăng ký', data.metrics.registered], ['Đã tham gia', data.metrics.attended_completed], ['Phản hồi hợp lệ', data.feedback.count]].map(([label, value]) => <article key={label}><h2>{label}</h2><strong>{format(value)}</strong>{label === 'Đã tham gia' && <span>Hoạt động hoàn thành</span>}</article>)}</div>
    {!data.activity_count && <div className="ad-report-empty" role="status"><h2>Không có dữ liệu phù hợp</h2><p>Thử khoảng ngày khác hoặc xóa bộ lọc để xem lại báo cáo.</p></div>}
    <section className={`ad-report-panel${tab !== 'summary' ? ' ad-report-inactive' : ''}`} aria-label="Tổng hợp báo cáo">
      <div className="ad-report-breakdown"><section><h2>Đăng ký</h2><dl>{['pending', 'approved', 'rejected', 'cancelled'].map(key => <div key={key}><dt>{metricLabels[key]}</dt><dd>{format(data.metrics[key])}</dd></div>)}</dl></section><section><h2>Điểm danh</h2><dl>{['attended_completed', 'attended_ongoing', 'attended_cancelled'].map(key => <div key={key}><dt>{metricLabels[key]}</dt><dd>{format(data.metrics[key])}</dd></div>)}</dl></section><section><h2>Phản hồi</h2><dl><div><dt>Điểm trung bình</dt><dd>{average(data.feedback.average_rating)}</dd></div>{Object.entries(data.feedback.distribution).map(([rating, count]) => <div key={rating}><dt>{rating} sao</dt><dd>{format(count)}</dd></div>)}</dl></section></div>
    </section>
    <section className={`ad-report-panel${tab !== 'activities' ? ' ad-report-inactive' : ''}`} aria-label="Báo cáo theo hoạt động">
      <div className="ad-report-section-heading"><h2>{format(data.activity_count)} hoạt động</h2><span className="no-print">Trang {currentPage}/{pageCount}</span></div>
      <div className="ad-report-rows">{data.rows.map((row, index) => <Link key={row.id} className={`ad-report-row${index < (currentPage - 1) * 12 || index >= currentPage * 12 ? ' ad-report-other-page' : ''}`} aria-label={`Xem kết quả hoạt động ${row.title}`} to={`/bao-cao/hoat-dong/${row.id}`}><div className="ad-report-identity"><span className={`ad-report-status status-${row.status}`}>{activityStatuses[row.status] || row.status}</span><h3>{row.title}</h3><p>{row.organizer_name}</p>{row.starts_at && Number.isFinite(Date.parse(row.starts_at)) && <time dateTime={row.starts_at}>{activityTime(row.starts_at)}</time>}</div><dl><div><dt>Đơn đăng ký</dt><dd>{format(row.metrics.registered)}</dd></div><div><dt>Đã tham gia</dt><dd>{format(row.metrics.attended_completed)}</dd></div><div><dt>Phản hồi</dt><dd>{format(row.feedback.count)}</dd></div></dl><ChevronRight size={18} aria-hidden="true" /></Link>)}</div>
      {data.rows.length > 12 && <nav className="ad-report-pagination no-print" aria-label="Phân trang báo cáo"><button className="button secondary" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Trang trước</button><span>Trang {currentPage}/{pageCount}</span><button className="button secondary" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>Trang sau</button></nav>}
    </section>
    <section className={`ad-report-panel${tab !== 'charts' ? ' ad-report-inactive' : ''}`} aria-label="Biểu đồ báo cáo"><div className="ad-report-charts"><Bars title="Trạng thái hoạt động" values={Object.entries(activityStatuses).map(([key, label]) => ({ key, label, value: data.activity_statuses[key] }))} /><Bars title="Trạng thái đăng ký" values={['pending', 'approved', 'rejected', 'cancelled'].map(key => ({ key, label: metricLabels[key], value: data.metrics[key] }))} /><Bars title="Phân bố đánh giá" values={Object.entries(data.feedback.distribution).map(([key, value]) => ({ key, label: `${key} sao`, value }))} /><Bars title="Đơn đăng ký theo tháng bắt đầu hoạt động" values={data.months.map(month => ({ key: month.month, label: month.month, value: month.registered }))} /></div></section>
    <details className="ad-report-rules no-print"><summary>Quy tắc tính số liệu</summary><p>Mỗi người/hoạt động tính một đơn theo trạng thái hiện tại. Đã tham gia chỉ tính hoạt động hoàn thành, đăng ký được duyệt và có điểm danh. Phản hồi bị ẩn không được tính; điểm trung bình tính trên toàn bộ phản hồi hợp lệ. Biểu đồ tháng dựa trên tháng bắt đầu hoạt động.</p></details>
  </>
}

export default function AdminReportsPage({ title = 'Báo cáo và thống kê' }) {
  const [params, setParams] = useSearchParams(), organizers = useReportOrganizers(true)
  const [busy, setBusy] = useState(false), [exportError, setExportError] = useState(null)
  const exporting = useRef(false)
  const values = Object.fromEntries(filterNames.map(key => [key, params.get(key) || '']))
  const query = new URLSearchParams(filterNames.filter(key => values[key]).map(key => [key, values[key]])).toString()
  const tab = Object.hasOwn(tabs, params.get('tab')) ? params.get('tab') : 'summary', page = validPage(params.get('report_page'))
  const { data, loading, error, retry } = useApi(`/reports/analytics/?${query}`)
  const filters = filterNames.filter(key => values[key]).map(key => [key, key === 'status' ? activityStatuses[values[key]] || values[key] : key === 'organizer' ? organizers.data.find(user => user.id === values[key])?.name || 'Nhà tổ chức đã chọn' : `${{ search: 'Tìm', date_from: 'Từ ngày', date_to: 'Đến ngày' }[key]}: ${values[key]}`])
  function update(changes, resetPage = false) { setParams(previous => { const next = new URLSearchParams(previous); for (const [key, value] of Object.entries(changes)) if (value) next.set(key, value); else next.delete(key); if (resetPage) next.delete('report_page'); return next }) }
  function apply(next) { setExportError(null); update(Object.fromEntries(filterNames.map(key => [key, next[key] || ''])), true) }
  async function download() {
    if (exporting.current || loading || !data) return
    exporting.current = true; setBusy(true); setExportError(null)
    try { const blob = await apiRequest(`/reports/analytics/export/?${query}`, { responseType: 'blob' }); const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = 'v-connect-bao-cao.xlsx'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
    catch (failure) { setExportError({ query, message: failure.message }) }
    finally { exporting.current = false; setBusy(false) }
  }
  return <section className="page-width section interior ad-reports" aria-labelledby="admin-report-title" aria-busy={loading}>
    <header className="ad-report-heading"><div><h1 id="admin-report-title">{title}</h1><p>Theo dõi kết quả hoạt động trong toàn hệ thống.</p></div><div className="ad-report-header-actions no-print"><button type="button" className="button secondary" disabled={loading || busy || !data} onClick={download}><Download size={16} aria-hidden="true" />{busy ? 'Đang xuất…' : 'Xuất Excel'}</button><button type="button" className="button secondary" disabled={loading || busy || !data} onClick={() => window.print()}><Printer size={16} aria-hidden="true" />In / Lưu PDF</button><button type="button" className="button secondary refresh-button" disabled={loading || busy} onClick={() => { setExportError(null); retry() }}><RefreshCw size={16} aria-hidden="true" />Làm mới</button></div></header>
    <ReportFilters key={query} initial={values} organizers={organizers} loading={loading || busy} apply={apply} />
    {filters.length > 0 && <div className="ad-report-active-filters no-print" aria-label="Bộ lọc đang áp dụng">{filters.map(([key, label]) => <button type="button" key={key} disabled={loading || busy} aria-label={`Bỏ bộ lọc ${label}`} onClick={() => apply({ ...values, [key]: '' })}>{label}<X size={14} aria-hidden="true" /></button>)}</div>}
    <nav className="ad-report-tabs no-print" aria-label="Chế độ báo cáo">{Object.entries(tabs).map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => update({ tab: key }, true)}>{label}</button>)}</nav>
    <RequestState loading={loading} error={error} retry={retry} />
    {exportError?.query === query && <p role="alert" className="request-error no-print">{exportError.message}</p>}
    {data && <><ReportResults data={data} tab={tab} page={page} changePage={value => update({ report_page: String(value) })} /><p className="ad-report-note no-print">Excel lấy số liệu mới theo bộ lọc đang áp dụng. Bản in gồm toàn bộ hoạt động trong kết quả đang xem. Mỗi báo cáo tối đa 2.000 hoạt động.</p></>}
  </section>
}
