# Thông báo trong website, nhắc lịch và email

## Phạm vi sử dụng

Người đã đăng nhập mở chuông trên thanh đầu trang hoặc `/thong-bao`. Chuông hiển thị số chưa đọc, cập nhật khi chuyển trang, quay lại cửa sổ, có sự kiện thay đổi thông báo và mỗi 15 giây khi trang đang hiển thị. Biểu tượng rung khi nhận được ID thông báo mới. Trung tâm có bộ lọc Tất cả/Chưa đọc/Đã đọc, phân trang và đánh dấu từng mục/tất cả đã đọc. Bố cục theo vai trò xem [Giao diện](GIAO_DIEN.md).

Mỗi tài khoản chỉ đọc và thay đổi thông báo của chính mình. Thông báo được giữ trong lịch sử ngay cả khi hoạt động thay đổi trạng thái; trang chi tiết luôn kiểm tra quyền và thể hiện dữ liệu hiện tại. Chưa có xóa thông báo hay thông báo đẩy của trình duyệt.

| Sự kiện | Người nhận | Nội dung được mở |
|---|---|---|
| Đăng ký mới hoặc đăng ký lại sau khi tự hủy | Nhà tổ chức sở hữu hoạt động | Danh sách đăng ký |
| Tình nguyện viên tự hủy đăng ký | Nhà tổ chức sở hữu hoạt động | Danh sách đăng ký |
| Duyệt hoặc từ chối | Tình nguyện viên gửi đơn | Chi tiết hoạt động |
| Đổi giờ bắt đầu/kết thúc hoặc địa chỉ | Người đang chờ duyệt và đã được duyệt | Chi tiết hoạt động |
| Hủy hoạt động | Người đang chờ duyệt và đã được duyệt, trước khi hệ thống hủy đơn | Danh sách đăng ký đã hủy |
| Xác nhận có mặt lần đầu | Người được điểm danh | Lịch sử tham gia |
| Gửi phản hồi | Nhà tổ chức sở hữu hoạt động | Danh sách phản hồi |
| Admin ẩn phản hồi | Tác giả phản hồi, kèm lý do | Phản hồi của người đó |
| Xác nhận hoặc điều chỉnh điểm đóng góp | Tình nguyện viên được chấm điểm | Đóng góp của tôi |
| Gửi hoặc thu hồi lời mời | Tình nguyện viên nhận lời mời | Lời mời của tôi |
| Chấp nhận hoặc từ chối lời mời | Nhà tổ chức gửi lời mời | Danh sách lời mời của hoạt động |
| Chấp nhận lời mời và được tự động duyệt | Tình nguyện viên nhận lời mời | Quản lý đăng ký |
| Trước giờ bắt đầu 1 giờ | Người đã được duyệt trước hoặc đúng mốc nhắc | Chi tiết hoạt động |

Chỉ đổi tiêu đề, kỹ năng, ảnh bìa hoặc gửi lại cùng lịch/địa chỉ không tạo thông báo thay đổi lịch. Thử lại thao tác điểm danh/ẩn phản hồi không sinh thêm thông báo cho cùng quyết định. Không tạo lại thông báo cho nghiệp vụ đã xảy ra trước khi cài chức năng này.

Với thông báo cũ dẫn tới chi tiết hoạt động, API chuyển đích của Volunteer sang danh sách đăng ký cá nhân khi hoạt động không còn Công khai; hoạt động bị hủy dùng bộ lọc Đã hủy. Liên kết không cấp quyền truy cập vượt dữ liệu tham gia của người nhận.

Email dùng liên kết tới trang cá nhân/quản lý theo vai trò ngay từ lúc gửi, để vẫn mở được khi hoạt động đổi trạng thái sau đó. Tình nguyện viên mở danh sách đăng ký, chủ hoạt động mở chi tiết quản lý, Admin mở kết quả hoạt động; các liên kết chức năng riêng vẫn được giữ.

## Quy tắc nhắc lịch

- Chỉ nhắc **trước 1 giờ**, không có mốc 24 giờ.
- Hoạt động phải còn Công khai, chưa bắt đầu; người nhận đang hoạt động và đơn đang Được duyệt.
- Nếu được duyệt sau mốc một giờ thì bỏ qua mốc đã qua, không gửi bù cho lần duyệt muộn.
- Tiến trình kiểm tra mỗi phút. Khi tiến trình tạm dừng, lần chạy tiếp theo có thể gửi lời nhắc trễ trong khoảng một giờ trước lúc bắt đầu; sau giờ bắt đầu thì bỏ qua.
- Hai tiến trình cùng chạy không tạo trùng lời nhắc. Khóa nhận diện gồm đơn đăng ký, lịch bắt đầu và lần xét duyệt. Đổi lịch có thể tạo lời nhắc mới cho lịch mới nếu đủ điều kiện.
- Email lời nhắc được kiểm tra lại trước khi gửi: đơn còn được duyệt, lịch và lần xét duyệt không đổi, hoạt động còn Công khai và chưa bắt đầu. Nội dung lấy tiêu đề/địa điểm mới nhất ở mỗi lần gửi hoặc thử lại. Email lời nhắc cũ không còn hợp lệ được bỏ qua. Thông báo đã lưu trong website vẫn là lịch sử.

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

Migration `notifications.0001_initial` tạo các bảng thông báo. Sao lưu và chạy toàn bộ migration hiện có theo [Vận hành và sao lưu](VAN_HANH_VA_SAO_LUU.md).

Kiểm thử tập trung vào quyền sở hữu, CSRF, rollback, chống gửi trùng, mốc một giờ, duyệt muộn, đổi lịch, hủy đơn, tùy chọn email, lỗi gửi và hai worker đồng thời. Email được kiểm tra bằng backend nội bộ/mô phỏng lỗi; chưa xác minh SMTP bên ngoài. Cách chạy xem [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md).
