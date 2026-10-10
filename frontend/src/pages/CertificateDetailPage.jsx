import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import useApi from '../hooks/useApi.js'
import { apiGet, apiPost } from '../api/client.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import { duration } from '../api/documentFormat.js'
import '../styles/documents.css'

export default function CertificateDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, loading, error, retry } = useApi(`/certificates/${id}/`)
  const [qr, setQr] = useState('')
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const url = `${window.location.origin}/tra-cuu-chung-nhan/${id}`
  useEffect(() => { let active = true; setQr(''); import('qrcode').then(module => module.default.toDataURL(url, { width: 180, margin: 2 })).then(value => { if (active) setQr(value) }).catch(() => { if (active) setFailure('Không tạo được QR. Bạn vẫn có thể tra cứu bằng mã chứng nhận.') }); return () => { active = false } }, [url])
  async function revoke(event) {
    event.preventDefault(); setBusy(true); setFailure('')
    try { await apiPost(`/certificates/${id}/revoke/`, { reason }); setConfirm(false); setReason(''); retry() }
    catch (problem) { setFailure(Object.values(problem.details?.error?.details || {}).flat().join(' ') || problem.message) }
    finally { setBusy(false) }
  }
  async function print() {
    setBusy(true); setFailure('')
    try { const latest = await apiGet(`/certificates/${id}/`); if (latest.status !== 'valid') { retry(); setFailure('Chứng nhận đã bị thu hồi. Không thể in bản còn hiệu lực.'); return } window.print() }
    catch (problem) { setFailure(problem.message) }
    finally { setBusy(false) }
  }
  return <section className="page-width section interior document-page certificate-page">
    <div className="no-print"><Link className="activity-back" to={user.role === 'volunteer' ? '/tinh-nguyen-vien/chung-nhan' : '/bao-cao/chung-nhan'}>← Về danh sách chứng nhận</Link><h1>Xem chứng nhận đóng góp</h1>
      <p>Chọn In / Lưu PDF rồi chọn “Lưu dưới dạng PDF” trong hộp thoại in. Tra cứu mã để kiểm tra hiệu lực hiện tại.</p>
      <RequestState loading={loading} error={error} retry={retry} />{failure && <p role="alert" className="request-error">{failure}</p>}
      {data && <div className="activity-actions"><button className="button primary" disabled={busy || data.status !== 'valid' || !qr} onClick={print}>In / Lưu PDF</button><Link className="button secondary" to={`/tra-cuu-chung-nhan/${id}`}>Tra cứu công khai</Link><button className="text-button" onClick={retry}>Cập nhật trạng thái</button>
        {user.role !== 'volunteer' && data.status === 'valid' && <button className="button secondary" disabled={busy} onClick={() => setConfirm(true)}>Thu hồi chứng nhận</button>}
      </div>}
      {confirm && <form className="activity-confirm" onSubmit={revoke}><h2>Xác nhận thu hồi chứng nhận</h2><label htmlFor="certificate-reason">Lý do thu hồi</label><textarea id="certificate-reason" value={reason} maxLength={1000} required disabled={busy} onChange={event => setReason(event.target.value)} /><button className="button primary" disabled={busy || !reason.trim()}>Xác nhận thu hồi</button>{' '}<button type="button" className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</button></form>}
      {data?.status === 'revoked' && <p className="request-error">Đã thu hồi: {data.revocation_reason}</p>}
    </div>
    {data && <article className="document-sheet certificate-sheet">
      <div className="document-brand">V-CONNECT · KẾT NỐI TÌNH NGUYỆN</div>
      <p className={`certificate-status ${data.status}`}>{data.status === 'valid' ? 'CÒN HIỆU LỰC TẠI THỜI ĐIỂM TRA CỨU' : 'ĐÃ THU HỒI — KHÔNG CÒN HIỆU LỰC'}</p>
      <h2>CHỨNG NHẬN ĐÓNG GÓP</h2><p>Trân trọng ghi nhận</p><h3 className="certificate-recipient">{data.volunteer_name}</h3>
      <p>Đã tham gia và đóng góp cho hoạt động</p><h3>{data.activity_title}</h3><p>Đơn vị tổ chức: <strong>{data.organization_name}</strong></p>
      <p>{activityTime(data.starts_at)} — {activityTime(data.ends_at)} (giờ Việt Nam)</p><p className="certificate-hours">Thời gian được xác nhận: <strong>{duration(data.minutes)}</strong></p>
      <div className="certificate-bottom"><div><p>Ngày cấp: {activityTime(data.issued_at)}</p><p>Người cấp trên hệ thống: {data.issued_by_name}</p><p className="certificate-code">Mã chứng nhận: {data.id}</p><p className="muted">Chứng nhận điện tử do V-Connect ghi nhận. Quét QR hoặc truy cập liên kết để kiểm tra hiệu lực hiện tại.</p><p className="certificate-code">{url}</p></div>{qr && <img src={qr} width="140" height="140" alt="QR tra cứu chứng nhận" />}</div>
    </article>}
  </section>
}
