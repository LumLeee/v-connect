# Cập nhật không gian tình nguyện viên

Ngày: 26/09/2026. Trang: `/tinh-nguyen-vien`.

Tham khảo bố cục hình **Volunteer Dashboard**, mục 2.3.1 trong `C2SE.14 Project Document.pdf` (trang PDF 127–128). Theo yêu cầu người dùng, lấy cách sắp xếp thông tin và giữ phong cách màu xanh, kiểu chữ của V-Connect hiện tại; không sao chép toàn bộ giao diện mẫu.

## Nội dung

- Tiêu đề tổng quan và đường dẫn khám phá hoạt động.
- Thẻ chào mừng, avatar, giới thiệu, ngày tham gia và email của chính tài khoản.
- Khối thao tác nhanh: tìm hoạt động, đăng ký của tôi, lịch sử và chỉnh sửa hồ sơ.
- Ba ô thống kê: tổng đơn đăng ký, hoạt động sắp tới và lượt đã tham gia hoạt động hoàn thành.
- Ba hoạt động sắp tới gần nhất, xếp theo giờ bắt đầu; ba lượt điểm danh gần nhất.
- Trạng thái tải, lỗi có thể thử lại và hướng dẫn khi chưa có dữ liệu.

Ẩn gợi ý AI, thông báo, tổng giờ đóng góp và thông tin kỹ năng/sở thích chưa triển khai theo lựa chọn của người dùng. Không hiển thị dữ liệu giả hoặc ô “Sắp ra mắt”.

## Dữ liệu và quy tắc

`GET /api/v1/reports/volunteer-dashboard/` chỉ dành cho Volunteer đã đăng nhập. API lấy dữ liệu của người trong phiên, không nhận ID người dùng để truy vấn tài khoản khác. Trả hồ sơ, ngày tham gia, số liệu tổng hợp, số hoạt động sắp tới và hai danh sách xem trước.

Hoạt động sắp tới phải có đơn được duyệt, trạng thái Công khai và giờ bắt đầu lớn hơn thời điểm hiện tại. Tổng số tính trên toàn bộ dữ liệu, độc lập giới hạn ba mục xem trước. Hoạt động đang diễn ra, đã hủy, đơn chờ duyệt hoặc bị từ chối không tính vào nhóm này.

Thống kê hoàn thành dùng quy tắc hiện có: được duyệt, đã điểm danh và hoạt động Hoàn thành. Lịch sử vẫn giữ lượt có mặt ở hoạt động bị hủy, hiển thị trạng thái hủy rõ ràng. Không suy ra giờ đóng góp từ thời lượng hoạt động.

Không thêm bảng hoặc migration. Các trang Organizer và Admin giữ giao diện hiện có.

## Kiểm tra

Đạt 101 tests backend trên MySQL, 8 tests bảo vệ runner, frontend lint và build. Bộ Playwright đầy đủ đạt 44/44 ca. Sau khi chỉnh nhãn trạng thái xuống dưới ở màn hình hẹp, chạy lại hai ca dashboard desktop/narrow đều đạt và build lại thành công.

Đã xem ảnh desktop/màn hình hẹp với dữ liệu có sẵn và tài khoản mới; kiểm tra không tràn ngang tại 320, 390, 768 và 1280px. Kiểm thử API xác nhận lọc theo người dùng, vai trò, trạng thái, thời gian, thứ tự và giới hạn danh sách xem trước.

Log local: `tmp/dashboard-check.log`, `tmp/dashboard-e2e-full.log`, `tmp/dashboard-e2e.log`. Ảnh bản cuối trong `tmp/e2e-f7c2255c4813/screenshots/`. Nhánh bàn giao: `feature/reports-admin`, kế thừa nền giai đoạn 9 tại commit `b8cf9da`.
