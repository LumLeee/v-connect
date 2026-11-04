import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Trophy, BarChart3, CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, LogOut, MessageSquare, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import NotificationBell from '../components/NotificationBell.jsx'
import useWorkspaceMenu from '../hooks/useWorkspaceMenu.js'
import { WorkspaceMenuToggle, WorkspaceMenuClose, WorkspaceMenuBackdrop } from '../components/WorkspaceMenuControls.jsx'
import '../styles/organizer-dashboard.css'
import '../styles/organizer-management.css'
import '../styles/admin-workspace.css'

const items = [
  ['overview', '/quan-tri', 'Tổng quan', LayoutDashboard],
  ['leaderboard', '/bang-xep-hang', 'Bảng xếp hạng', Trophy],
  ['accounts', '/quan-tri/tai-khoan', 'Tài khoản hệ thống', UserRound],
  ['activities', '/bao-cao/hoat-dong', 'Hoạt động toàn hệ thống', CalendarDays],
  ['feedback', '/quan-tri/phan-hoi', 'Kiểm duyệt phản hồi', MessageSquare],
  ['audit', '/quan-tri/nhat-ky', 'Lịch sử thao tác', ClipboardList],
  ['reports', '/bao-cao', 'Báo cáo và thống kê', BarChart3],
]

function sectionFor(path) {
  if (path === '/bang-xep-hang') return 'leaderboard'
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
  const menu = useWorkspaceMenu()
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
  const current = items.find(item => item[0] === section) || (section === 'profile' ? ['profile', '/ho-so', 'Hồ sơ cá nhân'] : ['notifications', '/thong-bao', 'Thông báo'])
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  return <>
    <a href="#main-content" className="skip-link">Đến nội dung chính</a>
    <div className={`od-shell om-shell ad-shell workspace-shell${menu.open ? '' : ' menu-closed'}`}>
      <WorkspaceMenuBackdrop menu={menu} /><aside id={menu.id} ref={menu.sidebarRef} hidden={!menu.open} role={menu.narrow && menu.open ? 'dialog' : undefined} aria-modal={menu.narrow && menu.open ? true : undefined} className="od-sidebar" aria-label="Không gian Quản trị viên">
        <Link to="/" className="od-brand"><span><HeartHandshake size={25} aria-hidden="true" /></span>V-Connect<span className="od-brand-dot">.</span></Link>
        <WorkspaceMenuClose menu={menu} />
        <p className="od-sidebar-caption">KHÔNG GIAN QUẢN TRỊ VIÊN</p>
        <nav aria-label="Điều hướng Quản trị viên">{items.map(([key, to, label, Icon]) => <Link key={key} to={to} className={section === key ? 'active' : undefined} aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>
        <Link to="/ho-so" className="od-sidebar-account" aria-label="Xem hồ sơ cá nhân"><Avatar url={profile.data?.profile.avatar_url} /><div><strong>{user.full_name}</strong><span>Quản trị viên</span></div></Link>
        <button type="button" className="od-logout" disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true" />Đăng xuất</button>
        <Link className="od-home-link" to="/">Về trang chủ</Link>
      </aside>
      <div ref={menu.workspaceRef} className="od-workspace">
        <header className="od-topbar"><div className="workspace-topbar-start"><WorkspaceMenuToggle menu={menu} /><div className="om-breadcrumb"><Link to="/quan-tri">Bảng điều hành</Link><span>/</span><strong>{current[2]}</strong></div>
          </div><div className="od-topbar-account"><NotificationBell key={user.id} /><Link className="od-profile-link" to="/ho-so" aria-label="Tài khoản của tôi"><span className="od-role">Quản trị viên</span><Avatar url={profile.data?.profile.avatar_url} /></Link></div></header>
        <main id="main-content" className={`om-content ad-content ad-${section}`}>
          {error && <p className="request-error" role="alert">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  </>
}
