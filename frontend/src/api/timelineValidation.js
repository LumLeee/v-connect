export function timelineError(item, startsAt, endsAt) {
  if (!item.starts_at || !item.ends_at) return ''
  if (item.starts_at < startsAt || item.ends_at > endsAt) return 'Mốc phải nằm trong thời gian bắt đầu và kết thúc của hoạt động.'
  if (item.ends_at <= item.starts_at) return 'Giờ kết thúc mốc phải sau giờ bắt đầu mốc.'
  return ''
}
