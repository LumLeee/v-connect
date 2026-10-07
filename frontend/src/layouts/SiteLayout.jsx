import { HeartHandshake } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth, workspacePaths } from '../auth/context.js'
import NotificationBell from '../components/NotificationBell.jsx'
import OrganizerLayout from './OrganizerLayout.jsx'
import VolunteerLayout from './VolunteerLayout.jsx'

export default function SiteLayout() {
  const { pathname } = useLocation()
  const { user, loading, signOut } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const [busy, setBusy] = useState(false)
  async function logout() {
    setBusy(true); setLogoutError('')
    try { await signOut() } catch (error) { setLogoutError(error.message) }
    finally { setBusy(false) }
  }
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  if (user?.role === 'volunteer' && /^(\/tinh-nguyen-vien|\/hoat-dong|\/bao-cao|\/ho-so|\/thong-bao)(\/|$)/.test(pathname)) {
    return <VolunteerLayout key={user.id}><Outlet /></VolunteerLayout>
  }
  if (user?.role === 'organizer' && /^(\/nha-to-chuc|\/bao-cao|\/ho-so|\/thong-bao)(\/|$)/.test(pathname)) {
    return <OrganizerLayout key={user.id}><Outlet /></OrganizerLayout>
  }
  return (
    <>
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="V-Connect - Trang chủ"><span className="brand-icon"><HeartHandshake size={24} /></span>V-Connect<span className="brand-dot">.</span></Link>
        <nav aria-label="Điều hướng chính">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/hoat-dong">Hoạt động</NavLink>
          <NavLink to="/gioi-thieu">Về V-Connect</NavLink>
        </nav>
        <div className="header-auth">{loading ? <span role="status">Đang tải…</span> : user ? <><NotificationBell key={user.id} /><Link to={workspacePaths[user.role]}>Tài khoản của tôi</Link><button className="text-button" disabled={busy} onClick={logout}>Đăng xuất</button></> : <><Link to="/dang-nhap">Đăng nhập</Link><Link to="/dang-ky" className="button primary">Đăng ký</Link></>}</div>
      </header>
      {logoutError && <div className="page-width request-error" role="alert">{logoutError}</div>}
      <main id="main-content" className={pathname === '/tinh-nguyen-vien' ? 'volunteer-dashboard-main' : undefined}><Outlet /></main>
      <footer className="site-footer"><span>V-Connect · Kết nối để sẻ chia.</span><Link to="/trang-thai">Trạng thái hệ thống</Link><span>Dự án C2SE.14</span></footer>
    </>
  )
}
