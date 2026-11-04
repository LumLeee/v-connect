import { Link } from 'react-router-dom'
import { Award, CheckCircle2, Clock3, Trophy } from 'lucide-react'
import ActionRow from './ActionRow.jsx'
import RecordDetails from './RecordDetails.jsx'
import RequestState from './RequestState.jsx'
import VolunteerStatistics from './VolunteerStatistics.jsx'
import { ReportPagination } from './ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'

export default function MyContributions({ data, loading, error, refresh, page, movePage, statisticsVersion, onHistory, historyPanel }) {
  return <section className="page-width section interior activity-page my-contributions">
    <header className="mc-heading"><div><h1>Đóng góp của tôi</h1><p>Điểm được ghi nhận và những hoạt động bạn đã tham gia.</p></div>
      <div className="mc-heading-actions"><Link className="button secondary" to="/bang-xep-hang"><Trophy size={17} aria-hidden="true" />Bảng xếp hạng</Link>
        <button type="button" className="button secondary refresh-button" onClick={refresh}>Làm mới</button></div>
    </header>
    <RequestState loading={loading} error={error} retry={refresh} />
    {data?.summary && <div className="mc-overview" aria-label="Tổng hợp đóng góp">
      <article className="mc-total"><Award size={28} aria-hidden="true" /><span>Tổng điểm đóng góp</span><strong>{data.summary.score}<small>điểm</small></strong><p>Tích lũy từ các hoạt động đã được chấm điểm.</p></article>
      <article><CheckCircle2 size={23} aria-hidden="true" /><span>Đã chấm điểm</span><strong>{data.summary.confirmed}</strong><p>hoạt động được ghi nhận</p></article>
      <article><Clock3 size={23} aria-hidden="true" /><span>Chờ chấm điểm</span><strong>{data.summary.pending}</strong><p>hoạt động chờ Nhà tổ chức xác nhận</p></article>
    </div>}
    <VolunteerStatistics key={statisticsVersion} />
    <section className="mc-details" aria-labelledby="mc-details-title">
      <div className="mc-list-heading"><div><h2 id="mc-details-title">Đóng góp theo hoạt động</h2><p>{data ? `${data.count} hoạt động đã hoàn thành và có điểm danh.` : 'Các hoạt động đủ điều kiện ghi nhận đóng góp.'}</p></div></div>
      {data && <>
        {!data.count && <div className="mc-empty"><Award size={32} aria-hidden="true" /><h3>Chưa có đóng góp được ghi nhận</h3><p>Các hoạt động đã hoàn thành và được xác nhận có mặt sẽ xuất hiện tại đây.</p><Link className="button primary" to="/hoat-dong">Khám phá hoạt động</Link></div>}
        <div className="mc-rows">{data.results.map(entry => <ActionRow className="mc-row" key={entry.id} label={`Xem đóng góp tại ${entry.activity.title}`}>
          <div className="mc-row-info"><span className={`mc-status${entry.contribution ? ' is-confirmed' : ''}`}>{entry.contribution ? 'Đã chấm điểm' : 'Chờ chấm điểm'}</span>
            <h3>{entry.activity.title}</h3><p>{entry.activity.organizer_name}</p><time dateTime={entry.activity.starts_at}>{activityTime(entry.activity.starts_at)}</time>
          </div>
          <div className="mc-row-score">{entry.contribution ? <><strong>{entry.contribution.score}<small>điểm</small></strong><span>Ghi nhận: {activityTime(entry.contribution.updated_at)}</span></> : <span>Chờ Nhà tổ chức xác nhận</span>}</div>
          <div className="mc-row-actions"><RecordDetails title={entry.activity.title}>
            <p>Nhà tổ chức: {entry.activity.organizer_name}</p><p>Bắt đầu: {activityTime(entry.activity.starts_at)}</p><p>Điểm danh: {activityTime(entry.confirmed_at)}</p>
            {entry.contribution ? <><p>Điểm đóng góp: {entry.contribution.score} điểm</p><p>Người xác nhận: {entry.contribution.confirmed_by_name}</p><p>Cập nhật: {activityTime(entry.contribution.updated_at)}</p></> : <p>Chưa chấm điểm đóng góp.</p>}
          </RecordDetails>
          {entry.contribution && <button type="button" className="text-button" onClick={() => onHistory(entry)}>Lịch sử điều chỉnh</button>}</div>
        </ActionRow>)}</div>
        <ReportPagination data={data} page={page} onPage={movePage} />
      </>}
    </section>
    {historyPanel}
  </section>
}
