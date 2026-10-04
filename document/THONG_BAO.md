# Thông báo trong website, nhắc lịch và email

Ngày cập nhật: 04/10/2026.

## Phạm vi sử dụng

Người đã đăng nhập mở biểu tượng chuông ở thanh đầu trang hoặc truy cập `/thong-bao`. Chuông hiển thị số chưa đọc, cập nhật khi chuyển trang, quay lại cửa sổ và mỗi phút khi trang đang mở. Trung tâm thông báo có bộ lọc Tất cả/Chưa đọc/Đã đọc, phân trang, đánh dấu từng mục hoặc tất cả đã đọc, và nút xem nội dung liên quan.

Mỗi tài khoản chỉ đọc và thay đổi thông báo của chính mình. Thông báo được giữ trong lịch sử ngay cả khi hoạt động thay đổi trạng thái; trang chi tiết luôn kiểm tra quyền và thể hiện dữ liệu hiện tại. Chưa có xóa thông báo hay thông báo đẩy của trình duyệt.

| Sự kiện | Người nhận | Nội dung được mở |
|---|---|---|
| Đăng ký mới hoặc đăng ký lại sau khi tự hủy | Nhà tổ chức sở hữu hoạt động | Danh sách đăng ký |
| Tình nguyện viên tự hủy đăng ký | Nhà tổ chức sở hữu hoạt động | Danh sách đăng ký |
| Duyệt hoặc từ chối | Tình nguyện viên gửi đơn | Chi tiết hoạt động |
| Đổi giờ bắt đầu/kết thúc hoặc địa chỉ | Người đang chờ duyệt và đã được duyệt | Chi tiết hoạt động |
| Hủy hoạt động | Người đang chờ duyệt và đã được duyệt, trước khi hệ thống hủy đơn | Chi tiết hoạt động |
| Xác nhận có mặt lần đầu | Người được điểm danh | Lịch sử tham gia |
| Gửi phản hồi | Nhà tổ chức sở hữu hoạt động | Danh sách phản hồi |
| Admin ẩn phản hồi | Tác giả phản hồi, kèm lý do | Phản hồi của người đó |
| Trước giờ bắt đầu 1 giờ | Người đã được duyệt trước hoặc đúng mốc nhắc | Chi tiết hoạt động |

Chỉ đổi tiêu đề, kỹ năng, ảnh bìa hoặc gửi lại cùng lịch/địa chỉ không tạo thông báo thay đổi lịch. Thử lại thao tác điểm danh/ẩn phản hồi không sinh thêm thông báo cho cùng quyết định. Không tạo lại thông báo cho nghiệp vụ đã xảy ra trước khi cài chức năng này.

## Quy tắc nhắc lịch

- Chỉ nhắc **trước 1 giờ**, không có mốc 24 giờ.
- Hoạt động phải còn Công khai, chưa bắt đầu; người nhận đang hoạt động và đơn đang Được duyệt.
- Nếu được duyệt sau mốc một giờ thì bỏ qua mốc đã qua, không gửi bù cho lần duyệt muộn.
- Tiến trình kiểm tra mỗi phút. Khi tiến trình tạm dừng, lần chạy tiếp theo có thể gửi lời nhắc trễ trong khoảng một giờ trước lúc bắt đầu; sau giờ bắt đầu thì bỏ qua.
- Hai tiến trình cùng chạy không tạo trùng lời nhắc. Khóa nhận diện gồm đơn đăng ký, lịch bắt đầu và lần xét duyệt. Đổi lịch có thể tạo lời nhắc mới cho lịch mới nếu đủ điều kiện.
- Email lời nhắc được kiểm tra lại trước khi gửi: đơn còn được duyệt, lịch và lần xét duyệt không đổi, hoạt động còn Công khai và chưa bắt đầu. Email lời nhắc cũ không còn hợp lệ được bỏ qua. Thông báo đã lưu trong website vẫn là lịch sử.

## Email và tùy chọn người dùng

Mặc định email được bật cho **tất cả thông báo nghiệp vụ và nhắc lịch**. Người dùng bật/tắt tại trang Thông báo. Tắt email không xóa thông báo trong website. Hàng đợi kiểm tra lại tùy chọn khi gửi; thư đã được máy chủ gửi thư tiếp nhận thì không thu hồi được. Khi bật lại, chỉ những thông báo phát sinh sau đó được xếp hàng, không gửi bù các mục đã bỏ qua. Email đặt lại mật khẩu là luồng xác thực riêng, không bị tắt bởi tùy chọn này.

Admin không có email vẫn sử dụng trung tâm thông báo; hệ thống không buộc thêm email cho tài khoản này. Tài khoản bị khóa không nhận email đang chờ.

Thông báo và email chờ gửi được lưu trong cùng giao dịch với thao tác nghiệp vụ. Nếu giao dịch bị hủy, cả thông báo và hàng đợi đều được hủy. Gửi email diễn ra ở tiến trình riêng để lỗi SMTP không làm lỗi đăng ký hoặc xét duyệt.

Mỗi thư thử tối đa 5 lần; các lần lỗi được chờ lần lượt 2, 4, 8, 16 phút trước khi thử tiếp. Sau lỗi thứ năm, trạng thái là `failed` để kiểm tra vận hành. Hàng đợi đang gửi bị bỏ dở được thu hồi sau 15 phút. Chỉ lưu mã lỗi chung, không lưu nội dung lỗi SMTP có thể chứa thông tin nhạy cảm.

SMTP không bảo đảm chính xác một lần: nếu máy chủ đã nhận thư nhưng tiến trình dừng trước khi lưu kết quả, lần thử lại có thể gửi trùng. `Message-ID` cố định hỗ trợ nhận diện cùng một thông báo. Trạng thái `sent` nghĩa là backend email đã tiếp nhận; không chứng minh thư đã vào hộp thư đến.

