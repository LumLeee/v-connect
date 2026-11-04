export const activityStatuses = { draft: 'Nháp', published: 'Công khai', completed: 'Hoàn thành', cancelled: 'Đã hủy' }

const timeZone = 'Asia/Ho_Chi_Minh'
const fullTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone })
const calendarDay = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone })

export function activityTime(value, now = Date.now()) {
  const date = new Date(value)
  const current = new Date(now)
  if (calendarDay.format(date) !== calendarDay.format(current)) return fullTime.format(date)

  const difference = date.getTime() - current.getTime()
  const minutes = Math.floor(Math.abs(difference) / 60000)
  if (minutes === 0) return difference > 0 ? 'Trong giây lát' : 'Vừa xong'

  const amount = minutes < 60 ? minutes : Math.floor(minutes / 60)
  const unit = minutes < 60 ? 'phút' : 'giờ'
  return `${amount} ${unit} ${difference > 0 ? 'nữa' : 'trước'}`
}
