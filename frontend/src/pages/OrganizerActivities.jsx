import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, CheckCircle2, Users } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import useSkillCatalog from '../hooks/useSkillCatalog.js'
import RequestState from '../components/RequestState.jsx'
import { activityStatuses, activityTime } from '../api/activityFormat.js'

const modes = {
  activities: ['Hoạt động của tôi', 'Theo dõi và quản lý những hoạt động bạn tổ chức cho cộng đồng.', 'Xem chi tiết', ''],
  registrations: ['Quản lý đơn đăng ký', 'Chọn hoạt động để xem người đăng ký và xét duyệt từng đơn.', 'Xét duyệt đăng ký', '/dang-ky'],
  attendance: ['Quản lý điểm danh', 'Chọn hoạt động để ghi nhận có mặt hoặc mở mã QR cho người tham gia.', 'Mở điểm danh', '/diem-danh'],
  feedback: ['Phản hồi từ người tham gia', 'Chọn hoạt động để xem đánh giá và nội dung phản hồi hợp lệ.', 'Xem phản hồi', '/phan-hoi'],
}

function Summary() {
  const { data, loading, error, retry } = useApi('/reports/overview/')
  return <><RequestState loading={loading} error={error} retry={retry} />{data && <div className="om-summary" aria-label="Tổng hợp hoạt động của tôi">
    {[[CalendarDays, 'Tổng hoạt động', Object.values(data.activities).reduce((a, b) => a + b, 0)],
      [Users, 'Đang công khai', data.activities.published || 0],
      [CheckCircle2, 'Đã hoàn thành', data.activities.completed || 0],
      [ClipboardList, 'Đơn chờ duyệt', data.metrics.pending]].map(([Icon, label, value]) => <div className="om-stat" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>)}
  </div>}</>
}

export default function OrganizerActivities({ Filters, mode = 'activities' }) {
  const [params, setParams] = useSearchParams()
  const skills = useSkillCatalog()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const query = new URLSearchParams({ page: String(page), page_size: '12' })
  for (const name of ['search', 'status', 'date_from', 'date_to', 'location', 'skill']) if (params.get(name)) query.set(name, params.get(name))
  const { data, loading, error, retry } = useApi(`/organizer/activities/?${query}`)
  const [title, description, action, suffix] = modes[mode]
  function changePage(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next) }
  return <section className="page-width section interior activity-page om-activity-list">
    <div className="om-page-heading"><div><p className="om-eyebrow">QUẢN LÝ CỘNG ĐỒNG</p><h1>{title}</h1><p>{description}</p></div><Link className="button primary" to="/nha-to-chuc/hoat-dong/tao">Tạo hoạt động</Link></div>
    <Summary />
    <Filters key={String(params)} params={params} setParams={setParams} managed skills={skills} />
    <div className="om-list-toolbar"><h2>Danh sách hoạt động</h2><button className="text-button" onClick={retry}>Cập nhật danh sách</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <><p className="muted">{data.count} hoạt động phù hợp với bộ lọc.</p>
      {!data.count && <p className="activity-empty">Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi bộ lọc.</p>}
      {!!data.count && <div className="om-table-labels" aria-hidden="true"><span>HOẠT ĐỘNG</span><span>THỜI GIAN / ĐỊA ĐIỂM</span><span>NGƯỜI THAM GIA</span><span>THAO TÁC</span></div>}
      <div className="om-activity-rows">{data.results.map(activity => <article className="om-activity-row" key={activity.id}>
        <div><span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span><h2><Link to={`/nha-to-chuc/hoat-dong/${activity.id}`}>{activity.title}</Link></h2>
          {!!activity.skill_details?.length && <div className="activity-skill-tags">{activity.skill_details.map(skill => <span key={skill.id}>{skill.name}</span>)}</div>}</div>
        <div className="om-row-time"><p>{activityTime(activity.starts_at)}</p><small>Giờ Việt Nam (UTC+7)</small><p>{activity.address}</p></div>
        <div className="om-capacity"><strong>{activity.approved_count}/{activity.capacity}</strong><span>người được duyệt</span><progress value={activity.approved_count} max={activity.capacity} aria-label={`Số người được duyệt cho ${activity.title}`} /></div>
        <div className="om-row-actions"><Link className="om-action-link" to={`/nha-to-chuc/hoat-dong/${activity.id}${suffix}`}>{action}<ArrowRight size={14} aria-hidden="true" /></Link>
          {mode === 'activities' && ['draft', 'published'].includes(activity.status) && <Link to={`/nha-to-chuc/hoat-dong/${activity.id}/sua`}>Chỉnh sửa</Link>}</div>
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang hoạt động"><button className="button secondary" disabled={!data.previous} onClick={() => changePage(page - 1)}>Trang trước</button><span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => changePage(page + 1)}>Trang sau</button></nav>}
    </>}
  </section>
}
