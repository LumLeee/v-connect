# Kết quả giai đoạn 2: Tài khoản, xác thực và phân quyền

Ngày cập nhật: 15/09/2026.

## Kiểm tra bản xuất bản ngày 21/09/2026

- Bản giai đoạn 2 bao gồm Admin đăng nhập bằng username, email không bắt buộc; chưa có chức năng hồ sơ và avatar giai đoạn 3.
- 39/39 tests backend trên MySQL đạt, gồm kiểm tra migration giữ nguyên dữ liệu Admin cũ.
- 12/12 ca Playwright trên Chrome đạt trên desktop và màn hình hẹp; 5/5 tests bảo vệ dọn database đạt.
- Django check, kiểm tra migration, ESLint và Vite build đạt.
- Migration xác thực độc lập với hồ sơ; tên `0003` được giữ để tương thích lịch sử local đã áp dụng. Thứ tự chạy do dependency quyết định.
- Chỉ đẩy nhánh `feature/auth`; các kết quả ngày 15/09 bên dưới được giữ để ghi nhận lịch sử kiểm thử.

## Chức năng đã triển khai

- Đăng ký bằng email, họ tên, mật khẩu và xác nhận mật khẩu; cho phép chọn Volunteer hoặc Organizer.
- Email được chuẩn hóa chữ thường. Từ chối email trùng, mật khẩu yếu/không khớp và các trường cấp quyền trái phép.
- Đăng ký thành công tự tạo phiên; đăng nhập hỗ trợ ghi nhớ 14 ngày hoặc cookie phiên trình duyệt.
- Đăng xuất hủy session phía server; `/me` chỉ trả UUID, email, họ tên và vai trò của người đang đăng nhập.
- Session cookie HttpOnly, SameSite=Lax; các tùy chọn HTTPS vẫn đọc từ `.env` trong một file settings chung.
- CSRF bắt buộc cho POST, kể cả đăng ký, đăng nhập và đặt lại mật khẩu khi người dùng chưa đăng nhập.
- Khu vực riêng và API workspace cho Volunteer, Organizer, Admin. Sửa URL hoặc role trong request không cấp thêm quyền.
- Tài khoản bị khóa và session hết hạn không truy cập được API riêng tư.
- Quên mật khẩu trả thông báo chung; gửi liên kết một lần, thời hạn 1 giờ, theo origin cấu hình.
- Đặt lại mật khẩu kiểm tra token và mật khẩu, cập nhật trong transaction và vô hiệu hóa phiên cũ qua cơ chế Django.
- Giới hạn tần suất API xác thực/đặt lại mật khẩu; không trả token reset trong API response.
- Giao diện tiếng Việt cho đăng ký, đăng nhập, quên/đặt lại mật khẩu và thông tin tài khoản theo vai trò; có trạng thái gửi, lỗi, thành công và hiện/ẩn mật khẩu.
- Header có đăng nhập/đăng ký hoặc tài khoản/đăng xuất. Website lấy lại thông tin phiên khi cửa sổ nhận focus.
- Lệnh `createsuperuser` được kiểm thử để tạo Admin; không tạo tài khoản Admin mặc định trên database ứng dụng.

## Xác minh

| Kiểm tra | Kết quả |
|---|---|
| Django system check | Đạt |
| Kiểm tra model/migration | Không có thay đổi cần migration |
| Backend tests | 31/31 đạt trên MySQL: 9 tests nền tảng, 22 tests xác thực |
| ESLint | Đạt |
| Vite build | Đạt |
| HTTP qua Vite proxy | Hai vai trò đăng ký → lấy session HttpOnly → `/me` → workspace đúng → từ chối Admin → đăng xuất → đăng nhập lại thành công |
| Dữ liệu thử live | Hai tài khoản dùng email ngẫu nhiên `example.invalid`, đã xóa đúng các tài khoản do smoke test tạo |
| Đặt lại mật khẩu | Kiểm thử với email backend trong bộ nhớ: token sai/hết hạn/replay, mật khẩu yếu, session cũ và tài khoản bị khóa |
| Kiểm tra giao diện bằng trình duyệt | 12/12 ca Playwright trên Chrome đạt: Volunteer, Organizer, Admin, reset mật khẩu và bố cục hẹp |
| Bảo vệ dọn database E2E | 5/5 tests đạt; từ chối xóa khi connection/settings không cùng trỏ đúng database test |
| Dữ liệu thử UI | Tài khoản `ui.volunteer.1789444576990@example.invalid`, tên “Kiểm thử giao diện”; giữ phiên đăng nhập để người dùng xem kết quả |

