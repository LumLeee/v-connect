import { Link } from 'react-router-dom'
import { Users, CalendarDays, UserCheck, ShieldCheck, MessageSquare, ClipboardList, ArrowUpRight } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityStatuses } from '../api/activityFormat.js'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { data, loading, error, retry } = useApi('/reports/overview/')
  const tasks = [
    [Users, 'Quản lý tài khoản', 'Tra cứu người dùng, kiểm tra trạng thái và xử lý khóa hoặc mở khóa.', '/quan-tri/tai-khoan'],
    [MessageSquare, 'Quản lý phản hồi', 'Xem đánh giá và xử lý nội dung không phù hợp với lý do rõ ràng.', '/quan-tri/phan-hoi'],
    [ClipboardList, 'Nhật ký thao tác', 'Đối chiếu người thực hiện, thời điểm và lý do của từng thao tác.', '/quan-tri/nhat-ky'],
  ]
  return <section className="page-width section interior activity-page">
    <div className="ad-welcome"><div><p className="eyebrow">ĐIỀU HÀNH V-CONNECT</p><h1>Xin chào, {user.full_name}.</h1><p>Theo dõi cộng đồng và quản lý các hoạt động trên toàn hệ thống.</p><p>Tài khoản quản trị: <strong>{user.username}</strong></p></div><Link className="button primary" to="/bao-cao">Xem thống kê <ArrowUpRight size={16} /></Link></div>
    <div className="om-list-toolbar"><h2>Tổng quan hệ thống</h2><button className="text-button" onClick={retry}>Cập nhật số liệu</button></div>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <div className="om-summary">
        {[[Users, 'Tổng tài khoản', data.accounts.total], [ShieldCheck, 'Tài khoản bị khóa', data.accounts.locked], [CalendarDays, 'Hoạt động công khai', data.activities.published || 0], [UserCheck, 'Lượt tham gia hoàn thành', data.metrics.attended_completed]].map(([Icon, label, value]) => <article className="om-stat" key={label}><Icon size={22} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <div className="ad-overview-grid"><section className="ad-panel"><h2>Trạng thái hoạt động</h2><div className="ad-status-list">{Object.entries(activityStatuses).map(([key, label]) => <Link key={key} to={`/bao-cao/hoat-dong?status=${key}`}><span><i className={`ad-dot ad-dot-${key}`} />{label}</span><strong>{data.activities[key] || 0}</strong><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div><Link to="/bao-cao/hoat-dong">Xem báo cáo từng hoạt động →</Link></section>
        <section className="ad-panel"><h2>Dữ liệu và báo cáo</h2><p>Xem đăng ký, điểm danh và phản hồi; lọc theo thời gian, trạng thái hoặc Nhà tổ chức.</p><Link className="button secondary" to="/bao-cao/mo-rong">Mở báo cáo mở rộng</Link><p>Số lượt tham gia hoàn thành chỉ tính hoạt động đã Hoàn thành và có ghi nhận điểm danh.</p><p><Link to="/ho-so">Chỉnh sửa hồ sơ</Link></p></section></div>
    </>}
    <h2>Công việc quản trị</h2><div className="ad-task-grid">{tasks.map(([Icon, title, description, to]) => <article className="ad-panel" key={to}><Icon size={24} aria-hidden="true" /><h3>{title}</h3><p>{description}</p><Link to={to}>{title} <ArrowUpRight size={15} aria-hidden="true" /></Link></article>)}</div>
  </section>
}
