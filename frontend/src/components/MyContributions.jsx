import { Link } from 'react-router-dom'
import { Award, CheckCircle2, Clock3, Trophy } from 'lucide-react'
import ActionRow from './ActionRow.jsx'
import RecordDetails from './RecordDetails.jsx'
import RequestState from './RequestState.jsx'
import VolunteerStatistics from './VolunteerStatistics.jsx'
import { ReportPagination } from './ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'

const statuses = [['all', 'Tất cả'], ['pending', 'Chờ chấm'], ['confirmed', 'Đã chấm']]
const exactTime = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
function Time({ value }) { return value ? <time dateTime={value} title={exactTime(value)}>{activityTime(value)}</time> : null }

export default function MyContributions({ data, loading, error, refresh, page, movePage, status, search, updateParams, statisticsVersion, onHistory, historyPanel }) {
  const filtered = Boolean(search || status !== 'all')
  function reset() { updateParams({ search: '', status: '', page: '1' }) }
  return <section className="page-width section interior activity-page my-contributions">
    <header className="mc-heading"><h1>Đóng góp của tôi</h1>
      <div className="mc-heading-actions"><Link className="button secondary" to="/bang-xep-hang"><Trophy size={17} aria-hidden="true" />Bảng xếp hạng</Link>
        <button type="button" className="button secondary refresh-button" disabled={loading} onClick={refresh}>Làm mới</button></div>
    </header>
    <RequestState loading={loading} error={error} retry={refresh} />
    {error?.status === 404 && page > 1 && <button type="button" className="button secondary" onClick={() => movePage(1)}>Về trang đầu</button>}
    {data?.summary && <div className="mc-overview" aria-label={search ? 'Đóng góp trong kết quả tìm kiếm' : 'Tổng hợp đóng góp'}>
      <article className="mc-total"><Award size={25} aria-hidden="true" /><span>{search ? 'Điểm trong kết quả tìm kiếm' : 'Tổng điểm đóng góp'}</span><strong>{data.summary.score}<small>điểm</small></strong><p>Từ {data.summary.confirmed} hoạt động đã chấm.</p></article>
      <article><CheckCircle2 size={23} aria-hidden="true" /><span>Đã chấm điểm</span><strong>{data.summary.confirmed}</strong><p>Bao gồm hoạt động được chấm 0 điểm.</p></article>
      <article><Clock3 size={23} aria-hidden="true" /><span>Chờ chấm điểm</span><strong>{data.summary.pending}</strong><p>Chờ Nhà tổ chức ghi nhận điểm.</p></article>
    </div>}
    <section className="mc-details" aria-labelledby="mc-details-title">
      <div className="mc-list-heading"><h2 id="mc-details-title">Đóng góp theo hoạt động</h2></div>
      <div className="mc-filters">
        <div className="mc-status-filters" role="group" aria-label="Lọc trạng thái đóng góp">{statuses.map(([value, label]) => <button type="button" className={`button secondary${status === value ? ' is-selected' : ''}`} aria-pressed={status === value} key={value} onClick={() => updateParams({ status: value, page: '1' })}>{label}{data?.summary && <span>{value === 'all' ? data.summary.confirmed + data.summary.pending : data.summary[value]}</span>}</button>)}</div>
        <form className="mc-search" onSubmit={event => { event.preventDefault(); updateParams({ search: String(new FormData(event.currentTarget).get('search') || '').trim(), page: '1' }) }}>
          <label htmlFor="my-contribution-search">Tìm hoạt động đóng góp</label><div><input id="my-contribution-search" name="search" type="search" maxLength={200} key={search} defaultValue={search} placeholder="Tên hoạt động" /><button className="button secondary">Tìm kiếm</button></div>
        </form>
      </div>
      {data && <>
        <p className="mc-result-count" role="status">{data.count} hoạt động · {statuses.find(([value]) => value === status)[1]}{search ? ` · “${search}”` : ''}</p>
        {!data.count && <div className="mc-empty"><Award size={30} aria-hidden="true" /><h3>{filtered ? 'Không có đóng góp phù hợp với bộ lọc' : 'Chưa có đóng góp được ghi nhận'}</h3><p>{filtered ? 'Thử tìm tên hoạt động khác hoặc bỏ bộ lọc.' : 'Hoạt động hoàn thành và đã có mặt sẽ xuất hiện tại đây.'}</p>{filtered ? <button type="button" className="button secondary" onClick={reset}>Xem tất cả đóng góp</button> : <Link className="button primary" to="/hoat-dong">Khám phá hoạt động</Link>}</div>}
        <div className="mc-rows">{data.results.map(entry => <ActionRow className="mc-row" key={entry.id} label={`Xem đóng góp tại ${entry.activity.title}`}>
          <div className="mc-row-info"><span className={`mc-status${entry.contribution ? ' is-confirmed' : ''}`}>{entry.contribution ? 'Đã chấm điểm' : 'Chờ chấm điểm'}</span>
            <h3>{entry.activity.title}</h3><p>{entry.activity.organizer_name}</p><p>Đã có mặt · <Time value={entry.confirmed_at} /></p>
          </div>
          <div className="mc-row-score">{entry.contribution ? <><strong>{entry.contribution.score}<small>điểm</small></strong><span>Cập nhật: <Time value={entry.contribution.updated_at} /></span></> : <span>Chưa được chấm điểm</span>}</div>
          <div className="mc-row-actions"><RecordDetails title={entry.activity.title}>
            <p>Nhà tổ chức: {entry.activity.organizer_name}</p><p>Bắt đầu: <Time value={entry.activity.starts_at} /></p><p>Điểm danh: <Time value={entry.confirmed_at} /></p>
            {entry.contribution ? <><p>Điểm đóng góp: {entry.contribution.score} điểm</p><p>Người xác nhận: {entry.contribution.confirmed_by_name}</p><p>Cập nhật: <Time value={entry.contribution.updated_at} /></p></> : <p>Chưa chấm điểm đóng góp.</p>}
          </RecordDetails>
          {entry.contribution && <button type="button" className="button secondary" onClick={() => onHistory(entry)}>Lịch sử điều chỉnh</button>}</div>
        </ActionRow>)}</div>
        <ReportPagination data={data} page={page} onPage={movePage} />
      </>}
    </section>
    <VolunteerStatistics key={statisticsVersion} />
    {historyPanel}
  </section>
}
