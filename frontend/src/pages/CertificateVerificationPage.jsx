import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'
import { activityTime } from '../api/activityFormat.js'
import { duration } from '../api/documentFormat.js'
import '../styles/documents.css'

function Result({ id }) {
  const { data, loading, error, retry } = useApi(`/certificates/${id}/verify/`)
  return <><RequestState loading={loading} error={error?.status === 404 ? { ...error, message: 'Không tìm thấy chứng nhận với mã này.' } : error} retry={retry} />
    {data && <article className="activity-card verification-result"><h2>{data.status === 'valid' ? 'Chứng nhận còn hiệu lực' : 'Chứng nhận đã bị thu hồi'}</h2>
      {data.status === 'revoked' && <p className="request-error">Chứng nhận này không còn hợp lệ. Thời điểm thu hồi: {activityTime(data.revoked_at)}.</p>}
      <dl><dt>Người được chứng nhận</dt><dd>{data.volunteer_name}</dd><dt>Hoạt động</dt><dd>{data.activity_title}</dd><dt>Nhà tổ chức</dt><dd>{data.organization_name}</dd><dt>Đóng góp ghi trên chứng nhận</dt><dd>{duration(data.minutes)}</dd><dt>Ngày cấp</dt><dd>{activityTime(data.issued_at)}</dd><dt>Mã chứng nhận</dt><dd>{data.id}</dd></dl>
      <button className="text-button" onClick={retry}>Kiểm tra lại hiệu lực</button>
    </article>}
  </>
}

export default function CertificateVerificationPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState(id || '')
  const [error, setError] = useState('')
  function submit(event) {
    event.preventDefault(); const value = code.trim().toLowerCase()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) { setError('Nhập đúng mã chứng nhận dạng UUID in trên chứng nhận.'); return }
    setError(''); navigate(`/tra-cuu-chung-nhan/${value}`)
  }
  return <section className="page-width section interior activity-page"><h1>Tra cứu chứng nhận</h1><p>Nhập mã trên chứng nhận hoặc quét QR để kiểm tra thông tin và hiệu lực hiện tại.</p>
    <form className="activity-search" onSubmit={submit}><label htmlFor="verify-code">Mã chứng nhận</label><input id="verify-code" value={code} maxLength={36} required onChange={event => setCode(event.target.value)} /><button className="button primary">Tra cứu</button></form>
    {error && <p role="alert" className="request-error">{error}</p>}{id && <Result key={id} id={id} />}
  </section>
}
