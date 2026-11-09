import { useCallback, useId, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Camera, CheckCircle2, Keyboard, QrCode, RefreshCw } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import useNow from '../hooks/useNow.js'
import { activityTime } from '../api/activityFormat.js'
import { apiPost } from '../api/client.js'
import RequestState from '../components/RequestState.jsx'
import CheckInCamera from '../components/CheckInCamera.jsx'
import ImagePasteInput from '../components/ImagePasteInput.jsx'
import '../styles/checkin.css'
import '../styles/volunteer-checkin.css'

const exactTime = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))

function CheckInSuccess({ entry, attendance }) {
  const now = useNow()
  return <div className="vci-success" role="status">
    <CheckCircle2 className="vci-success-icon" size={32} aria-hidden="true" />
    <div><h2>Đã xác nhận có mặt</h2>
      <p>Bạn đã check-in thành công.</p>
      <p className="vci-success-activity">{entry.activity.title}</p>
      <dl><div><dt>Thời gian điểm danh</dt><dd><time dateTime={attendance.confirmed_at} title={exactTime(attendance.confirmed_at)} aria-label={exactTime(attendance.confirmed_at)}>{activityTime(attendance.confirmed_at, now)}</time></dd></div>
        <div><dt>{attendance.method && attendance.method !== 'manual' ? 'Người check-in' : 'Người xác nhận'}</dt><dd>{attendance.confirmed_by_name || 'Nhà tổ chức'}</dd></div>
        {attendance.method && attendance.method !== 'manual' && <div><dt>Hình thức</dt><dd>{attendance.method === 'qr' ? 'Quét QR' : 'Nhập mã'}</dd></div>}
      </dl>
      {entry.activity.status === 'cancelled' && <p>Hoạt động đã bị hủy sau khi ghi nhận có mặt. Bản ghi được giữ để đối chiếu.</p>}
      <Link className="button primary" to="/tinh-nguyen-vien/lich-su">Xem lịch sử hoạt động</Link>
    </div>
  </div>
}

