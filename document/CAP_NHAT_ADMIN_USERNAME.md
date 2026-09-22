# Cập nhật Admin dùng username

Ngày: 16/09/2026.

## Yêu cầu và hành vi

Admin dùng username và mật khẩu, không bắt buộc email. Volunteer và Organizer tiếp tục đăng ký/đăng nhập bằng email. Không mở đăng ký Admin trên website.

- `createsuperuser` hỏi username và mật khẩu, không hỏi email hoặc họ tên. Tên hiển thị mặc định là username.
- Username duy nhất, được chuẩn hóa chữ thường, chỉ nhận chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang. Không nhận dấu `@` để phân biệt rõ với email của hai vai trò công khai.
- Form đăng nhập website có trường **Email hoặc username Admin**. Django Admin nhận username ở form đăng nhập của nó.
- Hồ sơ và workspace Admin hiển thị username thay cho email trống.
- Form thêm/sửa tài khoản trong Django Admin cho phép Admin không có email; tài khoản công khai vẫn phải có email.
- Admin không sử dụng email reset. Chủ hệ thống đổi mật khẩu bằng `manage.py changepassword <username>`; liên kết reset Admin cũ cũng bị từ chối.

## Tổ chức code

`User.username` duy nhất và nullable; chỉ Admin dùng trường này. `User.email` chuyển thành nullable/blank để nhiều Admin có thể cùng không khai báo email. Model validation và ràng buộc database yêu cầu Admin có username, còn Volunteer/Organizer có email và không có username.

`USERNAME_FIELD` chuyển sang `username` để lệnh quản trị Django hoạt động theo định danh Admin. `IdentityBackend` xử lý đăng nhập theo vai trò: chuỗi có `@` tra email của Volunteer/Organizer; chuỗi còn lại tra username của Admin. Backend vẫn kiểm tra mật khẩu và trạng thái tài khoản, kế thừa kiểm tra quyền Django.

API đăng nhập ưu tiên hợp đồng `identifier` + `password`; vẫn nhận `email` hoặc `username` thay cho `identifier`, nhưng từ chối gửi nhiều trường định danh cùng lúc. Serializer phản hồi thêm `username`; trường này không được sửa qua API hồ sơ.

## Migration và tài khoản hiện có

Migration `accounts.0003_user_username_alter_user_email_and_more` thêm username, cho phép email rỗng, gán `admin_<UUID không dấu gạch>` cho Admin cũ rồi thêm ràng buộc định danh. Giữ nguyên email cũ nếu có, họ tên, ID, quyền, thông tin hồ sơ và hash mật khẩu. Email cũ không còn là tên đăng nhập Admin.

Đã sao lưu tại `tmp/backups/before-admin-username-20260916-112815.sql` trước khi áp dụng trên MySQL80. Sau migration, đối chiếu mọi trường tài khoản cũ ngoài cột username mới: không có thay đổi.

Theo lựa chọn của người dùng, tài khoản Admin hiện có được đặt username **`admin`** sau migration, giữ nguyên mật khẩu và các thông tin khác. Có thể đổi username bằng trang sửa tài khoản trong Django Admin; quy tắc duy nhất và định dạng vẫn được kiểm tra.

Do đổi authentication backend, các phiên đăng nhập lưu tên backend cũ cần đăng nhập lại. Không tự tạo Admin mới hoặc đặt mật khẩu mặc định.

Không tự rollback migration trên database đã tạo Admin không có email: schema cũ bắt buộc email, nên cần xử lý dữ liệu tương ứng hoặc khôi phục bản sao trước migration.

## Kiểm thử

- 47 tests backend đạt trong bộ kiểm tra chung; bổ sung 1 test migration đạt riêng. Test migration xác minh Admin cũ nhận username, giữ ID, tên, email, quyền và hash mật khẩu; Volunteer vẫn không có username.
- Các tests mới kiểm tra nhiều Admin không email, trùng/sai định dạng username, chuẩn hóa hoa/thường, sai mật khẩu, tài khoản khóa, chặn đăng nhập Admin qua email, chặn email reset, form Django Admin, đăng nhập Django Admin và lệnh tạo/đổi mật khẩu.
- 5 tests bảo vệ database E2E, ESLint và Vite build đạt.
- 18/18 ca Playwright đạt trên Chrome desktop và màn hình hẹp: xác thực, hồ sơ và Admin đăng nhập cả website lẫn Django Admin bằng username, không có email. Log: `tmp/admin-username-e2e.log`. Runner đã dọn đúng database test sau khi hoàn tất.

Phần xác thực Admin đã được đẩy lên `feature/auth` ngày 21/09/2026, commit `0efe855`. Các kiểm thử hồ sơ ở trên thuộc bản local có giai đoạn 3. Các mô tả giai đoạn 1 và kết quả kiểm tra trước đó được giữ để ghi nhận lịch sử.

Migration xác thực `0003` hiện phụ thuộc trực tiếp `0001_initial`; migration hồ sơ `0002` phụ thuộc `0003`. Giữ tên migration để tương thích lịch sử local đã áp dụng. Django chạy theo dependency, không theo số trong tên file. Cài mới hoặc nâng cấp từ giai đoạn 2 đều dùng lệnh `migrate` bình thường, không dùng `--fake`.
