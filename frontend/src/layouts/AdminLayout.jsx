import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, LogOut, MessageSquare, Settings2, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import NotificationBell from '../components/NotificationBell.jsx'
import '../styles/organizer-dashboard.css'
import '../styles/organizer-management.css'
import '../styles/admin-workspace.css'

const items = [
  ['overview', '/quan-tri', 'Tổng quan', LayoutDashboard],
  ['accounts', '/quan-tri/tai-khoan', 'Tài khoản hệ thống', UserRound],
  ['activities', '/bao-cao/hoat-dong', 'Hoạt động toàn hệ thống', CalendarDays],
  ['feedback', '/quan-tri/phan-hoi', 'Kiểm duyệt phản hồi', MessageSquare],
  ['audit', '/quan-tri/nhat-ky', 'Lịch sử thao tác', ClipboardList],
  ['reports', '/bao-cao', 'Báo cáo và thống kê', BarChart3],
  ['notifications', '/thong-bao', 'Thông báo', Bell],
  ['profile', '/ho-so', 'Hồ sơ cá nhân', Settings2],
]

function sectionFor(path) {
  if (path.startsWith('/bao-cao/hoat-dong')) return 'activities'
  if (path.startsWith('/bao-cao')) return 'reports'
  if (path === '/ho-so') return 'profile'
  if (path === '/thong-bao') return 'notifications'
  if (path.endsWith('/tai-khoan')) return 'accounts'
  if (path.startsWith('/quan-tri/nhat-ky')) return 'audit'
  if (path.endsWith('/phan-hoi')) return 'feedback'
  return 'overview'
}

function Avatar({ url }) {
  const [failed, setFailed] = useState(false)
  return <span className="od-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <UserRound size={20} aria-hidden="true" />}</span>
}

export default function AdminLayout({ children }) {
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
  const current = items.find(item => item[0] === section)
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  return <>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <div className="od-shell om-shell ad-shell">
      <aside className="od-sidebar" aria-label="Không gian Quản trị viên">
        <Link to="/" className="od-brand"><span><HeartHandshake size={25} aria-hidden="true" /></span>V-Connect<span className="od-brand-dot">.</span></Link>
        <p className="od-sidebar-caption">KHÔNG GIAN QUẢN TRỊ VIÊN</p>
        <nav aria-label="Điều hướng Quản trị viên">{items.map(([key, to, label, Icon]) => <Link key={key} to={to} className={section === key ? 'active' : undefined} aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>
        <div className="od-sidebar-note"><HeartHandshake size={23} aria-hidden="true" /><strong>Quản trị cộng đồng</strong><p>Theo dõi hoạt động, hỗ trợ người dùng và giữ môi trường tình nguyện minh bạch.</p><Link to="/quan-tri/nhat-ky">Tra cứu nhật ký →</Link></div>
        <div className="od-sidebar-account"><Avatar url={profile.data?.profile.avatar_url} /><div><strong>{user.full_name}</strong><span>Quản trị viên</span></div></div>
        <button type="button" className="od-logout" disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true" />Đăng xuất</button>
        <Link className="od-home-link" to="/">Về trang chủ</Link>
      </aside>
      <div className="od-workspace">
        <header className="od-topbar"><div className="om-breadcrumb"><Link to="/quan-tri">Bảng điều hành</Link><span>/</span><strong>{current[2]}</strong></div>
          <div className="od-topbar-account"><NotificationBell key={user.id} /><span className="od-role">Quản trị viên</span><Link to="/ho-so" aria-label="Tài khoản của tôi"><Avatar url={profile.data?.profile.avatar_url} /></Link></div></header>
        <main id="main-content" className={`om-content ad-content ad-${section}`}>
          {error && <p className="request-error" role="alert">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  </>
}
