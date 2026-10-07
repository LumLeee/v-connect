# Quy tắc giờ bắt đầu hoạt động

Ngày cập nhật: 07/10/2026.

Giờ bắt đầu phải cách thời điểm thực hiện ít nhất 24 giờ, tính theo thời gian máy chủ. Ví dụ thực hiện lúc 08:00 hôm nay thì giờ bắt đầu sớm nhất là 08:00 ngày mai; không chỉ kiểm tra khác ngày trên lịch.

## Áp dụng

- Tạo hoạt động: kiểm tra khi lưu bản nháp.
- Chỉnh sửa: kiểm tra khi thực sự đổi giờ bắt đầu. Giữ nguyên giờ bắt đầu hoặc không gửi trường này vẫn sửa được nội dung theo các giới hạn hiện có.
- Công khai: kiểm tra lại tại thời điểm công khai. Bản nháp không còn đủ 24 giờ phải cập nhật lịch trước; khi bị từ chối vẫn giữ trạng thái Nháp.
- Mốc đúng 24 giờ được chấp nhận; thiếu dù chỉ một phần giây bị từ chối. Người dùng nên chọn dư thời gian để tránh mốc đã qua trong lúc thao tác hoặc gửi yêu cầu.
- Thời gian kết thúc vẫn phải sau giờ bắt đầu. Không thay đổi hạn đăng ký, xét duyệt hoặc khung giờ điểm danh.

Giao diện nhập giờ Việt Nam (UTC+7), hiển thị hướng dẫn và thông báo ở trường giờ bắt đầu. Backend kiểm tra độc lập để bảo vệ cả các yêu cầu gọi API trực tiếp. Không sửa lịch các hoạt động đã lưu và không cần migration.

## Kiểm chứng

- 157 kiểm thử backend và 8 kiểm thử bảo vệ công cụ chạy đạt; kiểm tra Django, migration, lint và build đạt.
- Kiểm thử ranh giới đúng 24 giờ và thiếu một phần giây; đổi lịch không hợp lệ không lưu một phần dữ liệu; giữ nguyên lịch vẫn sửa được nội dung; công khai lại kiểm tra thời gian và giữ bản nháp riêng tư khi bị từ chối.
- 24/24 kiểm thử trình duyệt liên quan đạt trên máy tính và màn hình nhỏ: hoạt động, QR/mã điểm danh, luồng nghiệp vụ chính, tổng quan và trang quản lý Nhà tổ chức, các trang Tình nguyện viên.
- Biểu mẫu đã được kiểm tra nhập giờ bắt đầu dưới 24 giờ, hiển thị lỗi, sửa giờ và lưu thành công. Dữ liệu tạo hoạt động trong các bài kiểm thử được chuyển sang lịch đủ xa; dùng đồng hồ kiểm thử để tiếp tục xác minh điểm danh và hoàn thành.