Các tests bổ sung ở lượt hoàn thiện kiểm tra race uniqueness khi đăng ký, mật khẩu giống họ tên, `/me` không trả tài khoản khác qua query ID và lệnh tạo Admin.

Chạy lại bộ kiểm tra:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

## Dùng thử

- Đăng ký: http://127.0.0.1:5173/dang-ky
- Đăng nhập: http://127.0.0.1:5173/dang-nhap
- Quên mật khẩu: http://127.0.0.1:5173/quen-mat-khau

Mặc định email xuất ra terminal backend. Muốn nhận email thật cần cấu hình SMTP theo README; chưa kiểm thử nhà cung cấp email thật. Liên kết reset xuất hiện trong email console là thông tin nhạy cảm, không đưa log này lên Git hoặc chia sẻ công khai.

## Hoàn tất kiểm tra trình duyệt

Đã chạy form React qua API Django và MySQL thật trên Chrome headless, ở desktop 1280px và màn hình hẹp 390px; kiểm tra tràn ngang các form ở 320, 390, 640, 768 và 1280px. Đã xem ảnh giao diện sau sửa lỗi. Các ca bao gồm đăng ký hai vai trò công khai, đăng nhập Admin, đăng xuất, tải lại phiên, ghi nhớ đăng nhập, chặn trái quyền, email trùng, mật khẩu yếu và hiện/ẩn mật khẩu.

Luồng quên mật khẩu đọc email do Django ghi ra file, mở liên kết, kiểm tra mật khẩu xác nhận không khớp, đặt lại thành công, vô hiệu hóa phiên cũ, từ chối mật khẩu cũ và từ chối dùng lại liên kết. Chưa gửi qua SMTP thật.

Đã sửa liên kết giữa nhãn trường và thông báo lỗi bằng `aria-describedby`, đồng thời sửa khoảng trắng tiêu đề khi xuống bố cục hẹp. Bằng chứng local: `tmp/e2e-final-run.log`, ảnh trong `tmp/e2e-6055388ffbce/screenshots/`; các file này không được đưa lên Git.

Trong quá trình dọn lần thử đầu, script hỗ trợ đã xóa nhầm database ứng dụng. Đã khôi phục từ binary log, xác minh 11 bảng và migrations, lưu bản sao; dump trước/sau lượt E2E cuối khớp sau khi bỏ dòng thời gian dump. Xem [báo cáo sự cố và cách sửa](SU_CO_KIEM_THU_2026_09_15.md).

## Giới hạn

- Lượt kiểm tra mới đã đọc được Chrome và quan sát giao diện đăng ký/đăng nhập ở cửa sổ rộng khoảng 1058 px. Chữ tiếng Việt, các trường và liên kết hiển thị; liên kết từ đăng ký sang đăng nhập đổi route và nội dung đúng.
- Sau khi người dùng yêu cầu trực tiếp thao tác nhập mật khẩu/gửi form, đã hoàn thành đăng ký → workspace Volunteer → đăng xuất → đăng nhập lại qua UI. Form hiển thị mật khẩu được che và trạng thái đang xử lý; workspace hiển thị đúng tên, email và vai trò.
- Kiểm tra UI cho Organizer/Admin, quên/đặt lại mật khẩu và bố cục hẹp đã hoàn tất qua Playwright; các kiểm tra Chrome thủ công trước đó là bằng chứng bổ sung.
- API workspace hiện chỉ là khu vực thông tin tài khoản được bảo vệ; dashboard nghiệp vụ sẽ triển khai ở giai đoạn sau.
- Quyền sở hữu tài nguyên ở giai đoạn này áp dụng cho `/me` và session. Quyền sửa hồ sơ/hoạt động của mình được bổ sung khi xây API tương ứng.
- Throttle mặc định dùng cache từng tiến trình; nhiều worker cần cache chung và giới hạn tại reverse proxy.
- SMTP thật, triển khai HTTPS và các chức năng ngoài tài khoản chưa thuộc kết quả kiểm chứng này.

Giai đoạn 2 hoàn thành. Bản xuất bản trên feature/auth bổ sung Admin đăng nhập bằng username; xem CAP_NHAT_ADMIN_USERNAME.md. Các số liệu ngày 15/09 phía trên là kết quả kiểm tra tại thời điểm đó.
