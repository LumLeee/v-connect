import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, Compass, HeartHandshake, History, LayoutDashboard, LogOut, MessageSquare, ScanLine, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import NotificationBell from '../components/NotificationBell.jsx'
import '../styles/organizer-dashboard.css'
import '../styles/volunteer-workspace.css'

const items = [
  ['overview', '/tinh-nguyen-vien', 'Tổng quan', LayoutDashboard],
  ['activities', '/hoat-dong', 'Khám phá', Compass],
  ['matching', '/tinh-nguyen-vien/ghep-noi', 'Gợi ý phù hợp', HeartHandshake],
  ['registrations', '/tinh-nguyen-vien/dang-ky', 'Quản lý đăng ký', ClipboardList],
  ['checkin', '/tinh-nguyen-vien/check-in', 'Điểm danh của tôi', ScanLine],
  ['history', '/tinh-nguyen-vien/lich-su', 'Lịch sử hoạt động', History],
  ['contributions', '/tinh-nguyen-vien/dong-gop', 'Đóng góp của tôi', HeartHandshake],
  ['feedback', '/tinh-nguyen-vien/phan-hoi', 'Đánh giá hoạt động', MessageSquare],
  ['reports', '/bao-cao', 'Thống kê', BarChart3],
  ['notifications', '/thong-bao', 'Thông báo', Bell],
  ['profile', '/ho-so', 'Hồ sơ cá nhân', UserRound],
]

function sectionFor(path) {
  if (path.endsWith('/ghep-noi')) return 'matching'
  if (path.endsWith('/dong-gop')) return 'contributions'
  if (path.endsWith('/check-in')) return 'checkin'
  if (path.endsWith('/phan-hoi')) return 'feedback'
  if (path.startsWith('/hoat-dong')) return 'activities'
  if (path.startsWith('/bao-cao')) return 'reports'
  if (path === '/ho-so') return 'profile'
  if (path === '/thong-bao') return 'notifications'
  if (path.endsWith('/dang-ky')) return 'registrations'
  if (path.endsWith('/lich-su')) return 'history'
  return 'overview'
}

function Avatar({ url }) {
  const [failed, setFailed] = useState(false)
  return <span className="od-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <UserRound size={20} aria-hidden="true" />}</span>
}

export default function VolunteerLayout({ children }) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const profile = useApi('/auth/profile/')
  const refreshProfile = profile.retry
  useEffect(() => {
    window.addEventListener('profile:changed', refreshProfile)
    return () => window.removeEventListener('profile:changed', refreshProfile)
  }, [refreshProfile])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const section = sectionFor(pathname.replace(/\/$/, ''))
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  return <><a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <div className="od-shell vs-shell"><aside className="od-sidebar" aria-label="Không gian Tình nguyện viên">
      <Link to="/" className="od-brand"><span><HeartHandshake size={25} aria-hidden="true" /></span>V-Connect<span className="od-brand-dot">.</span></Link>
      <p className="od-sidebar-caption">KHÔNG GIAN TÌNH NGUYỆN VIÊN</p>
      <nav aria-label="Điều hướng Tình nguyện viên">{items.map(([key, to, label, Icon]) => <Link key={key} to={to} className={section === key ? 'active' : undefined} aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>
      <div className="od-sidebar-note"><HeartHandshake size={22} aria-hidden="true" /><strong>Mỗi đóng góp đều ý nghĩa</strong><p>Tìm cơ hội phù hợp và cùng cộng đồng tạo nên điều tốt đẹp.</p><Link to="/hoat-dong">Bắt đầu hành trình →</Link></div>
      <div className="od-sidebar-account"><Avatar url={profile.data?.profile.avatar_url} /><div><strong>{user.full_name}</strong><span>Tình nguyện viên</span></div></div>
      <button type="button" className="od-logout" disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true" />Đăng xuất</button><Link className="od-home-link" to="/">Về trang chủ</Link>
    </aside><div className="od-workspace"><header className="od-topbar"><div className="vs-breadcrumb"><Link to="/tinh-nguyen-vien">Không gian của tôi</Link><span>/</span><strong>{items.find(item => item[0] === section)[2]}</strong></div>
      <div className="od-topbar-account"><NotificationBell key={user.id} /><span className="od-role">Tình nguyện viên</span><Link to="/ho-so" aria-label="Tài khoản của tôi"><Avatar url={profile.data?.profile.avatar_url} /></Link></div></header>
      <main id="main-content" className={`vs-content vs-${section}`}>{error && <p role="alert" className="request-error">{error}</p>}{children}</main>
    </div></div></>
}
