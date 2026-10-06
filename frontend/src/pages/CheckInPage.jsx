import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import useNow from '../hooks/useNow.js'
import { activityTime } from '../api/activityFormat.js'
import { apiPost } from '../api/client.js'
import RequestState from '../components/RequestState.jsx'
import AttendanceStatus from '../components/AttendanceStatus.jsx'
import CheckInCamera from '../components/CheckInCamera.jsx'
import '../styles/checkin.css'

function CheckInForm({ entry }) {
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [attendance, setAttendance] = useState(entry.attendance)
  const id = entry.activity.id
  const now = useNow()
  const acceptQR = useCallback(value => {
    setScanning(false); setError(''); setToken('')
    const match = /^vconnect:checkin:([a-f0-9-]{36}):([a-f0-9]{64})$/.exec(value)
    if (!match || match[1] !== id) { setError('QR không hợp lệ hoặc thuộc hoạt động khác. Hãy quét mã do Nhà tổ chức của hoạt động này cung cấp.'); return }
    setToken(match[2]); setCode('')
  }, [id])
  async function readImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(''); setToken(''); setScanning(false)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Chọn ảnh PNG, JPEG hoặc WebP không quá 5 MB.'); return
    }
    setBusy(true)
    try {
      const { default: QrScanner } = await import('qr-scanner')
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true })
      acceptQR(result.data)
    } catch { setError('Không đọc được QR trong ảnh. Hãy chọn ảnh rõ hơn hoặc nhập mã.') }
    finally { setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setScanning(false)
    try {
      const result = await apiPost(`/activities/${id}/check-in/`, token ? { token } : { code })
      setAttendance(result); setToken(''); setCode('')
      window.dispatchEvent(new Event('notifications:changed'))
    } catch (problem) { setError(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  if (attendance) return <><p role="status">Bạn đã check-in thành công.</p><AttendanceStatus entry={{ ...entry, attendance }} /><Link to="/tinh-nguyen-vien/lich-su">Xem lịch sử tham gia</Link></>
  if (entry.status !== 'approved') return <p>Bạn cần có đăng ký được duyệt để check-in.</p>
  if (entry.activity.status !== 'published') return <p>Hoạt động không còn mở check-in.</p>
  if (now < new Date(entry.activity.starts_at) || now >= new Date(entry.activity.ends_at)) return <p>Check-in chỉ mở từ {activityTime(entry.activity.starts_at)} đến {activityTime(entry.activity.ends_at)} (giờ Việt Nam).</p>
  return <form className="checkin-form" onSubmit={submit}>
    <p>Tại hoạt động, quét QR hoặc nhập mã 8 chữ số do Nhà tổ chức cung cấp, sau đó xác nhận check-in.</p>
    <div className="activity-actions"><button type="button" className="button secondary" disabled={busy || scanning} onClick={() => { setError(''); setScanning(true) }}>Mở camera quét QR</button>
      <label className="button secondary checkin-file">Chọn ảnh QR<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || scanning} onChange={readImage} /></label></div>
    {scanning && <CheckInCamera onRead={acceptQR} onClose={() => setScanning(false)} />}
    {token ? <div className="activity-empty"><p>Đã nhận QR của hoạt động. Bấm xác nhận để check-in.</p><button className="text-button" type="button" disabled={busy} onClick={() => setToken('')}>Dùng mã nhập thay thế</button></div>
      : <div className="activity-field"><label htmlFor="checkin-code">Mã check-in (8 chữ số)</label><input id="checkin-code" value={code} inputMode="numeric" autoComplete="off" maxLength={8} pattern="[0-9]{8}" required disabled={busy} onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '')); setError('') }} /></div>}
    {error && <p className="request-error" role="alert">{error}</p>}
    <button className="button primary" disabled={busy || scanning || (!token && code.length !== 8)}>{busy ? 'Đang xử lý…' : 'Xác nhận check-in'}</button>
  </form>
}

export default function CheckInPage() {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`/activities/${id}/participation/`)
  return <section className="page-width section interior checkin-page">
    <Link to={`/hoat-dong/${id}`}>← Về hoạt động</Link><h1>Check-in hoạt động</h1>
    <RequestState loading={loading} error={error} retry={retry} />
    {data?.participation ? <><h2>{data.participation.activity.title}</h2><CheckInForm key={id} entry={data.participation} /></>
      : data && <p>Bạn chưa đăng ký hoạt động này.</p>}
  </section>
}
