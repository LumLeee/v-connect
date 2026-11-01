# Mẫu báo cáo tổng kết hoạt động

Cập nhật ngày 01/11/2026: giữ một mẫu tổng kết có xem trước và in/lưu PDF. Chức năng chứng nhận/chứng chỉ đã được loại bỏ theo yêu cầu.

## Sử dụng

Nhà tổ chức vào **Báo cáo → Báo cáo từng hoạt động → Kết quả hoạt động → Mẫu báo cáo tổng kết**. Admin xem toàn hệ thống; Nhà tổ chức chỉ xem hoạt động của mình. Tình nguyện viên và khách không có quyền xem mẫu tổng kết quản lý.

Chỉ lập tổng kết khi hoạt động Hoàn thành và đã kết thúc. Mẫu A4 dọc gồm tên hoạt động, đơn vị tổ chức, thời gian, địa điểm, nội dung, số đơn theo trạng thái, số người đã tham gia, điểm đóng góp, số người đã/chờ chấm điểm, phản hồi hợp lệ, timeline nếu có, người lập và thời điểm lấy số liệu.

Điểm đóng góp là số nguyên 0–10 cho mỗi người do Nhà tổ chức chấm; tổng điểm có thể lớn hơn 10 khi cộng nhiều người. Điểm 0 là đã chấm. Không suy ra điểm từ thời lượng hoạt động hoặc giờ check-in; không nhầm với điểm phản hồi /5. Phản hồi bị ẩn không tính vào thống kê.

**Cập nhật số liệu** tải dữ liệu mới. **In / Lưu PDF** in số liệu đang xem; chọn lưu PDF trong hộp thoại in của trình duyệt. PDF là số liệu tại thời điểm xuất, không tự cập nhật sau khi đã tải.

## API và thay đổi hệ thống

`GET /api/v1/reports/activities/<id>/summary-document/` trả dữ liệu mẫu tổng kết theo quyền, với `contributions.score`, `confirmed`, `pending`. Không còn chỉ số chứng nhận.

Đã gỡ giao diện, điều hướng, API cấp/thu hồi/tra cứu và mã QR chứng nhận. Migration `reports.0007_delete_certificate` xóa bảng dữ liệu chứng nhận sau khi sao lưu. Các migration trước được giữ để database hiện có và cài mới cùng chạy đúng lịch sử schema. Nhật ký quản trị cũ vẫn đọc được như lịch sử; không phát sinh thao tác chứng nhận mới. QR/mã điểm danh là chức năng riêng và tiếp tục hoạt động.

## Kiểm chứng ngày 01/11/2026

- 200 kiểm thử backend và 8 kiểm thử bảo vệ môi trường chạy đều đạt; Django check, kiểm tra migration, frontend lint/build đạt.
- 4 ca trình duyệt trên desktop/narrow đạt: mở tổng kết từ báo cáo, tổng điểm, in/lưu PDF, phân quyền Admin/Organizer/Volunteer/khách, không còn liên kết chứng nhận và đường dẫn cũ hiển thị 404.
- Đã xem hai PDF thử: A4 dọc, một trang với dữ liệu kiểm thử, hiển thị điểm rõ, không còn mục chứng nhận. Kiểm tra bố cục 320–1280px không tràn ngang.
- Đã sao lưu database/media, xác minh SHA-256 và áp dụng migration xóa bảng vào MySQL80. Đã xác nhận bảng `reports_certificate` không còn, dữ liệu điểm danh vẫn tồn tại. Kiểm thử dùng database riêng và dọn sau khi hoàn tất.
