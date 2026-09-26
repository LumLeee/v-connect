import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import '../styles/activities.css'
import { activityStatuses, activityTime } from '../api/activityFormat.js'

export default function ActivitiesPage({ managed = false }) {
  const [params, setParams] = useSearchParams()
  const query = params.get('search') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)
  const [search, setSearch] = useState(query)
  const { data, loading, error, retry } = useApi(`${managed ? '/organizer' : ''}/activities/?${new URLSearchParams({ search: query, page: String(page), page_size: '12' })}`)
  function submit(event) { event.preventDefault(); setParams({ search: search.trim(), page: '1' }) }
  return <section className="page-width section interior activity-page">
    <p className="eyebrow">CÙNG ĐÓNG GÓP CHO CỘNG ĐỒNG</p>
    <div className="activity-heading"><h1>{managed ? 'Hoạt động của tôi' : 'Khám phá hoạt động'}</h1>
      {managed && <Link className="button primary" to="/nha-to-chuc/hoat-dong/tao">Tạo hoạt động</Link>}</div>
    <form className="activity-search" onSubmit={submit}>
      <label htmlFor="activity-search">Tìm theo tên hoạt động</label>
      <div><input id="activity-search" maxLength={200} value={search} onChange={event => setSearch(event.target.value)} /><button className="button primary" type="submit">Tìm kiếm</button></div>
    </form>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <p className="muted">{data.count} hoạt động{query && ` phù hợp với “${query}”`}.</p>
      {!data.count && <p className="activity-empty">{managed ? 'Chưa có hoạt động phù hợp. Bạn có thể tạo hoạt động mới hoặc đổi từ khóa.' : 'Chưa có hoạt động phù hợp. Hãy thử từ khóa khác hoặc quay lại sau.'}</p>}
      <div className="activity-grid">{data.results.map(activity => <article className="activity-card" key={activity.id}>
        <span className={`activity-status status-${activity.status}`}>{activityStatuses[activity.status]}</span>
        <h2><Link to={`${managed ? '/nha-to-chuc' : ''}/hoat-dong/${activity.id}`}>{activity.title}</Link></h2>
        <p>{activity.organizer_name}</p><p>{activityTime(activity.starts_at)} (giờ Việt Nam)</p><p>{activity.address}</p>
        <p>Sức chứa: {activity.capacity} người</p>
      </article>)}</div>
      {(data.previous || data.next) && <nav className="activity-pagination" aria-label="Phân trang hoạt động">
        <button className="button secondary" disabled={!data.previous} onClick={() => setParams({ search: query, page: String(page - 1) })}>Trang trước</button>
        <span>Trang {page}</span><button className="button secondary" disabled={!data.next} onClick={() => setParams({ search: query, page: String(page + 1) })}>Trang sau</button>
      </nav>}
    </>}
  </section>
}
