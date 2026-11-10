import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Trophy, Bell, ClipboardList, Compass, HeartHandshake, History, LayoutDashboard, LogOut, ScanLine, UserRound } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import NotificationBell from '../components/NotificationBell.jsx'
import useWorkspaceMenu from '../hooks/useWorkspaceMenu.js'
import { WorkspaceMenuToggle, WorkspaceMenuClose, WorkspaceMenuBackdrop } from '../components/WorkspaceMenuControls.jsx'
import '../styles/organizer-dashboard.css'
import '../styles/volunteer-workspace.css'

const items = [
  ['overview', '/tinh-nguyen-vien', 'Tổng quan', LayoutDashboard],
  ['leaderboard', '/bang-xep-hang', 'Bảng xếp hạng', Trophy],
  ['activities', '/hoat-dong', 'Khám phá', Compass],
  ['matching', '/tinh-nguyen-vien/ghep-noi', 'Gợi ý phù hợp', HeartHandshake],
  ['invitations', '/tinh-nguyen-vien/loi-moi', 'Lời mời của tôi', Bell],
  ['registrations', '/tinh-nguyen-vien/dang-ky', 'Quản lý đăng ký', ClipboardList],
  ['checkin', '/tinh-nguyen-vien/check-in', 'Điểm danh của tôi', ScanLine],
  ['history', '/tinh-nguyen-vien/lich-su', 'Lịch sử hoạt động', History],
  ['contributions', '/tinh-nguyen-vien/dong-gop', 'Đóng góp của tôi', HeartHandshake],
]

function sectionFor(path) {
  if (path === '/bang-xep-hang') return 'leaderboard'
  if (path.endsWith('/loi-moi')) return 'invitations'
  if (path.endsWith('/ghep-noi')) return 'matching'
  if (path.endsWith('/dong-gop')) return 'contributions'
  if (path.endsWith('/check-in')) return 'checkin'
  if (path.endsWith('/phan-hoi')) return 'history'
  if (path.startsWith('/hoat-dong')) return 'activities'
  if (path.startsWith('/bao-cao')) return 'contributions'
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
  const menu = useWorkspaceMenu(`v-connect:volunteer-menu:${user.id}`)
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
    <div className={`od-shell vs-shell workspace-shell${menu.open ? '' : ' menu-closed'}`}><WorkspaceMenuBackdrop menu={menu} /><aside id={menu.id} ref={menu.sidebarRef} hidden={!menu.open} role={menu.narrow && menu.open ? 'dialog' : undefined} aria-modal={menu.narrow && menu.open ? true : undefined} className="od-sidebar" aria-label="Không gian Tình nguyện viên">
      <Link to="/" className="od-brand"><span><HeartHandshake size={25} aria-hidden="true" /></span>V-Connect<span className="od-brand-dot">.</span></Link>
      <WorkspaceMenuClose menu={menu} />
      <p className="od-sidebar-caption">KHÔNG GIAN TÌNH NGUYỆN VIÊN</p>
      <nav aria-label="Điều hướng Tình nguyện viên">{items.map(([key, to, label, Icon]) => <Link key={key} to={to} className={section === key ? 'active' : undefined} aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>
      <Link to="/ho-so" className="od-sidebar-account" aria-label="Xem hồ sơ cá nhân"><Avatar key={profile.data?.profile.avatar_url || 'empty'} url={profile.data?.profile.avatar_url} /><div><strong>{user.full_name}</strong><span>Tình nguyện viên</span></div></Link>
      <button type="button" className="od-logout" data-unsaved-navigation disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true" />Đăng xuất</button><Link className="od-home-link" to="/">Về trang chủ</Link>
    </aside><div ref={menu.workspaceRef} className="od-workspace"><header className="od-topbar"><div className="workspace-topbar-start"><WorkspaceMenuToggle menu={menu} /><div className="vs-breadcrumb"><Link to="/tinh-nguyen-vien">Không gian của tôi</Link><span>/</span><strong>{items.find(item => item[0] === section)?.[2] || (section === 'profile' ? 'Hồ sơ cá nhân' : 'Thông báo')}</strong></div>
      </div><div className="od-topbar-account"><NotificationBell key={user.id} /><Link className="od-profile-link" to="/ho-so" aria-label="Tài khoản của tôi"><span className="od-role">Tình nguyện viên</span><Avatar key={profile.data?.profile.avatar_url || 'empty'} url={profile.data?.profile.avatar_url} /></Link></div></header>
      <main id="main-content" className={`vs-content vs-${section}`}>{error && <p role="alert" className="request-error">{error}</p>}{children}</main>
    </div></div></>
}
