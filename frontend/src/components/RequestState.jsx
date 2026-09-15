import { RefreshCw, CircleAlert } from 'lucide-react'

export default function RequestState({ loading, error, retry }) {
  if (loading) return <p className="muted" role="status">Đang tải dữ liệu…</p>
  if (error) return <div className="request-error" role="alert"><CircleAlert size={20} /><span>{error.message}</span><button onClick={retry} className="text-button"><RefreshCw size={15} />Thử lại</button></div>
  return null
}
