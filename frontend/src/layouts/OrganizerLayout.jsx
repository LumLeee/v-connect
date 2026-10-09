import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, Bell, CalendarDays, ClipboardList, HeartHandshake, LayoutDashboard, LogOut, MessageSquare, Settings2, UserRound, UserCheck } from 'lucide-react'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import NotificationBell from '../components/NotificationBell.jsx'
import '../styles/organizer-dashboard.css'
import '../styles/organizer-management.css'

const items = [
  ['overview', '/nha-to-chuc', 'Tổng quan', LayoutDashboard],
  ['activities', '/nha-to-chuc/hoat-dong', 'Quản lý hoạt động', CalendarDays],
  ['matching', '/nha-to-chuc/ghep-noi', 'Ghép nối tình nguyện viên', HeartHandshake],
  ['registrations', '/nha-to-chuc/dang-ky', 'Đơn đăng ký', ClipboardList],
  ['attendance', '/nha-to-chuc/diem-danh', 'Quản lý điểm danh', UserCheck],
  ['contributions', '/nha-to-chuc/dong-gop', 'Quản lý đóng góp', HeartHandshake],
  ['feedback', '/nha-to-chuc/phan-hoi', 'Phản hồi hoạt động', MessageSquare],
  ['reports', '/bao-cao', 'Báo cáo', BarChart3],
  ['notifications', '/thong-bao', 'Thông báo', Bell],
  ['profile', '/ho-so', 'Chỉnh sửa hồ sơ', Settings2],
]

function sectionFor(path) {
  if (path.endsWith('/ghep-noi')) return 'matching'
  if (path.endsWith('/dong-gop')) return 'contributions'
  if (path.startsWith('/bao-cao')) return 'reports'
  if (path === '/ho-so') return 'profile'
  if (path === '/thong-bao') return 'notifications'
  if (path.endsWith('/dang-ky')) return 'registrations'
  if (path.endsWith('/diem-danh')) return 'attendance'
  if (path.endsWith('/phan-hoi')) return 'feedback'
  return path.includes('/hoat-dong') ? 'activities' : 'overview'
}

function Avatar({ url }) {
  const [failed, setFailed] = useState(false)
  return <span className="od-avatar">{url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : <UserRound size={20} aria-hidden="true" />}</span>
}

export default function OrganizerLayout({ children }) {
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
    <div className={`od-shell${section === 'overview' ? '' : ' om-shell'}`}>
      <aside className="od-sidebar" aria-label="Không gian Nhà tổ chức">
        <Link to="/" className="od-brand"><span><HeartHandshake size={25} aria-hidden="true" /></span>V-Connect<span className="od-brand-dot">.</span></Link>
        <p className="od-sidebar-caption">KHÔNG GIAN NHÀ TỔ CHỨC</p>
        <nav aria-label="Điều hướng Nhà tổ chức">{items.map(([key, to, label, Icon]) => <Link key={key} to={to} className={section === key ? 'active' : undefined} aria-current={section === key ? 'page' : undefined}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav>
        <div className="od-sidebar-note"><HeartHandshake size={23} aria-hidden="true" /><strong>Kết nối để sẻ chia</strong><p>Mỗi hoạt động mở ra một cơ hội cùng cộng đồng tạo nên điều tốt đẹp.</p><Link to="/nha-to-chuc/hoat-dong/tao">Bắt đầu hoạt động mới →</Link></div>
        <div className="od-sidebar-account"><Avatar url={profile.data?.profile.avatar_url} /><div><strong>{user.full_name}</strong><span>{user.email}</span></div></div>
        <button type="button" className="od-logout" disabled={busy} onClick={logout}><LogOut size={18} aria-hidden="true" />Đăng xuất</button>
        <Link className="od-home-link" to="/">Về trang chủ</Link>
      </aside>
      <div className="od-workspace">
        <header className="od-topbar"><div className="om-breadcrumb"><Link to="/nha-to-chuc">Bảng điều hành</Link><span>/</span><strong>{current[2]}</strong></div>
          <div className="od-topbar-account"><NotificationBell key={user.id} /><span className="od-role">Nhà tổ chức</span><Link to="/ho-so" aria-label="Tài khoản của tôi"><Avatar url={profile.data?.profile.avatar_url} /></Link></div></header>
        <main id="main-content" className={section === 'overview' ? undefined : `om-content om-${section}`}>
          {error && <p className="request-error" role="alert">{error}</p>}
          {children}
        </main>
      </div>
    </div>
  </>
}
