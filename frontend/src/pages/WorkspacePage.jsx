import { Link } from 'react-router-dom'
import { UserRound, ShieldCheck, ArrowRight } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { roleLabels } from '../auth/context.js'

export default function WorkspacePage({ role }) {
  const { data, loading, error, retry } = useApi(`/auth/workspace/${role}/`)
  return <section className="page-width section interior">
    <p className="eyebrow">KHÔNG GIAN {roleLabels[role].toLocaleUpperCase('vi-VN')}</p>
    <RequestState loading={loading} error={error} retry={retry} />
    {data && <>
      <h1>Xin chào, {data.user.full_name}.</h1>
      <p className="lead">Tài khoản của bạn đã sẵn sàng cho hành trình cùng V-Connect.</p>
      <Link className="button primary" to={role === 'organizer' ? '/nha-to-chuc/hoat-dong' : '/hoat-dong'}>{role === 'organizer' ? 'Quản lý hoạt động' : 'Khám phá hoạt động'}</Link>
      <div className="steps">
        <article className="step"><UserRound /><h3>Thông tin tài khoản</h3><p>{data.user.role === 'admin' ? data.user.username : data.user.email}</p><p>{roleLabels[data.user.role]}</p><Link to="/ho-so" className="button secondary">Chỉnh sửa hồ sơ</Link></article>
        <article className="step"><ShieldCheck /><h3>Kết nối an toàn</h3><p>Bạn đã đăng nhập vào đúng không gian dành cho vai trò của mình.</p></article>
        <article className="step"><ArrowRight /><h3>Bước tiếp theo</h3><p>{role === 'organizer' ? 'Tạo hoạt động mới và công khai để mọi người có thể tìm thấy.' : 'Khám phá các hoạt động công khai và tìm hiểu những cơ hội đóng góp cho cộng đồng.'}</p></article>
      </div>
      <Link to="/" className="button secondary workspace-home">Về trang chủ</Link>
    </>}
  </section>
}
