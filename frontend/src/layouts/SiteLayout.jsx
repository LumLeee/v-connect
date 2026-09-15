import { HeartHandshake } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'

export default function SiteLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return (
    <>
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="V-Connect - Trang chủ"><span className="brand-icon"><HeartHandshake size={24} /></span>V-Connect<span className="brand-dot">.</span></Link>
        <nav aria-label="Điều hướng chính">
          <NavLink to="/" end>Trang chủ</NavLink>
          <NavLink to="/gioi-thieu">Về V-Connect</NavLink>
        </nav>
      </header>
      <main id="main-content"><Outlet /></main>
      <footer className="site-footer"><span>V-Connect · Kết nối để sẻ chia.</span><Link to="/trang-thai">Trạng thái hệ thống</Link><span>Dự án C2SE.14</span></footer>
    </>
  )
}
