export default function LocalAiStatus({ ai, purpose }) {
  const active = ai?.status === 'active'
  return <div className={`local-ai-status${active ? ' local-ai-status--active' : ''}`} role="status" aria-label="Trạng thái AI">
    <span>{active ? 'AI trên backend' : ai?.status === 'not_applicable' ? 'Chưa có nội dung để phân tích' : ai?.status === 'disabled' ? 'AI đang tắt' : 'AI hiện chưa sẵn sàng'}</span>
    <p>{active ? purpose : 'Bạn vẫn có thể xem dữ liệu gốc và tự đánh giá. Kết quả dự phòng không phải kết luận của AI.'}</p>
  </div>
}
