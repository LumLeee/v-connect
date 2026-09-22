# Giai đoạn 3: Hồ sơ cơ bản, avatar và hồ sơ Nhà tổ chức

Ngày hoàn thiện: 22/09/2026. Nhánh bàn giao: `feature/profile`, kế thừa giai đoạn 2 (`0efe855`).

## Phạm vi

Theo kế hoạch mới, giai đoạn 3 hoàn thành hồ sơ tối thiểu phục vụ nghiệp vụ chính. Kỹ năng, sở thích, lịch rảnh, danh mục địa điểm và lưu file bên ngoài chuyển sang đợt bổ sung; không tính các phần này là đã triển khai.

- Người dùng xem/sửa họ tên, số điện thoại và giới thiệu của chính mình.
- Organizer có thêm tên tổ chức, mô tả, website HTTP/HTTPS và địa chỉ liên hệ.
- Admin giữ username làm định danh, không bắt buộc email; các định danh và vai trò không được sửa qua API hồ sơ.
- Tải lên, xem, thay và xóa avatar; chấp nhận JPEG/PNG/WebP tối đa 5 MB và 16 triệu điểm ảnh. Backend xác minh ảnh, mã hóa lại thành JPEG tối đa 512 × 512 và đặt tên ngẫu nhiên.
- Avatar chỉ được chủ tài khoản đọc qua API xác thực. Không mở thư mục media công khai.
- Giữ bản nháp khi quay lại cửa sổ; bỏ dữ liệu hồ sơ cũ khi chuyển tài khoản. Form hiển thị lỗi, trạng thái lưu và kết quả bằng tiếng Việt.

## API và migration

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| GET/PATCH | `/api/v1/auth/profile/` | Xem/sửa hồ sơ của phiên hiện tại |
| GET/POST/DELETE | `/api/v1/auth/profile/avatar/` | Đọc/tải/xóa avatar của phiên hiện tại |

Mọi thao tác ghi yêu cầu CSRF. Từ chối trường ngoài phạm vi và sửa hồ sơ tổ chức bằng vai trò khác. Cập nhật dữ liệu trong transaction; xóa ảnh cũ sau khi commit và dọn ảnh mới nếu lưu database thất bại.

Migration hồ sơ `0002_user_avatar_user_bio_user_phone_organizerprofile` phụ thuộc migration username `0003_user_username_alter_user_email_and_more`. Thứ tự phụ thuộc này cho phép cài từ đầu hoặc nâng cấp từ bản giai đoạn 2; giữ tên đã áp dụng tại local. Không rollback hoặc chạy lại migration đã áp dụng để đổi thứ tự số.

```powershell
.\.venv\Scripts\python.exe backend/manage.py migrate --noinput
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

## Kiểm chứng ngày 22/09/2026

- Django check và kiểm tra migration đạt; 48/48 tests backend trên MySQL và 5/5 tests bảo vệ dọn database đạt.
- ESLint và Vite build đạt; đã xem ảnh hồ sơ desktop và màn hình hẹp.
- 12/12 ca xác thực đạt trong lượt toàn bộ. Hai ca hồ sơ hẹp ban đầu bị ngắt yêu cầu đăng xuất do bài kiểm thử chuyển trang quá sớm; đã sửa để chờ chuyển đến trang đăng nhập và xác nhận `/me` trả 401 trước khi mở lại hồ sơ.
- Chạy lại toàn bộ nhóm hồ sơ sau sửa: 6/6 ca đạt, bao gồm lưu/tải, avatar, lỗi dữ liệu, giữ bản nháp và chuyển tài khoản. Tổng cộng 18 ca trình duyệt đã được kiểm chứng qua hai lượt; không ghi nhận lượt toàn bộ ban đầu là 18/18.
- Log local: `tmp/phase3-final-check.log`, `tmp/phase3-final-e2e.log`, `tmp/phase3-final-profile-e2e.log`. Runner đã dọn database test sau mỗi lượt.
- Danh sách file commit được kiểm tra để không chứa `.env`, thông tin bí mật, database dump, ảnh người dùng hoặc dependencies.

## Giới hạn

Ảnh hiện lưu trên filesystem local. Chưa có xác minh pháp lý tổ chức hoặc duyệt hồ sơ tổ chức. Việc tiếp theo là giai đoạn 4: quản lý và xem hoạt động theo kế hoạch mới.