## Chạy tiến trình xử lý

Tại thư mục dự án, chạy backend và frontend như trước. Mở thêm tiến trình xử lý:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Target notifications
```

Hoặc chạy trực tiếp:

```powershell
.venv/Scripts/python.exe backend/manage.py process_notifications --loop
```

Tiến trình kiểm tra mỗi 60 giây, mỗi vòng mặc định tạo tối đa 200 lời nhắc và xử lý 200 email. Dùng `--limit` để điều chỉnh trong khoảng 1–10000. Ctrl+C dừng tiến trình. Cần giữ tiến trình chạy để tự động nhắc và gửi email; backend API không tự chạy bộ lập lịch. Chưa cài dịch vụ tự khởi động cùng Windows.

Chạy một lần hoặc chỉ tạo nhắc lịch mà không gửi email:

```powershell
.venv/Scripts/python.exe backend/manage.py process_notifications
.venv/Scripts/python.exe backend/manage.py process_notifications --reminders-only
```

Khi triển khai máy chủ, dùng trình quản lý tiến trình để duy trì lệnh `--loop`, hoặc lập lịch lệnh không có `--loop` chạy mỗi phút. Đặt thư mục làm việc là thư mục dự án, dùng đúng Python trong `.venv` và cấu hình `.env` của ứng dụng.

## Cấu hình SMTP

Mặc định dự án dùng `django.core.mail.backends.console.EmailBackend`: nội dung thư được ghi vào console, **không gửi ra Internet**. Điền các giá trị vào `backend/.env` để dùng SMTP thật:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=<máy chủ SMTP>
EMAIL_PORT=587
EMAIL_HOST_USER=<tài khoản gửi>
EMAIL_HOST_PASSWORD=<mật khẩu ứng dụng hoặc thông tin xác thực SMTP>
DEFAULT_FROM_EMAIL=<địa chỉ gửi được dịch vụ cho phép>
FRONTEND_URL=http://127.0.0.1:5173
```

Ứng dụng dùng STARTTLS và thời gian chờ kết nối 10 giây. Cấu hình này dành cho SMTP hỗ trợ STARTTLS, thường ở cổng 587. `FRONTEND_URL` phải là địa chỉ người nhận có thể truy cập; khi triển khai thật, thay loopback bằng tên miền của website. Khởi động lại backend và tiến trình thông báo sau khi đổi `.env`. Không đưa thông tin xác thực vào Git hay gửi qua chat.

## API và cấu trúc

Các đường dẫn dưới `/api/v1/notifications/` yêu cầu đăng nhập; thao tác ghi cần CSRF:

| Phương thức | Đường dẫn | Công dụng |
|---|---|---|
| GET | `/` | Danh sách phân trang; `state=all/unread/read`, `page`, `page_size` |
| GET | `/unread-count/` | Số chưa đọc của người hiện tại |
| POST | `/<id>/read/` | Đánh dấu một thông báo đã đọc; body `{}` |
| POST | `/read-all/` | Đánh dấu tất cả đã đọc; body `{}` |
| GET | `/preferences/` | Tùy chọn email và tài khoản có email hay không |
| PATCH | `/preferences/` | `{ "email_enabled": true/false }` |

`Notification` lưu nội dung và trạng thái đọc; `EmailDelivery` là hàng đợi; `NotificationPreference` lưu lựa chọn từng người. `services.py` tạo thông báo, `delivery.py` tạo lời nhắc và gửi thư; management command dùng cho lịch chạy. Không cung cấp API cho khách tự chỉ định người nhận hoặc nội dung thông báo.

Migration `notifications.0001_initial` thêm bảng mới. Trước khi áp dụng trên MySQL80 đã tạo snapshot `tmp/backups/snapshot-20261004-120642`, xác minh checksum và đối chiếu dữ liệu cũ sau migration không thay đổi.

## Kiểm chứng

Backend đã qua 142 tests toàn dự án, gồm 19 tests thông báo: quyền sở hữu, CSRF, dữ liệu sai, rollback, các sự kiện nghiệp vụ, gửi lặp, mốc một giờ, duyệt muộn, thay đổi lịch, hủy đơn, email bị tắt, lỗi gửi, thu hồi tác vụ và hai worker đồng thời. Thêm 8 tests bảo vệ runner; lint và build đạt.

Email được kiểm chứng bằng backend email nội bộ và mô phỏng lỗi, không gửi tới người dùng thật. Chưa cấu hình hoặc kiểm chứng SMTP bên ngoài.

Playwright đạt **58/58 ca** trên desktop 1280px và màn hình hẹp 390px. Luồng thông báo kiểm tra hai vai trò, liên kết tới danh sách đăng ký/hoạt động, số chưa đọc, đánh dấu tất cả, bộ lọc, bật/tắt email lưu qua tải lại, Admin không có email, lỗi kết nối và đăng xuất. Kiểm tra không tràn ngang ở 320/390/768/1280px. Đã kiểm tra trực quan ảnh desktop và màn hình hẹp. Máy chủ kiểm thử tăng hàng đợi kết nối để xử lý các yêu cầu tải trang đồng thời; các kiểm tra bảo vệ database vẫn được giữ nguyên.

Minh chứng cục bộ: `tmp/notifications-check.log`, `tmp/notifications-e2e.log`, ảnh trong `tmp/e2e-d6ce82abb8d5/screenshots/`. Dữ liệu kiểm thử nằm trong database MySQL riêng và đã được dọn sau khi chạy.
