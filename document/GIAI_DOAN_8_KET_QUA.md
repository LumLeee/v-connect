# Giai đoạn 8 — Thống kê và quản trị cơ bản

Ngày thực hiện và bàn giao: 26/09/2026. Nhánh `feature/reports-admin`, kế thừa giai đoạn 7 tại `11f90b2`.

## Quy tắc đã thống nhất

- “Đã tham gia” chỉ tính đơn Được duyệt, có điểm danh và hoạt động Hoàn thành. Lượt có mặt ở hoạt động Công khai chưa hoàn thành hoặc hoạt động bị hủy hiển thị riêng.
- Admin khóa/mở khóa Volunteer và Organizer phải nhập lý do, không khóa tài khoản Admin. Backend cũng bảo vệ tài khoản có quyền staff/superuser.
- Mở khóa không khôi phục phiên đăng nhập cũ. Tài khoản phải đăng nhập lại bằng mật khẩu hiện có; mật khẩu không thay đổi khi khóa/mở khóa.

## Chức năng hoàn thành

### Thống kê và đối chiếu

- Volunteer xem tổng đơn, chờ duyệt, được duyệt, bị từ chối, đã hủy và ba nhóm có mặt; mỗi số đếm có liên kết danh sách chi tiết cùng điều kiện lọc.
- Organizer xem tổng số liệu thuộc hoạt động mình quản lý, danh sách hoạt động có tìm tên/lọc trạng thái và kết quả riêng từng hoạt động.
- Kết quả hoạt động gồm số đơn theo trạng thái, dữ liệu điểm danh, số phản hồi hợp lệ và điểm trung bình. Chưa có phản hồi thì hiển thị “Chưa có đánh giá”. Dữ liệu chưa hoàn thành/đã hủy được ghi rõ là số liệu hiện tại.
- Admin xem toàn hệ thống, số tài khoản đang hoạt động/bị khóa và danh sách hoạt động, đăng ký. Phản hồi được quản lý ở màn hình giai đoạn 7.
- Không tính phản hồi bị ẩn vào số phản hồi hợp lệ/điểm trung bình. Các số liệu dùng cùng điều kiện với danh sách đối chiếu và tách theo quyền tại backend.

Tổng đơn là số bản ghi hiện có, mỗi người/hoạt động một đơn; tự hủy rồi đăng ký lại không tăng số đơn. “Được duyệt” là trạng thái hiện tại, không phải tổng số lần duyệt trong lịch sử. Lượt có mặt vẫn được giữ khi hoạt động bị hủy nhưng không tính vào “Đã tham gia”. Không suy ra số giờ đóng góp.

### Quản lý tài khoản

Trang `/quan-tri/tai-khoan` tìm theo tên/email/username, lọc vai trò và trạng thái, có phân trang. Admin chọn khóa/mở khóa, nhập lý do tối đa 1.000 ký tự và xác nhận. Yêu cầu lặp không thay đổi trạng thái không tạo thêm nhật ký hoặc ghi đè lý do trước.

`User.session_version` tăng khi trạng thái thực sự thay đổi. Hash xác thực phiên có thêm phiên bản này; phiên cũ bị từ chối kể cả chưa truy cập trong thời gian bị khóa. Phiên bản 0 giữ cơ chế hash cũ để migration không tự đăng xuất toàn bộ tài khoản. Cơ chế đổi mật khẩu và khóa bí mật dự phòng của Django vẫn được giữ.

Khóa tài khoản không xóa hoạt động, đăng ký, điểm danh hoặc phản hồi và không tự hủy hoạt động của Organizer. Dữ liệu lịch sử và thống kê được giữ; tài khoản bị khóa không truy cập API có xác thực.

### Nhật ký và Django Admin

`AuditEvent` lưu người thao tác, loại thao tác, ID bản ghi đích, tài khoản/hoạt động liên quan, lý do và thời điểm. Nhật ký được ghi cùng transaction với thao tác, gồm:

- Khóa/mở khóa tài khoản.
- Duyệt/từ chối đơn đăng ký.
- Xác nhận có mặt lần đầu.
- Ẩn phản hồi lần đầu.

Nhật ký xét duyệt mới không mất khi Volunteer tự hủy rồi đăng ký lại. Yêu cầu điểm danh/ẩn phản hồi/khóa lặp không tạo bản ghi giả. Admin xem và lọc loại thao tác tại `/quan-tri/nhat-ky`; không có API sửa/xóa nhật ký.

