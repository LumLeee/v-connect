# Tài khoản, phiên đăng nhập và hồ sơ

## Định danh và quyền

| Vai trò | Định danh đăng nhập | Cách tạo |
|---|---|---|
| Tình nguyện viên (`volunteer`) | Email duy nhất, chuẩn hóa chữ thường | Form đăng ký công khai |
| Nhà tổ chức (`organizer`) | Email duy nhất, chuẩn hóa chữ thường | Form đăng ký công khai |
| Admin (`admin`) | Username duy nhất, chuẩn hóa chữ thường; email tùy chọn | Lệnh `createsuperuser` hoặc Django Admin phù hợp quyền |

Username Admin dài tối đa 150 ký tự, chỉ nhận chữ không dấu, số, dấu chấm, gạch dưới và gạch ngang; không nhận `@`. Tài khoản công khai không dùng username. Không có form công khai tạo Admin hoặc cấp quyền staff/superuser.

`IdentityBackend` tra Volunteer/Organizer theo email khi định danh chứa `@`, còn Admin theo username. Admin không đăng nhập bằng email cũ. API đăng nhập dùng `identifier` và `password`, tùy chọn `remember`; vẫn nhận một trường `email` hoặc `username` thay cho `identifier`, nhưng từ chối gửi nhiều trường định danh cùng lúc.

Ba vai trò được bảo vệ ở API và ràng buộc dữ liệu. Sửa URL, query hoặc trường `role` trong request không cấp thêm quyền. UserManager băm mật khẩu bằng `set_password()`; mật khẩu không lưu nguyên văn. Các form đăng ký/đặt lại mật khẩu dùng bộ kiểm tra mật khẩu Django, không coi mật khẩu mẫu local là quy tắc của hệ thống.

## Phiên và CSRF

Ứng dụng dùng **Django session**, không dùng JWT lưu trong localStorage. Trình duyệt gửi cookie phiên HttpOnly, SameSite=Lax; cấu hình HTTPS bật thêm Secure. Không chọn ghi nhớ dùng cookie phiên trình duyệt; chọn ghi nhớ đặt tuổi phiên 14 ngày. Đăng ký thành công tạo phiên đăng nhập.

Các tab cùng dùng kho cookie của một trình duyệt/profile sẽ dùng chung tài khoản. Muốn thử đồng thời nhiều vai trò với triển khai hiện tại, dùng các profile trình duyệt hoặc phiên trình duyệt được cô lập. Mở thêm một tab cùng kho cookie không tạo một tài khoản riêng.

Mọi request ghi yêu cầu CSRF, kể cả đăng ký, đăng nhập và đặt lại mật khẩu khi chưa đăng nhập. Frontend lấy token từ `/auth/csrf/` rồi gửi `X-CSRFToken`. `/auth/me/` trả người của phiên hiện tại, không cho chọn tài khoản khác bằng query ID. Frontend kiểm tra lại phiên khi cửa sổ nhận focus, giữ bản nháp qua lỗi kết nối tạm thời và bỏ hồ sơ của tài khoản cũ khi đổi danh tính.

Đăng xuất hủy session phía server. Đổi mật khẩu hoặc khóa tài khoản vô hiệu hóa phiên theo cơ chế xác thực của Django. Giới hạn tần suất xác thực/reset dùng cache; nhiều worker cần cấu hình cache chung và giới hạn tại reverse proxy.

## API xác thực

Các đường dẫn dưới đây có tiền tố `/api/v1/`.

| Method | Endpoint | Nội dung |
|---|---|---|
| GET | `auth/csrf/` | Lấy CSRF token |
| POST | `auth/register/` | `email`, `full_name`, `role`, `password`, `password_confirm` |
| POST | `auth/login/` | `identifier`, `password`, tùy chọn `remember` |
| POST | `auth/logout/` | Hủy phiên |
| GET | `auth/me/` | `id`, `email`, `username`, `full_name`, `role` của người đăng nhập |
| GET | `auth/workspace/<role>/` | Kiểm tra workspace đúng vai trò |
| POST | `auth/password-reset/` | Yêu cầu hướng dẫn qua email |
| POST | `auth/password-reset/confirm/` | `uid`, `token`, `password`, `password_confirm` |

Quên mật khẩu luôn trả thông báo chung, không tiết lộ email có tồn tại. Token một lần có hạn một giờ; liên kết dùng `FRONTEND_URL` cấu hình sẵn. Chỉ Volunteer/Organizer đang hoạt động được reset qua email. Mặc định email in ở terminal backend; cần cấu hình và kiểm chứng SMTP trước khi dùng thật. Không đưa liên kết reset, log email hoặc token lên Git.

