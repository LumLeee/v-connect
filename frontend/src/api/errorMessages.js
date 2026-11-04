const labels = {
  title: 'Tên hoạt động', description: 'Mô tả', address: 'Địa chỉ', starts_at: 'Thời gian bắt đầu', ends_at: 'Thời gian kết thúc',
  capacity: 'Số lượng người cần tuyển', required_skills: 'Kỹ năng yêu cầu', timeline: 'Mốc chương trình',
  full_name: 'Họ tên', email: 'Email', username: 'Tên đăng nhập', identifier: 'Thông tin đăng nhập', password: 'Mật khẩu',
  password_confirm: 'Xác nhận mật khẩu', phone: 'Số điện thoại', bio: 'Giới thiệu', avatar: 'Ảnh đại diện', cover: 'Ảnh bìa',
  organizer: 'Hồ sơ Nhà tổ chức', organization_name: 'Tên tổ chức', website: 'Website', contact_address: 'Địa chỉ liên hệ',
  volunteer: 'Hồ sơ Tình nguyện viên', skills: 'Kỹ năng', interests: 'Sở thích', availability: 'Lịch rảnh',
  day: 'Ngày', weekday: 'Ngày trong tuần', start: 'Giờ bắt đầu', end: 'Giờ kết thúc',
  score: 'Điểm đóng góp', reason: 'Lý do', rating: 'Điểm đánh giá', content: 'Nội dung', status: 'Trạng thái',
  code: 'Mã xác nhận', token: 'Liên kết xác nhận', revision: 'Phiên bản dữ liệu', message: 'Lời nhắn',
  date_from: 'Từ ngày', date_to: 'Đến ngày', page: 'Trang', page_size: 'Số kết quả mỗi trang',
}

export function validationMessages(value, path = '') {
  if (typeof value === 'string') return value.trim() ? [path ? `${path}: ${value}` : value] : []
  if (Array.isArray(value)) return value.flatMap((item, index) => validationMessages(item,
    item && typeof item === 'object' ? `${path ? `${path} · ` : ''}Mục ${index + 1}` : path))
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, item]) => {
    const label = ['detail', 'non_field_errors'].includes(key) ? '' : labels[key] || 'Thông tin nhập'
    return validationMessages(item, [path, label].filter(Boolean).join(' · '))
  })
}

export function apiErrorMessage(status, data = {}) {
  // Unexpected server failures must not reveal internal exception details.
  if (status >= 500) return 'Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau; nếu lỗi tiếp diễn, hãy liên hệ quản trị viên.'
  const details = validationMessages(data?.error?.details ?? data?.detail)
  if (details.length) return [...new Set(details)].join('\n')
  if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message
  return ({
    400: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra các trường đã nhập.',
    401: 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập lại.',
    403: 'Bạn không có quyền thực hiện thao tác này. Hãy kiểm tra tài khoản đang đăng nhập.',
    404: 'Không tìm thấy nội dung này. Nội dung có thể đã bị xóa hoặc không còn được chia sẻ.',
    409: 'Dữ liệu đã thay đổi. Vui lòng cập nhật trang rồi kiểm tra lại trước khi thao tác.',
    413: 'Tệp tải lên quá lớn. Vui lòng chọn tệp có dung lượng nhỏ hơn.',
    429: 'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.',
  })[status] || 'Không thể xử lý yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên.'
}