Nhật ký riêng bắt đầu từ khi triển khai giai đoạn 8, không dựng lại lịch sử đã mất trước đó. Dữ liệu xét duyệt gần nhất, điểm danh và ẩn phản hồi cũ vẫn giữ nguyên trong các bảng nghiệp vụ. Tên người trong giao diện lấy theo hồ sơ hiện tại; database giữ ID người thực hiện.

Django Admin bổ sung chế độ chỉ đọc cho Activity, Participation, Attendance, Feedback và AuditEvent. Không thêm/sửa/xóa nghiệp vụ qua các màn hình này để tránh bỏ qua quy tắc API. Trạng thái `is_active` của tài khoản chỉ đọc trong Django Admin; khóa/mở khóa thực hiện trên website để bắt buộc lý do và ghi nhật ký. Không mở chức năng xóa tài khoản.

## API

| Method | Endpoint | Quyền/phạm vi |
|---|---|---|
| GET | `/api/v1/reports/overview/` | Mỗi vai trò xem tổng quan đúng phạm vi |
| GET | `/api/v1/reports/activities/` | Organizer xem của mình, Admin xem toàn bộ; search/status/phân trang |
| GET | `/api/v1/reports/activities/<id>/` | Kết quả một hoạt động, Organizer chủ sở hữu hoặc Admin |
| GET | `/api/v1/reports/participations/` | Danh sách đối chiếu theo metric, activity và phân trang; giới hạn theo vai trò |
| GET | `/api/v1/admin/accounts/` | Admin; search/role/status/phân trang |
| POST | `/api/v1/admin/accounts/<id>/status/` | Admin; `{ "is_active": false, "reason": "Lý do" }` |
| GET | `/api/v1/admin/audit/` | Admin; lọc action/phân trang |

Các metric: `registered`, `pending`, `approved`, `rejected`, `cancelled`, `attended_completed`, `attended_ongoing`, `attended_cancelled`. Chỉ query được định nghĩa được dùng để lọc; loại metric/trạng thái sai bị từ chối. API ghi kiểm tra CSRF; dữ liệu riêng tư có header không cache.

## Kiểm tra và migration

- 96 tests backend trên MySQL đạt, gồm 9 tests mới: số đếm khớp danh sách, phân loại có mặt, quyền truy cập, phản hồi bị ẩn, khóa/mở khóa và phiên cũ, yêu cầu đồng thời, nhật ký xét duyệt/điểm danh và chế độ chỉ đọc Django Admin.
- Django system check, kiểm tra migration, 5 tests bảo vệ database kiểm thử và frontend lint/build đạt.
- Lượt kiểm thử trình duyệt đầy đủ đạt 37/38 ca; một ca lỗi do bài test không chờ bộ lọc tài khoản tải xong. Đã sửa cách chờ và chạy lại nhóm thống kê/quản trị: 4/4 ca đạt, runner trả mã 0. Tổng cộng đã xác minh 34 ca hồi quy và 4 ca mới.
- Các trang thống kê, kết quả hoạt động, tài khoản và nhật ký không tràn ngang ở 320, 390, 768, 1280 px. Đã xem ảnh desktop/màn hình nhỏ tại `tmp/e2e-e79c796bd9f7/screenshots`.
- Migration đã áp dụng thành công sau bản sao lưu `tmp/backups/before-reports-20260926-100907.sql`. Đối chiếu trước/sau xác nhận toàn bộ trường dữ liệu cũ của tài khoản, hồ sơ, hoạt động, đăng ký, điểm danh và phản hồi không đổi; `session_version` khởi tạo bằng 0.
- Log local: `tmp/phase8-check.log`, `tmp/phase8-e2e-full.log` (lượt đầy đủ), `tmp/phase8-e2e.log` (nhóm chạy lại). Database kiểm thử riêng đã được dọn sau mỗi lượt; không thêm tài khoản mẫu vào database thật.

Migration mới: `accounts.0004_user_session_version`, `reports.0001_initial`. Không sửa các migration đã áp dụng trước đây.

## Phạm vi tiếp theo

Giai đoạn 9: kiểm tra hoàn chỉnh luồng nghiệp vụ chính, quyền truy cập và dữ liệu giữa các bước. Biểu đồ nâng cao, xuất PDF/Excel, báo cáo mẫu, chứng nhận, thống kê giờ và AI vẫn để sau.