Admin đổi mật khẩu bằng lệnh quản trị từ thư mục dự án:

```powershell
.\.venv\Scripts\python.exe backend/manage.py changepassword <username>
```

Tạo superuser dùng `backend/manage.py createsuperuser`; lệnh hỏi username và mật khẩu, không bắt buộc email/họ tên, tên hiển thị mặc định là username. Không có mật khẩu mặc định để ghi trong tài liệu.

## Hồ sơ cơ bản và tổ chức

`GET/PATCH /api/v1/auth/profile/` chỉ đọc/sửa người của session, phản hồi bọc trong `profile`. Email, username, ID, role và quyền không sửa qua API này; trường ngoài danh sách cho phép bị từ chối.

| Trường | Quy tắc |
|---|---|
| `full_name` | Bắt buộc, tối đa 150 ký tự |
| `phone` | Tùy chọn, tối đa 25 ký tự; nếu nhập phải có 7–15 chữ số, cho phép dấu `+` ở đầu và dấu phân cách thông dụng |
| `bio` | Tùy chọn, tối đa 2.000 ký tự |
| `organizer.organization_name` | Chỉ Nhà tổ chức, tối đa 200 ký tự |
| `organizer.description` | Tối đa 4.000 ký tự |
| `organizer.website` | Tối đa 300 ký tự, chỉ HTTP/HTTPS |
| `organizer.contact_address` | Tối đa 300 ký tự |

Thông tin cơ bản và object tổ chức/tình nguyện được lưu trong cùng transaction, khóa User khi cập nhật. Dữ liệu sai không làm lưu dở dang. Không bắt tài khoản cũ điền các trường tùy chọn; bản ghi hồ sơ bổ sung được tạo khi cần lưu. PATCH không gửi trường nào thì giữ trường đó.

## Hồ sơ tình nguyện mở rộng

Object `volunteer` trong API hồ sơ gồm:

- `skills`: tối đa 20 ID có trong `/api/v1/skills/`, không trùng.
- `interests`: tối đa 20 mục, mỗi mục 80 ký tự; bỏ khoảng trắng đầu/cuối, không trùng kể cả khác hoa/thường.
- `availability`: tối đa 28 khung mỗi tuần, giờ Việt Nam UTC+7, định dạng `HH:MM`. `weekday` từ 0 (thứ hai) đến 6 (chủ nhật). Mỗi khung đủ ngày/giờ đầu/giờ cuối, kết thúc sau bắt đầu trong cùng ngày; không chồng lấn, có thể liền nhau.
- `matching_visible`: mặc định `false`; Tình nguyện viên chủ động cho phép xuất hiện trong gợi ý cho Nhà tổ chức.

Ví dụ PATCH (ID kỹ năng phải lấy từ danh mục của database đang dùng):

```json
{
  "volunteer": {
    "skills": [1, 2],
    "interests": ["Giáo dục cộng đồng"],
    "availability": [{"weekday": 5, "starts_at": "08:30", "ends_at": "11:30"}],
    "matching_visible": true
  }
}
```

Gửi danh sách sẽ thay toàn bộ danh sách tương ứng; `[]` xóa danh sách; bỏ trường thì giữ nguyên. Chưa khai báo nghĩa là thiếu thông tin, không phải kết luận người đó không có kỹ năng hoặc không thể tham gia. Lịch rảnh lặp hằng tuần, chưa có ngoại lệ theo ngày hay lịch nghỉ. Dữ liệu này đã được dùng trong [ghép nối AI local](AI_GHEP_NOI.md); quyền được gợi ý không tự đăng ký hoặc tự duyệt đơn.

`VolunteerProfile` liên kết một-một với User; kỹ năng là quan hệ nhiều-nhiều; sở thích lưu JSON; `AvailabilitySlot` lưu từng khung giờ. Kiểm tra chồng lấn thực hiện tại serializer, kết hợp ràng buộc ngày/thứ tự giờ/khung trùng ở database.

## Avatar và hồ sơ ứng viên

`GET/POST/DELETE /api/v1/auth/profile/avatar/` đọc, thay hoặc xóa ảnh của chính tài khoản. POST multipart nhận đúng một file `avatar`; ảnh lưu ngay khi chọn hoặc dán, tách khỏi nút lưu thông tin văn bản.

