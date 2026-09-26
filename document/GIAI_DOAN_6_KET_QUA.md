# Giai đoạn 6 — Điểm danh cơ bản

Ngày thực hiện và bàn giao: 25/09/2026. Nhánh `feature/attendance`, kế thừa giai đoạn 5 tại `eb623f5`.

## Nghiệp vụ

- Chủ hoạt động xem danh sách tình nguyện viên được duyệt, chọn **Ghi nhận có mặt**, kiểm tra đúng người rồi xác nhận.
- Khoảng điểm danh đã được người dùng chọn: từ giờ bắt đầu đến giờ kết thúc, bao gồm hai mốc; hoạt động phải còn Công khai. Backend quyết định theo giờ máy chủ, không tin giờ hoặc người xác nhận do trình duyệt gửi lên.
- Chỉ đơn Được duyệt mới được điểm danh. Từ chối đơn chờ, bị từ chối, đã hủy, sai hoạt động hoặc thuộc Nhà tổ chức khác. Admin/Volunteer không được dùng API điểm danh của Organizer.
- Mỗi đơn có tối đa một bản ghi điểm danh. Gửi lại trong thời gian hợp lệ trả bản ghi cũ, không tăng lượt, không đổi người hoặc thời điểm. Sau hạn hoặc khi hoạt động không còn công khai, thao tác ghi bị từ chối; vẫn được xem kết quả.
- Lưu người xác nhận và thời điểm; không có API sửa/xóa điểm danh trong phạm vi này. Giao diện có bước xác nhận để tránh chọn nhầm.
- Hoạt động bị hủy sau khi đã điểm danh vẫn giữ bằng chứng có mặt. Giao diện ghi rõ hoạt động đã hủy; bản ghi không đồng nghĩa hoạt động đã hoàn thành. Thống kê giai đoạn sau phải phân biệt hai trường hợp này.
- Chưa có bản ghi chỉ có nghĩa **Chưa ghi nhận có mặt**, không tự kết luận vắng mặt.

## Dữ liệu và quyền truy cập

Model `Attendance` nằm trong app `participations` vì điểm danh gắn trực tiếp với đơn đã được duyệt. Quan hệ OneToOne bảo đảm một bản ghi trên mỗi đơn; khóa ngoại PROTECT giữ dữ liệu đối chiếu. Migration bổ sung: `participations.0002_attendance`.

Ghi nhận chạy trong transaction, khóa bản ghi hoạt động theo cùng thứ tự với xét duyệt và hủy hoạt động. Nhờ đó, yêu cầu đồng thời không tạo trùng hoặc bỏ qua trạng thái đã hủy. `confirmed_by` lấy từ phiên đăng nhập, `confirmed_at` do backend ghi. API không nhận trường dữ liệu tùy ý, kiểm tra CSRF và không cache dữ liệu riêng tư.

Danh sách của Organizer gồm người đang được duyệt và người đã có bản ghi điểm danh cần giữ lại khi hoạt động bị hủy. Lịch sử của Volunteer chỉ trả bản ghi của chính tài khoản hiện tại, sắp theo thời điểm xác nhận mới nhất. Tên người xác nhận lấy từ hồ sơ hiện tại; database giữ ID người xác nhận.

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/v1/organizer/activities/<id>/attendance/` | Danh sách điểm danh có phân trang, chỉ chủ hoạt động |
| POST | `/api/v1/organizer/activities/<id>/attendance/<entry_id>/` | Xác nhận với body `{}`; tạo mới 201, yêu cầu lặp hợp lệ 200 |
| GET | `/api/v1/participations/history/` | Lịch sử có mặt của Volunteer hiện tại, có phân trang |

API đơn đăng ký hiện có bổ sung `attendance`: `null` nếu chưa ghi nhận, hoặc object có `id`, `confirmed_at`, `confirmed_by_name`.

## Giao diện

- Organizer mở chi tiết hoạt động → **Điểm danh người tham gia** (`/nha-to-chuc/hoat-dong/<id>/diem-danh`). Có thông tin thời gian, trạng thái mở/đóng, phân trang và nút cập nhật danh sách.
- Volunteer xem kết quả tại chi tiết hoạt động, **Đăng ký của tôi** và **Lịch sử tham gia** (`/tinh-nguyen-vien/lich-su`).
- Nút điểm danh bị khóa ngoài thời gian cho phép; API kiểm tra lại khi gửi để xử lý trang đang mở lâu hoặc thông tin đã thay đổi.

## Kiểm tra và dữ liệu local

- 77 tests backend trên MySQL đạt, gồm 9 tests mới về điểm danh; đã kiểm tra ranh giới thời gian và yêu cầu đồng thời.
- Django system check, kiểm tra migration, 5 tests bảo vệ database kiểm thử, frontend lint/build đạt.
- Playwright trên Chrome: 30 ca đạt (15 ca trên mỗi kích thước desktop/màn hình nhỏ), gồm 4 ca mới về điểm danh. Đã kiểm tra luồng Organizer xác nhận → Volunteer xem lịch sử → hoạt động bị hủy vẫn giữ bằng chứng; từ chối trước/sau khoảng điểm danh. Hai trang mới không tràn ngang ở 320, 390, 768, 1280 px; đã xem ảnh giao diện desktop và màn hình nhỏ.
- Log local: `tmp/phase6-check.log`, `tmp/phase6-e2e.log`; ảnh tại `tmp/e2e-f39d1f66e172/screenshots`. Runner đã dọn database kiểm thử sau khi hoàn tất.
- Migration đã áp dụng thành công trên MySQL80 sau bản sao lưu `tmp/backups/before-attendance-20260925-214210.sql`. Đối chiếu trước/sau xác nhận tài khoản, hồ sơ tổ chức, hoạt động và đơn đăng ký không thay đổi.

Các tình huống kiểm tra gồm giới hạn thời gian, phân quyền/CSRF, giả mạo trường audit, đơn không đủ điều kiện, yêu cầu lặp/đồng thời, giữ lịch sử sau hoàn thành hoặc hủy, và quyền riêng tư của lịch sử. Dữ liệu hoạt động đang diễn ra cho kiểm thử trình duyệt chỉ được tạo trong database kiểm thử riêng; không mở API đổi giờ hoặc bỏ qua điều kiện nghiệp vụ cho ứng dụng thật.

## Phạm vi tiếp theo

Giai đoạn 7: phản hồi cơ bản sau hoạt động hoàn thành, gắn với người đã được xác nhận tham gia. QR, check-out, tính giờ đóng góp và sửa điểm danh có quy trình kiểm soát chưa thuộc giai đoạn này.
