# Giai đoạn 3 — Công việc 1: Thông tin cơ bản, avatar và hồ sơ Nhà tổ chức

Ngày cập nhật: 16/09/2026.

## Phạm vi được thống nhất

Người dùng đã chọn các trường: họ tên, số điện thoại, giới thiệu, avatar; Nhà tổ chức thêm tên tổ chức, mô tả, website và địa chỉ liên hệ. Chỉ thực hiện công việc đầu tiên, chưa triển khai kỹ năng/sở thích, lịch rảnh hay danh mục địa điểm.

Để chức năng dùng được ngay, đã bổ sung phần API, giao diện và upload avatar liên quan. Đây là phần giao nhau với các công việc upload/lưu file/giao diện trong kế hoạch, không có nghĩa đã hoàn thành toàn bộ các công việc đó.

## Dữ liệu và API

- Bổ sung `phone`, `bio`, `avatar` trên User, giữ nguyên định danh, email và cơ chế xác thực.
- Thêm `OrganizerProfile` liên kết một-một với User, có `organization_name`, `description`, `website`, `contact_address`.
- Không bắt người dùng cũ bổ sung hồ sơ ngay; các trường mới để trống. Bản ghi tổ chức được tạo khi Nhà tổ chức lưu phần thông tin này.
- `GET/PATCH /api/v1/auth/profile/` chỉ lấy/sửa người dùng của session hiện tại. Không có tham số ID để sửa người khác.
- Từ chối các trường ngoài danh sách được phép, kể cả email, role, password, ID và trường cấp quyền; Tình nguyện viên không được ghi hồ sơ tổ chức.
- Lưu thông tin cơ bản và tổ chức trong cùng transaction, khóa hàng User khi cập nhật. Lỗi dữ liệu tổ chức không làm thông tin cá nhân được lưu một phần.
- Họ tên bắt buộc; số điện thoại nếu có phải chứa 7–15 chữ số, cho phép dấu cộng và dấu phân cách thông dụng. Website chỉ nhận HTTP/HTTPS. Các trường có giới hạn độ dài.

## Avatar

- `GET/POST/DELETE /api/v1/auth/profile/avatar/` để xem, thay và xóa avatar của chính người đang đăng nhập.
- POST nhận multipart với đúng một trường file `avatar`; các thao tác ghi đều yêu cầu CSRF.
- Chỉ nhận JPEG, PNG, WebP có nội dung ảnh hợp lệ, tối đa 5 MB và 16 triệu điểm ảnh. Không chỉ tin tên file hoặc MIME type do trình duyệt gửi.
- Điều chỉnh hướng ảnh theo EXIF, mã hóa lại thành JPEG, thu nhỏ vừa trong 512 × 512 và đặt tên UUID. Không giữ metadata ảnh gốc.
- File lưu tại `backend/media/avatars/`, database giữ tên tương đối. API ảnh không cache và yêu cầu đăng nhập; hiện chưa có avatar công khai cho người khác xem.
- Khi thay/xóa thành công, dọn file cũ sau khi transaction commit. Nếu lưu database thất bại, dọn file mới vừa tạo.
- Nếu thao tác xóa file cũ gặp lỗi hệ thống lưu trữ, có thể còn file không được tham chiếu; hệ thống ghi cảnh báo. Chưa có công cụ dọn file mồ côi định kỳ hoặc dọn avatar theo luồng xóa tài khoản.

## Giao diện

Trang `/ho-so` có đường dẫn từ **Chỉnh sửa hồ sơ** trong workspace. Có form thông tin cá nhân, khu vực ảnh và form tổ chức riêng cho Organizer, hiển thị trạng thái lưu/lỗi/thành công bằng tiếng Việt.

Thông tin văn bản lưu bằng nút **Lưu hồ sơ**; avatar được lưu riêng khi chọn file. Giao diện nói rõ hành vi này. Tải lại trang lấy dữ liệu đã lưu từ MySQL. Tên mới được đồng bộ vào thông tin tài khoản.

Giữ nguyên nội dung đang nhập khi cửa sổ nhận focus và kiểm tra lại phiên; nếu danh tính người đăng nhập thay đổi, tải hồ sơ mới và bỏ bản nháp của tài khoản cũ.

## Migration và kiểm tra

- Migration: `accounts.0002_user_avatar_user_bio_user_phone_organizerprofile`.
- Đã sao lưu database trước khi áp dụng: `tmp/backups/before-profile-20260915-232813.sql` (chỉ lưu local, không đưa lên Git).
- Đã áp dụng migration trên MySQL80; đối chiếu mọi trường cũ của các tài khoản trước/sau, không có thay đổi. Các trường hồ sơ mới khởi tạo rỗng.
- Backend: 40/40 tests đạt, gồm 31 tests có sẵn và 9 tests hồ sơ/avatar. Các trường hợp kiểm tra gồm quyền, CSRF, dữ liệu sai, lưu/tải, sửa một phần hồ sơ tổ chức, ảnh giả/quá lớn, thay/xóa ảnh và lỗi lưu database.
- 5/5 tests bảo vệ dọn database E2E đạt. ESLint và Vite build cuối đạt.
- Playwright đạt 18/18 ca trên Chrome: 12 ca xác thực hiện có và 6 ca hồ sơ trên desktop/màn hình hẹp. Kiểm tra lưu/tải hồ sơ hai vai trò, lỗi số điện thoại, upload/đọc/xóa avatar, từ chối ảnh giả, giữ bản nháp khi focus và bỏ bản nháp khi đổi tài khoản. Kiểm tra không tràn ngang ở 320, 390, 768 và 1280px.
- Đã xem ảnh giao diện desktop và màn hình hẹp. Log lượt hoàn tất: `tmp/phase3-e2e-final.log`; ảnh hồ sơ: `tmp/e2e-4f88eb430b54/screenshots/`. Runner đã đóng server và xóa đúng database test sau khi chạy.

Lệnh kiểm tra:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

Runner trình duyệt dùng MySQL test riêng; file ảnh E2E nằm trong thư mục `tmp/e2e-*/media`, tách khỏi ảnh của ứng dụng. Một lượt trước bị ngắt giữa chừng; chỉ tính kết quả của lượt hoàn tất, không suy ra thành công từ phần đã chạy.

## Các phần còn lại của giai đoạn 3

Chưa xây dữ liệu kỹ năng/sở thích theo tài khoản, lịch rảnh, địa điểm có danh mục, upload ngoài avatar hay phương án lưu file khi triển khai thực tế. API và giao diện hồ sơ sẽ tiếp tục được mở rộng cùng các dữ liệu đó. Chưa thêm xác minh pháp lý hoặc phê duyệt tổ chức vì chưa nằm trong yêu cầu công việc này.

Tại thời điểm kiểm tra ngày 16/09/2026, thay đổi công việc này còn ở local. Theo kế hoạch điều chỉnh ngày 22/09/2026, hồ sơ cơ bản, avatar và hồ sơ Organizer là toàn bộ phạm vi giai đoạn 3 của đợt nghiệp vụ chính; các phần mở rộng nêu trên chuyển sang đợt 2. Xem [bàn giao giai đoạn 3](GIAI_DOAN_3_KET_QUA.md) để biết trạng thái mới.
