import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { BarChart3, Download, Printer } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import { apiRequest } from '../api/client.js'
import { activityStatuses, activityTime } from '../api/activityFormat.js'
import { metricLabels } from '../api/reportFormat.js'
import useApi from '../hooks/useApi.js'
import useReportOrganizers from '../hooks/useReportOrganizers.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/analytics.css'

const filterNames = ['search', 'status', 'date_from', 'date_to', 'organizer']
const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
const average = value => value === null ? 'Chưa có đánh giá' : `${number(value)}/5`

function Filters({ params, setParams, admin, organizers, disabled }) {
  function submit(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget), next = new URLSearchParams()
    for (const key of filterNames) if (values.get(key)?.trim()) next.set(key, values.get(key).trim())
    setParams(next)
  }
  return <form className="analytics-filters no-print" onSubmit={submit}>
    <fieldset disabled={disabled}><legend>Lọc báo cáo</legend>
      <div className="analytics-filter-grid">
        <label>Tên hoạt động<input name="search" maxLength={200} defaultValue={params.get('search') || ''} placeholder="Tìm theo tên" /></label>
        <label>Trạng thái hoạt động<select aria-label="Trạng thái hoạt động" name="status" defaultValue={params.get('status') || ''}><option value="">Tất cả trạng thái</option>{Object.entries(activityStatuses).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Ngày bắt đầu từ<input name="date_from" type="date" defaultValue={params.get('date_from') || ''} /></label>
        <label>Ngày bắt đầu đến<input name="date_to" type="date" defaultValue={params.get('date_to') || ''} /></label>
        {admin && <label>Nhà tổ chức<select aria-label="Nhà tổ chức" key={organizers.data.length} name="organizer" defaultValue={params.get('organizer') || ''} disabled={organizers.loading || Boolean(organizers.error)}><option value="">Tất cả Nhà tổ chức</option>{organizers.data.map(user => <option key={user.id} value={user.id}>{user.name}{user.is_active ? '' : ' (bị khóa)'}</option>)}</select></label>}
      </div>
      {admin && (organizers.loading || organizers.error) && params.get('organizer') && <input type="hidden" name="organizer" value={params.get('organizer')} />}
      <div className="analytics-actions"><button className="button primary" type="submit">Áp dụng bộ lọc</button><button className="button secondary" type="button" onClick={() => setParams({})}>Xóa bộ lọc</button></div>
    </fieldset>
    {admin && organizers.loading && <p role="status">Đang tải danh sách Nhà tổ chức…</p>}
    {admin && <RequestState error={organizers.error} retry={organizers.retry} />}
  </form>
}

function BarGroup({ title, values, className = '' }) {
  const max = Math.max(1, ...values.map(item => item.value))
  return <section className={`analytics-chart ${className}`} aria-label={title}><h2>{title}</h2>
    <ul>{values.map(({ key, label, value, tone }) => <li key={key}>
      <div className="analytics-bar-label"><span>{label}</span><strong>{number(value)}</strong></div>
      <div className="analytics-bar-track" aria-hidden="true"><span className={tone || ''} style={{ width: `${value / max * 100}%` }} /></div>
    </li>)}</ul>
  </section>
}

