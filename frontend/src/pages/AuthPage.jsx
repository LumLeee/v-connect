import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { apiPost } from '../api/client.js'
import { useAuth, workspacePaths } from '../auth/context.js'

const titles = { login: 'Chào mừng bạn trở lại.', register: 'Bắt đầu hành trình của bạn.', forgot: 'Bạn quên mật khẩu?', reset: 'Tạo mật khẩu mới.' }
const descriptions = { login: 'Đăng nhập để tiếp tục kết nối và sẻ chia.', register: 'Tạo tài khoản để cùng làm những điều có ý nghĩa.', forgot: 'Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu.', reset: 'Chọn mật khẩu mới để bảo vệ tài khoản V-Connect của bạn.' }

export default function AuthPage({ mode }) {
  const { user, acceptUser } = useAuth()
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [visible, setVisible] = useState(false)
  const details = error?.details?.error?.details || {}
  const fieldError = (name) => details[name] ? <small className="field-error" id={`${name}-error`}>{[].concat(details[name]).join(' ')}</small> : null
  if (user && (mode === 'login' || mode === 'register')) return <Navigate to={workspacePaths[user.role]} replace />

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    const form = new FormData(event.currentTarget)
    const payload = Object.fromEntries(form)
    if (mode === 'login') payload.remember = form.has('remember')
    if (mode === 'reset') { payload.uid = uid; payload.token = token }
    const endpoint = { login: 'login/', register: 'register/', forgot: 'password-reset/', reset: 'password-reset/confirm/' }[mode]
    try {
      const result = await apiPost(`/auth/${endpoint}`, payload)
      if (result.user) { acceptUser(result.user); navigate(workspacePaths[result.user.role], { replace: true }) }
      else { setSuccess(result.message); if (mode === 'reset') acceptUser(null) }
    } catch (failure) { setError(failure) }
    finally { setBusy(false) }
  }

  return <section className="page-width auth-section">
    <aside className="auth-intro"><p className="eyebrow">KẾT NỐI ĐỂ SẺ CHIA</p><h1>Điều tốt đẹp{' '}<br />bắt đầu từ <em>bạn.</em></h1><p>Một cộng đồng, nhiều cách đóng góp.<br />Tìm hành trình phù hợp với chính mình.</p><div className="auth-promise"><ShieldCheck size={25} /><span>Thông tin tài khoản được bảo vệ.<br />Bạn luôn chủ động với hành trình của mình.</span></div></aside>
    <div className="auth-card"><h2>{titles[mode]}</h2><p>{descriptions[mode]}</p>
      {success ? <div role="status" className="auth-success"><p>{success}</p><Link className="button primary" to="/dang-nhap">Về đăng nhập <ArrowRight size={16} /></Link></div> : <form onSubmit={submit}>
        {error && <div className="request-error" role="alert">{details.detail || details.non_field_errors?.join(' ') || error.message}{details.token && <span>{[].concat(details.token).join(' ')} <Link to="/quen-mat-khau">Yêu cầu liên kết mới</Link></span>}</div>}
        {mode === 'register' && <><label className="form-field">Họ và tên<input name="full_name" autoComplete="name" maxLength={150} required aria-invalid={!!details.full_name} aria-describedby={details.full_name ? 'full_name-error' : undefined} /></label>{fieldError('full_name')}<fieldset className="role-choice" aria-describedby={details.role ? 'role-error' : undefined}><legend>Bạn muốn tham gia với vai trò</legend><label><input type="radio" name="role" value="volunteer" defaultChecked />Tình nguyện viên</label><label><input type="radio" name="role" value="organizer" />Nhà tổ chức</label></fieldset>{fieldError('role')}</>}
        {mode === 'login' ? <><label className="form-field">Email hoặc username Admin<input type="text" name="identifier" autoComplete="username" maxLength={254} required aria-invalid={!!details.identifier} aria-describedby={details.identifier ? 'identifier-error' : undefined} /></label>{fieldError('identifier')}</>
          : mode !== 'reset' && <><label className="form-field">Email<input type="email" name="email" autoComplete="email" maxLength={254} required aria-invalid={!!details.email} aria-describedby={details.email ? 'email-error' : undefined} /></label>{fieldError('email')}</>}
        {mode !== 'forgot' && <><label className="form-field" htmlFor="password">Mật khẩu</label><div className="password-input"><input id="password" name="password" type={visible ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} maxLength={128} required aria-invalid={!!details.password} aria-describedby={[mode !== 'login' && 'password-hint', details.password && 'password-error'].filter(Boolean).join(' ') || undefined} /><button type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{fieldError('password')}{mode !== 'login' && <><small className="password-hint" id="password-hint">Ít nhất 8 ký tự; không chỉ gồm số hoặc quá giống thông tin cá nhân.</small><label className="form-field">Xác nhận mật khẩu<input name="password_confirm" type={visible ? 'text' : 'password'} autoComplete="new-password" maxLength={128} required aria-invalid={!!details.password_confirm} aria-describedby={details.password_confirm ? 'password_confirm-error' : undefined} /></label>{fieldError('password_confirm')}</>}</>}
        {mode === 'login' && <div className="form-options"><label><input type="checkbox" name="remember" />Ghi nhớ 14 ngày</label><Link to="/quen-mat-khau">Quên mật khẩu?</Link></div>}
        <button className="button primary auth-submit" disabled={busy}>{busy ? 'Đang xử lý…' : { login: 'Đăng nhập', register: 'Tạo tài khoản', forgot: 'Gửi hướng dẫn', reset: 'Lưu mật khẩu mới' }[mode]}<ArrowRight size={17} /></button>
      </form>}
      {!success && <p className="auth-switch">{mode === 'login' ? <>Chưa có tài khoản? <Link to="/dang-ky">Đăng ký ngay</Link></> : <Link to="/dang-nhap">Quay lại đăng nhập</Link>}</p>}
    </div>
  </section>
}
