import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <section className="page-width section interior"><p className="eyebrow">404</p><h1>Trang này chưa có ở đây.</h1><p className="lead">Đường dẫn có thể không đúng hoặc nội dung chưa được phát hành.</p><Link to="/" className="button primary">Về trang chủ</Link></section>
}
