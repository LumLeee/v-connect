import { useEffect, useState } from 'react'
import useApi from '../hooks/useApi.js'
import { apiPost } from '../api/client.js'
import RequestState from './RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import '../styles/checkin.css'

function ActiveCode({ data }) {
  const [image, setImage] = useState('')
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((new Date(data.expires_at) - new Date(data.server_time)) / 1000)))
  useEffect(() => {
    const deadline = performance.now() + Math.max(0, new Date(data.expires_at) - new Date(data.server_time))
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - performance.now()) / 1000))), 500)
    return () => clearInterval(timer)
  }, [data.expires_at, data.server_time])
  useEffect(() => {
    let cancelled = false
    import('qrcode').then(module => module.default.toDataURL(data.qr_value, { width: 320, margin: 4, errorCorrectionLevel: 'M' }))
      .then(value => { if (!cancelled) setImage(value) })
      .catch(() => { if (!cancelled) setError('Không tạo được ảnh QR. Bạn vẫn có thể dùng mã nhập bên dưới.') })
    return () => { cancelled = true }
  }, [data.qr_value])
  if (!remaining) return <p role="status">Mã đã hết hạn. Hãy tạo mã mới để tiếp tục điểm danh.</p>
  return <div className="active-attendance-code">
    {image && <img src={image} alt="QR check-in hoạt động" width="320" height="320" />}
    {error && <p role="alert">{error}</p>}
    <div><p>Mã nhập dự phòng</p><strong className="attendance-short-code" data-testid="attendance-code">{data.code}</strong>
      <p>Còn {Math.floor(remaining / 60)} phút {remaining % 60} giây.</p><p>Hết hạn: {activityTime(data.expires_at)} (giờ Việt Nam).</p></div>
  </div>
}

export default function AttendanceCodePanel({ id, open }) {
  const { data, loading, error, retry } = useApi(`/organizer/activities/${id}/attendance-code/`)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  async function change(revoke = false) {
    setBusy(true); setFailure('')
    try { await apiPost(`/organizer/activities/${id}/attendance-code/${revoke ? 'revoke/' : ''}`, {}); retry() }
    catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  return <section className="attendance-code-panel" aria-label="Mã check-in">
    <h2>Check-in bằng QR hoặc mã</h2>
    <p>Hiển thị mã tại hoạt động để người đã được duyệt tự check-in trên website. Mã có hạn tối đa 5 phút; tạo mã mới sẽ vô hiệu hóa mã cũ.</p>
    <RequestState loading={loading} error={error} retry={retry} />
    {failure && <p className="request-error" role="alert">{failure}</p>}
    {data?.active && open && <ActiveCode key={data.qr_value + data.server_time} data={data} />}
    {data && !data.active && <p>Hiện không có mã còn hiệu lực.</p>}
    <div className="activity-actions"><button className="button primary" disabled={busy || !open} onClick={() => change()}>Tạo mã mới</button>
      <button className="button secondary" disabled={busy || !data?.active} onClick={() => change(true)}>Thu hồi mã</button>
      <button className="text-button" disabled={busy} onClick={retry}>Cập nhật mã hiện tại</button></div>
  </section>
}
