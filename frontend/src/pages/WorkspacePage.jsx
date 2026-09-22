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
      <div className="steps">
        <article className="step"><UserRound /><h3>Thông tin tài khoản</h3><p>{data.user.role === 'admin' ? data.user.username : data.user.email}</p><p>{roleLabels[data.user.role]}</p><Link to="/ho-so" className="button secondary">Chỉnh sửa hồ sơ</Link></article>
        <article className="step"><ShieldCheck /><h3>Kết nối an toàn</h3><p>Bạn đã đăng nhập vào đúng không gian dành cho vai trò của mình.</p></article>
        <article className="step"><ArrowRight /><h3>Bước tiếp theo</h3><p>Cập nhật thông tin liên hệ và ảnh đại diện để hoàn thiện hồ sơ của bạn. Các tính năng hoạt động sẽ được bổ sung sau.</p></article>
      </div>
      <Link to="/" className="button secondary workspace-home">Về trang chủ</Link>
    </>}
  </section>
}
