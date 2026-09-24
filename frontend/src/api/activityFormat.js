export const activityStatuses = { draft: 'Nháp', published: 'Công khai', completed: 'Hoàn thành', cancelled: 'Đã hủy' }
export const activityTime = value => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
