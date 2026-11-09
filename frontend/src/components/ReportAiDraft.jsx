import { useId, useState } from 'react'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import ConfirmationDialog from './ConfirmationDialog.jsx'
import LocalAiStatus from './LocalAiStatus.jsx'
import '../styles/local-ai.css'

const fullTime = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))

export default function ReportAiDraft({ id, sourceData, disabled = false }) {
  const formId = useId()
  const [result, setResult] = useState(null)
  const [draft, setDraft] = useState(null)
  const [snapshot, setSnapshot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [manualCopy, setManualCopy] = useState(false)
  const [sourceInvalid, setSourceInvalid] = useState(false)
  const currentSource = sourceData ? JSON.stringify({ activity: sourceData.activity, metrics: sourceData.metrics, contributions: sourceData.contributions }) : null
  const stale = sourceInvalid || Boolean(result && currentSource && (sourceData.source_fingerprint && result.source?.summary_fingerprint
    ? sourceData.source_fingerprint !== result.source.summary_fingerprint : currentSource !== snapshot))
  const edited = Boolean(draft && result && JSON.stringify(draft) !== JSON.stringify(result.draft))
  const copyText = draft ? [draft.title, ...draft.sections.map(section => `${section.title}\n${section.text}`), `Số liệu được lấy lúc ${fullTime(result.generated_at)}. Bản nháp cần được người lập rà soát trước khi sử dụng.`].join('\n\n') : ''
  async function generate() {
    setBusy(true); setError(''); setMessage(''); setManualCopy(false)
    try {
      const response = await apiPost(`/reports/activities/${id}/ai-draft/`, sourceData.source_fingerprint ? { expected_source_fingerprint: sourceData.source_fingerprint } : {})
      setResult(response); setDraft(response.draft); setSnapshot(currentSource); setSourceInvalid(false); setConfirm(false)
    } catch (failure) { setError(failure.message); if ([403, 404, 409].includes(failure.status)) setSourceInvalid(true) }
    finally { setBusy(false) }
  }
  async function copy() {
    setMessage('')
    try {
      await navigator.clipboard.writeText(copyText)
      setMessage('Đã sao chép bản nháp đã chỉnh sửa cùng thời điểm lấy số liệu.')
    } catch {
      setManualCopy(true)
      setMessage('Trình duyệt chưa cho phép sao chép. Hãy chọn nội dung trong ô bên dưới rồi nhấn Ctrl+C hoặc ⌘C.')
    }
  }
  function changeSection(index, text) {
    setDraft(value => ({ ...value, sections: value.sections.map((section, position) => position === index ? { ...section, text } : section) }))
    setMessage('')
  }
  return <section id="ban-nhap-ai" className="local-ai-panel report-ai-panel" aria-labelledby="report-ai-heading" aria-busy={busy}>
    <div className="local-ai-heading"><div><h2 id="report-ai-heading">Bản nháp báo cáo bằng AI</h2><p>Soạn nhận xét từ số liệu hệ thống và phản hồi gốc. Bạn có thể chỉnh sửa, rà soát rồi sao chép để hoàn thiện báo cáo.</p></div>
      <button type="button" className="button secondary" disabled={disabled || busy} onClick={() => edited ? setConfirm(true) : generate()}>{busy ? 'Đang soạn…' : result ? 'Tạo lại bản nháp' : 'Soạn bản nháp AI'}</button>
    </div>
    {error && !confirm && <p className="request-error" role="alert">{error}</p>}
    {confirm && <ConfirmationDialog title="Tạo lại bản nháp" busy={busy} onClose={() => setConfirm(false)}>
      {error && <p className="request-error" role="alert">{error}</p>}
      <p>Bản nháp mới sẽ thay thế nội dung bạn đã chỉnh sửa. Nội dung hiện tại được giữ lại nếu yêu cầu tạo lại gặp lỗi.</p>
      <div className="report-ai-actions"><button type="button" className="button primary" disabled={busy} onClick={generate}>Xác nhận tạo lại</button><button type="button" className="button secondary" disabled={busy} onClick={() => setConfirm(false)}>Giữ bản đang sửa</button></div>
    </ConfirmationDialog>}
    {result && <>
      <LocalAiStatus ai={result.ai} purpose="AI chọn trích dẫn liên quan; phần nhận xét được ghép từ số liệu có căn cứ. Mô hình này không tự viết thêm sự kiện hoặc xác nhận kết quả ngoài dữ liệu." />
      <p className="local-ai-source">Bản nháp dựa trên số liệu lấy lúc <time dateTime={result.generated_at}>{activityTime(result.generated_at)}</time>. Hãy kiểm tra nội dung trước khi sử dụng.</p>
      {result.source && <p className="report-ai-source-facts"><span>{result.source.feedback_count} phản hồi hợp lệ</span><span>{result.source.analyzed_count} phản hồi được xem trong bản nháp</span></p>}
      {result.source?.truncated && <p className="report-ai-warning" role="status">Phần phản hồi chỉ dùng một phần dữ liệu do giới hạn xử lý. Số liệu tổng hợp vẫn được lấy từ hệ thống.</p>}
      {stale && <p className="report-ai-warning" role="alert">Số liệu đang xem đã thay đổi so với lúc tạo bản nháp. Nội dung bạn sửa được giữ lại; hãy tạo lại và rà soát trước khi sao chép.</p>}
      {draft && <div className="report-ai-editor">
        <div className="report-ai-field"><label htmlFor={`${formId}-title`}>Tiêu đề bản nháp</label><input id={`${formId}-title`} value={draft.title} disabled={busy} onChange={event => { setDraft(value => ({ ...value, title: event.target.value })); setMessage('') }} /></div>
        {draft.sections.map((section, index) => <div className="report-ai-field" key={section.key}><label htmlFor={`${formId}-${index}`}>{section.title}</label><textarea id={`${formId}-${index}`} rows={Math.min(10, Math.max(4, Math.ceil(section.text.length / 100)))} value={section.text} disabled={busy} onChange={event => changeSection(index, event.target.value)} /></div>)}
      </div>}
      {!!result.evidence?.length && <details className="local-ai-notes"><summary>Phản hồi làm căn cứ ({result.evidence.length})</summary><ul className="report-ai-evidence">{result.evidence.map((item, index) => <li key={`${item.feedback_id}-${index}`}><span>Đánh giá {item.rating}/5</span><blockquote>{item.quote}</blockquote></li>)}</ul></details>}
      {!!result.limitations?.length && <details className="local-ai-notes"><summary>Cách sử dụng bản nháp và giới hạn</summary><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
      {draft && <div className="report-ai-actions"><button type="button" className="button primary" disabled={disabled || busy || stale} onClick={copy}>Sao chép bản nháp</button><p>{edited ? 'Đã chỉnh sửa trên trang này.' : 'Bạn có thể sửa trực tiếp các đoạn ở trên.'} Bản nháp chưa được lưu vào hệ thống.</p></div>}
      {message && <p role="status" className="local-ai-source">{message}</p>}
      {manualCopy && !stale && <div className="report-ai-field"><label htmlFor={`${formId}-copy`}>Nội dung để sao chép thủ công</label><textarea id={`${formId}-copy`} readOnly rows={8} value={copyText} onFocus={event => event.target.select()} /></div>}
    </>}
  </section>
}