Backend chỉ nhận JPEG/PNG/WebP có nội dung hợp lệ, tối đa 5 MB và 16 triệu điểm ảnh. Ảnh được chỉnh hướng theo EXIF, thu trong 512 × 512, mã hóa lại JPEG để bỏ metadata và đặt tên UUID. File lưu trong media local; database giữ đường dẫn tương đối. Không mở toàn bộ thư mục media công khai.

Thay/xóa ảnh dọn file cũ sau khi transaction commit; nếu ghi database lỗi thì dọn file mới. Lỗi storage có thể để lại file không còn tham chiếu và được ghi cảnh báo; chưa có công cụ dọn file mồ côi định kỳ.

Nhà tổ chức được xem hồ sơ và avatar ứng viên **đã có đơn trong hoạt động của mình**, qua:

- `GET /api/v1/organizer/activities/<activity_id>/applicants/<entry_id>/`
- `GET /api/v1/organizer/activities/<activity_id>/applicants/<entry_id>/avatar/`

`entry_id` là ID đơn Participation, không phải User ID. Giao diện `/ho-so?hoat-dong=<activity_id>&ung-vien=<entry_id>` dùng chung bố cục hồ sơ ở chế độ chỉ xem, ẩn thông tin rỗng và kỹ năng chưa chọn, giữ ảnh hoặc ảnh đại diện mặc định. Không cung cấp quyền sửa hồ sơ ứng viên. Phạm vi này khác với gợi ý ghép nối: gợi ý chỉ chia sẻ thông tin cần thiết theo quyền; hồ sơ ứng viên trả thông tin hồ sơ cho đúng chủ hoạt động. Không còn đúng nếu mô tả mọi avatar/hồ sơ mở rộng là chỉ chủ tài khoản đọc được.

## Admin khóa và mở khóa tài khoản

Trang `/quan-tri/tai-khoan` dùng `GET /api/v1/admin/accounts/`, hỗ trợ `search` theo họ tên/email/username (tối đa 200 ký tự), `role`, `status=active|locked` và phân trang. API chỉ dành cho Admin.

`POST /api/v1/admin/accounts/<id>/status/` nhận:

```json
{"is_active": false, "reason": "Lý do khóa tài khoản"}
```

Lý do bắt buộc sau khi bỏ khoảng trắng, tối đa 1.000 ký tự. Chỉ xử lý Volunteer/Organizer; từ chối tài khoản có role Admin, staff hoặc superuser. Mở khóa gửi `is_active: true` và lý do. Backend khóa hàng User, đổi trạng thái và ghi nhật ký trước–sau trong cùng transaction.

Khi trạng thái thực sự đổi, `session_version` tăng; phiên cũ bị vô hiệu kể cả sau mở khóa. Người dùng phải đăng nhập lại với mật khẩu hiện có. Gửi lại cùng trạng thái không tăng phiên bản hoặc tạo thêm nhật ký. Khóa không xóa dữ liệu, không đổi mật khẩu, không tự hủy hoạt động của Nhà tổ chức và không xóa lịch sử tham gia/phản hồi.

Hoạt động của Nhà tổ chức bị khóa tạm ngừng nhận đăng ký mới hoặc đăng ký lại, kể cả khi đang tắt kiểm tra thời gian. Người đã đăng ký vẫn có thể hủy đơn khi hoạt động còn mở hủy. Mở khóa cho phép nhận đăng ký trở lại nếu các điều kiện khác còn đáp ứng.

Trong Django Admin, `is_active` chỉ đọc và không mở xóa tài khoản; khóa/mở khóa qua website để bắt buộc lý do và nhật ký. Xem [báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md) để đối chiếu thao tác.

## Lưu ý nâng cấp dữ liệu

Migration username gán `admin_<UUID không dấu gạch>` cho Admin cũ, giữ email, UUID, quyền, hồ sơ và hash mật khẩu. Email cũ không còn là tên đăng nhập Admin; phiên dùng authentication backend cũ cần đăng nhập lại. Nếu muốn dùng username dễ nhớ, đổi có chủ đích qua Django Admin và vẫn tuân thủ quy tắc duy nhất/định dạng.

Migration hồ sơ thêm trường/bảng tùy chọn, không tự suy diễn kỹ năng hoặc sở thích. Không rollback mù về schema bắt buộc email khi đã có Admin không email. Giữ migration đã áp dụng và sao lưu trước nâng cấp; xem [kiến trúc](KIEN_TRUC.md) và [kiểm thử](TRANG_THAI_VA_KIEM_THU.md).
