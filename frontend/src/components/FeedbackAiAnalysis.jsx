import { useState } from 'react'
import { apiPost } from '../api/client.js'
import { activityTime } from '../api/activityFormat.js'
import LocalAiStatus from './LocalAiStatus.jsx'
import '../styles/local-ai.css'

export default function FeedbackAiAnalysis({ endpoint, filters, scopeLabel, disabled = false }) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function analyze() {
    setBusy(true); setError('')
    try { setResult(await apiPost(endpoint, filters)) }
    catch (failure) { setResult(null); setError(failure.message) }
    finally { setBusy(false) }
  }
  return <section className="local-ai-panel feedback-ai-panel" aria-labelledby="feedback-ai-heading" aria-busy={busy}>
    <div className="local-ai-heading">
      <div><h2 id="feedback-ai-heading">Phân tích phản hồi bằng AI</h2><p>Nhận diện sắc thái, chủ đề và nội dung cần xem lại. Mọi quyết định xử lý vẫn do bạn thực hiện.</p></div>
      <button type="button" className="button secondary" disabled={disabled || busy} onClick={analyze}>{busy ? 'Đang phân tích…' : result ? 'Phân tích lại' : 'Phân tích AI'}</button>
    </div>
    <p className="local-ai-source">Phạm vi: {scopeLabel}, trên tất cả các trang trong bộ lọc hiện tại.</p>
    {error && <p className="request-error" role="alert">{error}</p>}
    {result && <>
      <LocalAiStatus ai={result.ai} purpose="Mô hình đa ngôn ngữ so sánh ý nghĩa với các nhóm nội dung mẫu. Nhãn là gợi ý, có thể sai với phủ định, mỉa mai hoặc nội dung thiếu ngữ cảnh." />
      <p className="local-ai-source">Đã xem {result.scope.analyzed_count}/{result.scope.feedback_count} phản hồi trong phạm vi đã chọn. Lấy dữ liệu lúc <time dateTime={result.generated_at}>{activityTime(result.generated_at)}</time>.</p>
      {result.scope.truncated && <p className="report-ai-warning" role="status">Đã đạt giới hạn phân tích trong một lần. Kết quả chỉ phản ánh các phản hồi đã xem, không đại diện cho toàn bộ danh sách.</p>}
      {!!result.sentiments?.length && <dl className="feedback-ai-counts" aria-label={result.ai?.status === 'active' ? 'Sắc thái phản hồi do AI gợi ý' : 'Trạng thái phân loại phản hồi'}>{result.sentiments.map(item => <div key={item.key}><dt>{item.label}</dt><dd>{item.count}</dd></div>)}</dl>}
      {result.summary?.text && <div className="feedback-ai-summary"><h3>Trích dẫn tham khảo</h3><p className="activity-description">{result.summary.text}</p></div>}
      {!!result.topics?.length && <div><h3>Chủ đề được nhắc đến</h3><div className="feedback-ai-topics" aria-label="Chủ đề phản hồi">{result.topics.map(item => <span key={item.key}>{item.label}: {item.count}</span>)}</div></div>}
      {!!result.summary?.evidence?.length && <details className="feedback-ai-evidence"><summary>Phản hồi làm căn cứ cho trích dẫn</summary><ul>{result.summary.evidence.map((item, index) => <li key={`${item.feedback_id}-${index}`}><blockquote>{item.quote}</blockquote></li>)}</ul></details>}
      {!!result.review_items?.length && <details className="feedback-ai-evidence"><summary>Nội dung cần bạn xem lại ({result.review_items.length})</summary><ul>{result.review_items.map(item => <li key={item.feedback_id}>
        <h3>{item.label}</h3><blockquote>{item.content}</blockquote><p>{item.reason}</p>
      </li>)}</ul><p className="local-ai-source">AI không tự ẩn phản hồi. Hãy đọc nội dung gốc trước khi dùng chức năng xử lý trong danh sách.</p></details>}
      {!!result.limitations?.length && <details className="local-ai-notes"><summary>Cách hiểu kết quả và giới hạn</summary><ul>{result.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
    </>}
  </section>
}