function CheckInForm({ entry, busy, setBusy, onConfirmed }) {
  const [mode, setMode] = useState('qr')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const modeRef = useRef(mode)
  const tabs = useRef({})
  const prefix = useId()
  const id = entry.activity.id
  const now = useNow()
  const acceptQR = useCallback(value => {
    if (modeRef.current !== 'qr') return
    setScanning(false); setError(''); setToken('')
    const match = /^vconnect:checkin:([a-f0-9-]{36}):([a-f0-9]{64})$/.exec(value)
    if (!match || match[1] !== id) { setError('QR không hợp lệ hoặc thuộc hoạt động khác. Hãy quét mã do Nhà tổ chức của hoạt động này cung cấp.'); return }
    setToken(match[2]); setCode('')
  }, [id])
  function selectMode(next, focus = false) {
    if (busy) return
    if (next === mode) { if (focus) tabs.current[next]?.focus(); return }
    modeRef.current = next
    setMode(next); setCode(''); setToken(''); setError(''); setScanning(false)
    if (focus) tabs.current[next]?.focus()
  }
  function tabKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    selectMode(event.key === 'Home' ? 'qr' : event.key === 'End' ? 'code' : mode === 'qr' ? 'code' : 'qr', true)
  }
  async function readImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    await scanImage(file)
  }
  async function scanImage(file) {
    if (busy || scanning || modeRef.current !== 'qr' || !file) return
    setError(''); setToken('')
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
    event.preventDefault()
    if (busy || scanning || (mode === 'qr' ? !token : code.length !== 8)) return
    setBusy(true); setError(''); setScanning(false)
    try {
      const result = await apiPost(`/activities/${id}/check-in/`, mode === 'qr' ? { token } : { code })
      onConfirmed(result)
      setToken(''); setCode('')
      window.dispatchEvent(new Event('notifications:changed'))
    } catch (problem) { setError(problem.message) }
    finally { setBusy(false) }
  }
  let unavailable
  if (entry.status !== 'approved') unavailable = 'Bạn cần có đăng ký được duyệt để check-in.'
  else if (entry.activity.status !== 'published') unavailable = 'Hoạt động không còn mở check-in.'
  else if (!entry.activity.time_checks_disabled && now < new Date(entry.activity.starts_at)) unavailable = 'Chưa đến thời gian điểm danh.'
  else if (!entry.activity.time_checks_disabled && now > new Date(entry.activity.ends_at)) unavailable = 'Đã hết thời gian điểm danh.'
  if (unavailable) return <div className="vci-unavailable" role="status"><h2>{unavailable}</h2>
    {entry.status === 'approved' && entry.activity.status === 'published' && <p>Thời gian mở: <time dateTime={entry.activity.starts_at} title={exactTime(entry.activity.starts_at)}>{activityTime(entry.activity.starts_at, now)}</time> đến <time dateTime={entry.activity.ends_at} title={exactTime(entry.activity.ends_at)}>{activityTime(entry.activity.ends_at, now)}</time>.</p>}
    <Link className="button secondary" to="/tinh-nguyen-vien/check-in">Về điểm danh của tôi</Link>
  </div>
  return <form className="checkin-form vci-form" onSubmit={submit} aria-busy={busy}>
    <p className="vci-instruction">Dùng QR hoặc mã 8 chữ số do nhà tổ chức cung cấp tại hoạt động.</p>
    <div className="vci-tabs" role="tablist" aria-label="Cách điểm danh">
      {[['qr', 'Quét QR', QrCode], ['code', 'Nhập mã', Keyboard]].map(([value, label, Icon]) => <button key={value} type="button" role="tab" id={`${prefix}-tab-${value}`} aria-controls={`${prefix}-panel`} aria-selected={mode === value} tabIndex={mode === value ? 0 : -1} ref={node => { tabs.current[value] = node }} disabled={busy} onClick={() => selectMode(value)} onKeyDown={tabKey}><Icon size={18} aria-hidden="true" />{label}</button>)}
    </div>
    <div id={`${prefix}-panel`} role="tabpanel" aria-labelledby={`${prefix}-tab-${mode}`} className="vci-panel">
      {mode === 'qr' ? <>
        <p>Quét bằng camera hoặc dùng ảnh QR.</p>
        {!scanning && <button type="button" className="button secondary vci-camera-open" disabled={busy} onClick={() => { setError(''); setToken(''); setScanning(true) }}><Camera size={18} aria-hidden="true" />Mở camera quét QR</button>}
        {scanning && <CheckInCamera onRead={acceptQR} onClose={() => setScanning(false)} />}
        <ImagePasteInput compact groupLabel="Ảnh mã QR" label="Dán ảnh QR" onImage={scanImage} disabled={busy || scanning}>
          <label className="button secondary checkin-file">Chọn ảnh QR<input type="file" aria-label="Chọn ảnh QR" accept="image/png,image/jpeg,image/webp" disabled={busy || scanning} onChange={readImage} /></label>
        </ImagePasteInput>
        {token && <p className="vci-qr-ready" role="status"><CheckCircle2 size={18} aria-hidden="true" />Đã nhận QR của hoạt động. Bấm xác nhận để check-in.</p>}
      </> : <div className="activity-field"><label htmlFor={`${prefix}-code`}>Mã check-in (8 chữ số)</label><input id={`${prefix}-code`} value={code} inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" required disabled={busy} aria-describedby={`${prefix}-code-hint`} onChange={event => { setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 8)); setError('') }} /><p id={`${prefix}-code-hint`}>Nhập mã đang hiển thị tại hoạt động.</p></div>}
    </div>
    {error && <p className="request-error" role="alert">{error}</p>}
    <div className="vci-confirm"><button className="button primary" disabled={busy || scanning || (mode === 'qr' ? !token : code.length !== 8)}>{busy ? 'Đang xử lý…' : 'Xác nhận check-in'}</button><p>Chỉ ghi nhận có mặt khi bạn nhấn xác nhận.</p></div>
  </form>
}

export default function CheckInPage() {
  const { id } = useParams()
  const { data, loading, error, retry } = useApi(`/activities/${id}/participation/`)
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const confirmed = confirmation?.id === id ? confirmation : null
  const entry = data?.participation || confirmed?.entry
  const attendance = entry?.attendance || confirmed?.attendance
  return <section className="page-width section interior checkin-page volunteer-checkin">
    <header className="activity-toolbar vci-heading"><h1>Check-in hoạt động</h1><button type="button" className="button secondary refresh-button" disabled={loading || busy} onClick={retry}><RefreshCw size={15} aria-hidden="true" />Làm mới</button></header>
    <RequestState loading={loading} error={error} retry={retry} />
    {attendance && entry ? <CheckInSuccess entry={entry} attendance={attendance} /> : data?.participation ? <><h2 className="vci-activity-title">{entry.activity.title}</h2><CheckInForm key={id} entry={entry} busy={busy} setBusy={setBusy} onConfirmed={result => setConfirmation({ id, entry, attendance: result })} /></>
      : data && <div className="vci-unavailable" role="status"><p>Bạn chưa đăng ký hoạt động này.</p><Link className="button secondary" to={`/hoat-dong/${id}`}>Xem hoạt động</Link></div>}
  </section>
}
