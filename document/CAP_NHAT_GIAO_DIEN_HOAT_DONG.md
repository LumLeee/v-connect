# Cập nhật giao diện hoạt động

Ngày: 27/09/2026.

Phạm vi: trang danh sách hoạt động và chi tiết công khai. Bố cục dựa trên Activity Browser và Activity Detail trong PDF (trang 130, 132), giữ màu sắc, tiếng Việt và nghiệp vụ hiện có của V-Connect.

- Danh sách có tiêu đề, mô tả, khối tìm kiếm riêng và lưới thẻ ba cột trên desktop, giảm cột khi màn hình nhỏ.
- Thẻ hiển thị trạng thái, ngày bắt đầu, tên, địa điểm, Nhà tổ chức, số người được duyệt/sức chứa và liên kết xem chi tiết.
- Nút xóa tìm kiếm đưa danh sách về trang đầu; giữ phân trang và các trạng thái tải, lỗi, rỗng.
- Chi tiết công khai chia hai cột: nội dung/đơn vị tổ chức bên trái, thời gian/địa điểm/số người và thao tác tham gia bên phải. Trên màn hình nhỏ, các khối xếp một cột.
- Vùng minh họa dùng biểu tượng và CSS trang trí, không giả làm ảnh thật của hoạt động. Chưa thêm tải ảnh, bộ lọc nâng cao, bản đồ, yêu thích hoặc timeline.
- Trang danh sách của Organizer dùng chung thẻ mới; trang quản lý chi tiết, tạo/sửa, xét duyệt và điểm danh giữ nguyên nghiệp vụ/giao diện hiện có.

Không đổi API, database hoặc các quy tắc đăng ký, xét duyệt, hủy và phân quyền.

## Kiểm tra

Frontend lint/build và 48/48 ca Playwright đạt. Bộ kiểm thử chạy React, Django, MySQL thật trong database test riêng, bao gồm tìm kiếm, xóa tìm kiếm, điều hướng chi tiết, đăng ký/hủy và các luồng hồi quy.

Đã xem ảnh desktop và màn hình hẹp, kiểm tra không tràn ngang ở 320, 390, 768 và 1280px. Log: `tmp/activity-layout-e2e.log`; ảnh: `tmp/e2e-61643e47c517/screenshots/`. Database kiểm thử đã được dọn; hoạt động mẫu trong database ứng dụng giữ nguyên.

Nhánh bàn giao: `feature/activities`, kế thừa nền code tại commit `5d66a57`.
