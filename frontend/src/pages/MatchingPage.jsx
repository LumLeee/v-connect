import { Link, useParams, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import OrganizerActivityHeader from '../components/OrganizerActivityHeader.jsx'
import { ReportPagination } from '../components/ReportMetrics.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/activities.css'
import '../styles/matching.css'

export default function MatchingPage({ managed = false }) {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, loading, error, retry } = useApi(`${managed ? `/organizer/activities/${id}/matching/` : '/matching/activities/'}?page=${page}&page_size=12`)
  return <section className="page-width section interior activity-page matching-page">
    <Link className="activity-back" to={managed ? `/nha-to-chuc/hoat-dong/${id}` : '/tinh-nguyen-vien'}>← {managed ? 'Về hoạt động' : 'Về tổng quan'}</Link>
    <h1>{managed ? 'Tình nguyện viên phù hợp' : 'Hoạt động phù hợp'}</h1>
    <p>Ghép nối theo kỹ năng, sở thích và lịch rảnh. Bạn vẫn tự quyết định tham gia; Nhà tổ chức xét duyệt theo quy trình hiện có.</p>
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
      </article>)}</div>
      <ReportPagination data={data} page={page} onPage={value => setParams({ page: String(value) })} />
    </>}
    <p>{managed ? <Link to={`/nha-to-chuc/hoat-dong/${id}/dang-ky`}>Xem và xét duyệt người đã đăng ký →</Link> : <Link to="/hoat-dong">Khám phá tất cả hoạt động công khai →</Link>}</p>
  </section>
}