function Results({ data, query, refresh }) {
  const [busy, setBusy] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [page, setPage] = useState(1)
  const size = 20
  async function download() {
    setBusy(true); setDownloadError('')
    try {
      const blob = await apiRequest(`/reports/analytics/export/?${query}`, { responseType: 'blob' })
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'v-connect-bao-cao.xlsx'; document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setDownloadError(error.message) }
    finally { setBusy(false) }
  }
  const monthValues = data.months.flatMap(month => [
    { key: `${month.month}-registered`, label: `${month.month} · Đơn đăng ký`, value: month.registered },
    { key: `${month.month}-attendance`, label: `${month.month} · Đã tham gia`, value: month.attended_completed, tone: 'blue' },
    { key: `${month.month}-feedback`, label: `${month.month} · Phản hồi hợp lệ`, value: month.feedback, tone: 'gold' },
  ])
  return <>
    <div className="analytics-heading no-print">
      <div className="analytics-actions"><button className="button secondary" onClick={refresh} disabled={busy}>Cập nhật số liệu</button>
        <button className="button primary" onClick={download} disabled={busy}><Download size={17} aria-hidden="true" />{busy ? 'Đang xuất…' : 'Xuất Excel'}</button>
        <button className="button secondary" onClick={() => window.print()} disabled={busy}><Printer size={17} aria-hidden="true" />In / Lưu PDF</button></div>
    </div>
    {downloadError && <p className="request-error no-print" role="alert">{downloadError}</p>}
    <div className="analytics-context"><p><strong>Phạm vi:</strong> {data.scope}</p>
      <p><strong>Ngày bắt đầu:</strong> {data.filters.date_from || 'Không giới hạn'} → {data.filters.date_to || 'Không giới hạn'} (giờ Việt Nam).</p>
      <p><strong>Trạng thái:</strong> {activityStatuses[data.filters.status] || 'Tất cả'}{data.filters.search && <> · <strong>Từ khóa:</strong> {data.filters.search}</>}</p>
      <p><strong>Số liệu lúc:</strong> {activityTime(data.generated_at)} (giờ Việt Nam).</p>
    </div>
    <p className="analytics-note no-print">Excel lấy số liệu mới theo bộ lọc đang áp dụng. Bản in dùng số liệu đang xem, gồm toàn bộ hoạt động đã lọc. Để lưu PDF, chọn “Lưu dưới dạng PDF” trong hộp thoại in.</p>
    <div className="analytics-summary">{[['Hoạt động', data.activity_count], ['Tổng đơn đăng ký', data.metrics.registered], ['Đã tham gia (hoàn thành)', data.metrics.attended_completed], ['Phản hồi hợp lệ', data.feedback.count]].map(([label, value]) => <article key={label}><h2>{label}</h2><strong>{number(value)}</strong></article>)}</div>
    <p className="analytics-rules">Mỗi người/hoạt động tính một đơn theo trạng thái hiện tại; đăng ký lại không tăng số đơn. Đã tham gia chỉ tính Hoàn thành, được duyệt và có điểm danh. Phản hồi bị ẩn không tính. Điểm trung bình tính trên toàn bộ phản hồi hợp lệ, không lấy trung bình các hoạt động.</p>
    {!data.activity_count && <p className="activity-empty" role="status">Chưa có dữ liệu phù hợp với bộ lọc.</p>}
    <div className="analytics-charts">
      <BarGroup title="Trạng thái đăng ký" values={['pending', 'approved', 'rejected', 'cancelled'].map(key => ({ key, label: metricLabels[key], value: data.metrics[key] }))} />
      <BarGroup title="Kết quả điểm danh" values={['attended_completed', 'attended_ongoing', 'attended_cancelled'].map(key => ({ key, label: metricLabels[key], value: data.metrics[key], tone: 'blue' }))} />
      <BarGroup title={`Phân bố đánh giá · ${average(data.feedback.average_rating)}`} values={Object.entries(data.feedback.distribution).map(([key, value]) => ({ key, label: `${key} sao`, value, tone: 'gold' }))} />
      <BarGroup title="Trạng thái hoạt động" values={Object.entries(activityStatuses).map(([key, label]) => ({ key, label, value: data.activity_statuses[key] }))} />
    </div>
    {data.months.length > 0 && <><p className="analytics-rules">Theo tháng bắt đầu hoạt động (giờ Việt Nam), không phải tháng gửi đơn hay gửi phản hồi. Chỉ hiển thị tháng có hoạt động phù hợp.</p><BarGroup title="Đăng ký, tham gia và phản hồi theo tháng" values={monthValues} className="analytics-months" /></>}
    <section className="analytics-details"><div className="analytics-heading"><h2>Chi tiết {number(data.activity_count)} hoạt động</h2><span className="no-print">Trang {page}/{Math.max(1, Math.ceil(data.rows.length / size))}</span></div>
      <div className="analytics-table-wrap" tabIndex="0" role="region" aria-label="Bảng số liệu hoạt động"><table><caption className="sr-only">Số liệu của từng hoạt động trong bộ lọc</caption><thead><tr><th scope="col">Hoạt động / Nhà tổ chức</th><th scope="col">Bắt đầu / Trạng thái</th><th scope="col">Đơn đăng ký</th><th scope="col">Được duyệt</th><th scope="col">Đã tham gia</th><th scope="col">Phản hồi</th><th scope="col">Điểm TB</th></tr></thead>
        <tbody>{data.rows.map((row, index) => <tr key={row.id} className={index < (page - 1) * size || index >= page * size ? 'analytics-other-page' : ''}>
          <td><Link to={`/bao-cao/hoat-dong/${row.id}`}>{row.title}</Link><small>{row.organizer_name}</small></td><td>{activityTime(row.starts_at)}<small>{activityStatuses[row.status]}</small></td>
          <td>{number(row.metrics.registered)}</td><td>{number(row.metrics.approved)}</td><td>{number(row.metrics.attended_completed)}</td><td>{number(row.feedback.count)}</td><td>{row.feedback.average_rating === null ? '—' : number(row.feedback.average_rating)}</td>
        </tr>)}</tbody></table></div>
      {data.rows.length > size && <nav className="analytics-actions no-print" aria-label="Phân trang báo cáo"><button className="button secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Trang trước</button><button className="button secondary" disabled={page * size >= data.rows.length} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
    </section>
  </>
}

export default function AdvancedReportsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const allowed = ['admin', 'organizer'].includes(user.role)
  return allowed ? <ReportPage key={user.id} admin={user.role === 'admin'} params={params} setParams={setParams} /> : <Navigate to="/bao-cao" replace />
}

function ReportPage({ admin, params, setParams }) {
  const organizers = useReportOrganizers(admin)
  const query = new URLSearchParams()
  for (const key of filterNames) if (params.get(key)) query.set(key, params.get(key))
  const { data, loading, error, retry } = useApi(`/reports/analytics/?${query}`)
  const details = error?.details?.error?.details
  const explanation = details ? Object.values(details).flat().filter(value => typeof value === 'string').join(' ') : ''
  return <section className="page-width section interior analytics-page">
    <Link className="activity-back no-print" to="/bao-cao">← Về thống kê</Link>
    <p className="eyebrow">V-CONNECT · BÁO CÁO HOẠT ĐỘNG</p><h1>Báo cáo mở rộng</h1>
    <Filters key={params.toString()} params={params} setParams={setParams} admin={admin} organizers={organizers} />
    <RequestState loading={loading} error={error} retry={retry} />
    {error && explanation && <p className="field-error" role="alert">{explanation}</p>}
    {data && <Results key={`${query}-${data.generated_at}`} data={data} query={query.toString()} refresh={retry} />}
    <p className="analytics-note no-print"><BarChart3 size={16} aria-hidden="true" /> Mỗi báo cáo tối đa 2.000 hoạt động. Dùng bộ lọc để thu hẹp phạm vi nếu cần.</p>
  </section>
}
