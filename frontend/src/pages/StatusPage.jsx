import { CheckCircle2, RefreshCw, Server, Database, Layers } from 'lucide-react'
import useApi from '../hooks/useApi.js'
import RequestState from '../components/RequestState.jsx'

export default function StatusPage() {
  const { data, loading, error, retry } = useApi('/health/')
  const result = data || error?.details
  return <section className="page-width section interior"><p className="eyebrow">MÔI TRƯỜNG PHÁT TRIỂN</p><h1>Trạng thái hệ thống</h1><p className="lead">Kiểm tra kết nối từ website đến API và cơ sở dữ liệu.</p><div className="status-panel"><div className="status-heading"><h2>{loading ? 'Đang kiểm tra…' : data ? 'Hệ thống sẵn sàng' : 'Cần kiểm tra kết nối'}</h2><button className="button secondary" onClick={retry} disabled={loading}><RefreshCw size={16} />Kiểm tra lại</button></div><RequestState loading={loading} error={error} retry={retry} /><dl className="status-list"><div><dt><Server size={20} />API Django</dt><dd>{loading ? 'Đang kiểm tra' : result?.service ? 'Đã phản hồi' : 'Chưa kết nối'}</dd></div><div><dt><Database size={20} />MySQL</dt><dd>{result?.database === 'connected' ? 'Đã kết nối' : 'Chưa xác nhận'}</dd></div><div><dt><Layers size={20} />Database migrations</dt><dd>{result?.migrations === 'applied' ? 'Đã áp dụng' : result?.migrations === 'pending' ? 'Chưa áp dụng đầy đủ' : 'Chưa xác nhận'}</dd></div></dl>{data && <p className="success"><CheckCircle2 size={18} />Kiểm tra lúc {new Date(data.timestamp).toLocaleTimeString('vi-VN')}</p>}</div><p className="muted">Thông tin này phản ánh kết nối nền tảng, không có nghĩa tất cả nghiệp vụ đã hoàn thành.</p></section>
}
