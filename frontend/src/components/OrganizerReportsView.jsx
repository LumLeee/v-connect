import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Printer } from 'lucide-react'
import { apiRequest } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { metricLabels } from '../api/reportFormat.js'
import useApi from '../hooks/useApi.js'
import ActionRow from './ActionRow.jsx'
import RequestState from './RequestState.jsx'
import '../styles/analytics.css'

const filterNames = ['search', 'status', 'date_from', 'date_to']
const tabs = { summary: 'Tổng hợp', activities: 'Theo hoạt động', charts: 'Biểu đồ' }
const format = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value ?? 0)
const average = value => value == null ? 'Chưa có đánh giá' : `${format(value)}/5`

function ReportFilters({ params, setParams, disabled }) {
  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setParams(previous => {
      const next = new URLSearchParams(previous)
      for (const name of filterNames) {
        const value = form.get(name)?.trim()
        if (value) next.set(name, value)
        else next.delete(name)
      }
      next.delete('report_page')
      return next
    })
  }
  return <form className="analytics-filters no-print" onSubmit={submit}>
    <fieldset disabled={disabled}><legend>Lọc báo cáo</legend>
      <div className="analytics-filter-grid organizer-report-filters">
        <label>Tên hoạt động<input name="search" maxLength={200} defaultValue={params.get('search') || ''} placeholder="Tìm theo tên" /></label>
        <label>Trạng thái hoạt động<select name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả trạng thái</option>{Object.entries(activityStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Ngày bắt đầu từ<input name="date_from" type="date" defaultValue={params.get('date_from') || ''} /></label>
        <label>Ngày bắt đầu đến<input name="date_to" type="date" defaultValue={params.get('date_to') || ''} /></label>
      </div>
      <div className="analytics-actions"><button className="button primary" type="submit">Áp dụng bộ lọc</button><button className="button secondary" type="button" onClick={() => setParams(previous => {
        const next = new URLSearchParams(previous)
        for (const name of filterNames) next.delete(name)
        next.delete('report_page')
        return next
      })}>Xóa bộ lọc</button></div>
    </fieldset>
  </form>
}

function BarGroup({ title, values, className = '' }) {
  const max = Math.max(1, ...values.map(item => item.value || 0))
  return <section className={`analytics-chart ${className}`} aria-label={title}><h2>{title}</h2><ul>{values.map(({ key, label, value, tone }) => <li key={key}>
    <div className="analytics-bar-label"><span>{label}</span><strong>{format(value)}</strong></div>
    <div className="analytics-bar-track" aria-hidden="true"><span className={tone || ''} style={{ width: `${(value || 0) / max * 100}%` }} /></div>
  </li>)}</ul></section>
}

function MetricDetails({ title, metrics, keys }) {
  return <details className="organizer-report-disclosure"><summary>{title}</summary><dl>{keys.map(key => <div key={key}><dt>{metricLabels[key]}</dt><dd>{format(metrics[key])}</dd></div>)}</dl></details>
}

function ReportResults({ data, tab, page, setPage }) {
  const size = 12
  const pageCount = Math.max(1, Math.ceil(data.rows.length / size))
  const currentPage = Math.min(page, pageCount)
  const monthValues = data.months.flatMap(month => [
    { key: `${month.month}-registered`, label: `${month.month} · Đơn đăng ký`, value: month.registered },
    { key: `${month.month}-attendance`, label: `${month.month} · Đã tham gia`, value: month.attended_completed, tone: 'blue' },
    { key: `${month.month}-feedback`, label: `${month.month} · Phản hồi`, value: month.feedback, tone: 'gold' },
  ])
  return <>
    <div className="analytics-summary">{[['Hoạt động', data.activity_count], ['Đơn đăng ký', data.metrics.registered], ['Đã tham gia (hoàn thành)', data.metrics.attended_completed], ['Phản hồi', data.feedback.count]].map(([label, value]) => <article key={label}><h2>{label}</h2><strong>{format(value)}</strong></article>)}</div>
    <div className="analytics-context organizer-report-context"><p><strong>Phạm vi:</strong> {data.scope}</p><p><strong>Cập nhật:</strong> {activityTime(data.generated_at)}</p>
      <p><strong>Ngày bắt đầu:</strong> {data.filters.date_from || 'Không giới hạn'} – {data.filters.date_to || 'Không giới hạn'} · <strong>Trạng thái:</strong> {activityStatuses[data.filters.status] || 'Tất cả'}{data.filters.search && <> · <strong>Từ khóa:</strong> {data.filters.search}</>}</p>
    </div>
    {!data.activity_count && <p className="activity-empty" role="status">Chưa có dữ liệu phù hợp với bộ lọc.</p>}
    <section className="organizer-report-panel" hidden={tab !== 'summary'} aria-label="Tổng hợp báo cáo">
      <h2 className="organizer-report-section-title">Tổng hợp</h2>
      <div className="organizer-report-breakdown">
        <MetricDetails title={`Đăng ký · ${format(data.metrics.registered)} đơn`} metrics={data.metrics} keys={['pending', 'approved', 'rejected', 'cancelled']} />
        <MetricDetails title="Kết quả điểm danh" metrics={data.metrics} keys={['attended_completed', 'attended_ongoing', 'attended_cancelled']} />
        <details className="organizer-report-disclosure"><summary>Phản hồi · {format(data.feedback.count)} lượt · {average(data.feedback.average_rating)}</summary><dl>{Object.entries(data.feedback.distribution).map(([rating, count]) => <div key={rating}><dt>{rating} sao</dt><dd>{format(count)}</dd></div>)}</dl></details>
      </div>
    </section>
    <section className="organizer-report-panel analytics-details" hidden={tab !== 'activities'} aria-label="Báo cáo theo hoạt động">
      <div className="analytics-heading"><h2>{format(data.activity_count)} hoạt động</h2><span className="no-print">Trang {currentPage}/{pageCount}</span></div>
      <div className="organizer-report-rows">{data.rows.map((row, index) => <ActionRow key={row.id} className={`organizer-report-row${index < (currentPage - 1) * size || index >= currentPage * size ? ' organizer-report-other-page' : ''}`}>
        <div><span className={`activity-status status-${row.status}`}>{activityStatuses[row.status]}</span><h3><Link data-row-primary to={`/bao-cao/hoat-dong/${row.id}`}>{row.title}</Link></h3><p>{activityTime(row.starts_at)}</p></div>
        <dl><div><dt>Đơn đăng ký</dt><dd>{format(row.metrics.registered)}</dd></div><div><dt>Đã tham gia</dt><dd>{format(row.metrics.attended_completed)}</dd></div><div><dt>Phản hồi</dt><dd>{format(row.feedback.count)}</dd></div></dl>
      </ActionRow>)}</div>
      {pageCount > 1 && <nav className="analytics-actions no-print" aria-label="Phân trang báo cáo"><button type="button" className="button secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Trang trước</button><button type="button" className="button secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Trang sau</button></nav>}
    </section>
    <section className="organizer-report-panel" hidden={tab !== 'charts'} aria-label="Biểu đồ báo cáo">
      <h2 className="organizer-report-section-title">Biểu đồ</h2>
      <div className="analytics-charts">
        <BarGroup title="Trạng thái đăng ký" values={['pending', 'approved', 'rejected', 'cancelled'].map(key => ({ key, label: metricLabels[key], value: data.metrics[key] }))} />
        <BarGroup title="Kết quả điểm danh" values={['attended_completed', 'attended_ongoing', 'attended_cancelled'].map(key => ({ key, label: metricLabels[key], value: data.metrics[key], tone: 'blue' }))} />
        <BarGroup title={`Phân bố đánh giá · ${average(data.feedback.average_rating)}`} values={Object.entries(data.feedback.distribution).map(([key, value]) => ({ key, label: `${key} sao`, value, tone: 'gold' }))} />
        <BarGroup title="Trạng thái hoạt động" values={Object.entries(activityStatuses).map(([key, label]) => ({ key, label, value: data.activity_statuses[key] }))} />
      </div>
      {data.months.length > 0 && <><p className="analytics-note">Theo tháng bắt đầu hoạt động.</p><BarGroup title="Đăng ký, tham gia và phản hồi theo tháng" values={monthValues} className="analytics-months" /></>}
    </section>
  </>
}

export default function OrganizerReportsView({ initialTab = 'summary' }) {
  const [params, setParams] = useSearchParams()
  const tab = Object.hasOwn(tabs, params.get('tab')) ? params.get('tab') : initialTab
  const page = Math.max(1, Math.floor(Number(params.get('report_page'))) || 1)
  const query = new URLSearchParams()
  for (const key of filterNames) if (params.get(key)) query.set(key, params.get(key))
  const { data, loading, error, retry } = useApi(`/reports/analytics/?${query}`)
  const [exporting, setExporting] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  async function download() {
    setExporting(true); setDownloadError('')
    try {
      const blob = await apiRequest(`/reports/analytics/export/?${query}`, { responseType: 'blob' })
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'v-connect-bao-cao.xlsx'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { setDownloadError({ query: query.toString(), message: failure.message }) }
    finally { setExporting(false) }
  }
  function refresh() { setDownloadError(''); retry() }
  function changeParam(name, value) { setParams(previous => { const next = new URLSearchParams(previous); next.set(name, String(value)); return next }) }
  return <section className="page-width section interior analytics-page organizer-report-page">
    <div className="analytics-heading organizer-report-heading"><h1>Báo cáo</h1><div className="analytics-actions no-print">
      <button type="button" className="button primary" onClick={download} disabled={loading || exporting || !data}><Download size={17} aria-hidden="true" />{exporting ? 'Đang xuất…' : 'Xuất Excel'}</button>
      <button type="button" className="button secondary" onClick={() => window.print()} disabled={loading || exporting || !data}><Printer size={17} aria-hidden="true" />In / Lưu PDF</button>
      <button type="button" className="button secondary refresh-button" onClick={refresh} disabled={loading || exporting}>Làm mới</button>
    </div></div>
    <ReportFilters key={query.toString()} params={params} setParams={setParams} disabled={exporting} />
    <div className="organizer-report-tabs no-print" role="group" aria-label="Chế độ báo cáo">{Object.entries(tabs).map(([key, label]) => <button type="button" key={key} className={`button ${tab === key ? 'primary' : 'secondary'}`} aria-pressed={tab === key} disabled={exporting} onClick={() => changeParam('tab', key)}>{label}</button>)}</div>
    <details className="organizer-report-rules no-print"><summary>Quy tắc</summary><p>Mỗi người/hoạt động tính một đơn theo trạng thái hiện tại; đăng ký lại không tăng số đơn. Đã tham gia chỉ tính hoạt động Hoàn thành, đăng ký Được duyệt và có điểm danh. Phản hồi bị ẩn không được tính. Điểm trung bình tính trên toàn bộ phản hồi hợp lệ.</p><p>Excel lấy số liệu mới theo bộ lọc đang áp dụng. Bản in gồm toàn bộ hoạt động đã lọc và biểu đồ. Mỗi báo cáo tối đa 2.000 hoạt động.</p></details>
    {downloadError && downloadError.query === query.toString() && <p className="request-error no-print" role="alert">{downloadError.message}</p>}
    <RequestState loading={loading} error={error} retry={refresh} />
    {data && <ReportResults data={data} tab={tab} page={page} setPage={value => changeParam('report_page', value)} />}
  </section>
}
