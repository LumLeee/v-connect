import { activityTime } from '../api/activityFormat.js'

export default function AttendanceStatus({ entry }) {
  if (entry.attendance) return <div className="activity-empty">
    <p><strong>Đã xác nhận có mặt</strong></p>
    <p>Thời điểm: {activityTime(entry.attendance.confirmed_at)} (giờ Việt Nam)</p>
    <p>Người xác nhận: {entry.attendance.confirmed_by_name || 'Nhà tổ chức'}</p>
    {entry.activity.status === 'cancelled' && <p>Hoạt động đã bị hủy sau khi ghi nhận có mặt. Bản ghi được giữ để đối chiếu.</p>}
  </div>
  if (entry.status !== 'approved') return null
  return <p>Điểm danh: <strong>Chưa ghi nhận có mặt</strong></p>
}
