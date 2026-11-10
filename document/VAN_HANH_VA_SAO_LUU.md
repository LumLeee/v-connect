# Chạy, kiểm tra và sao lưu V-Connect

Áp dụng cho bản hiện tại trên Windows, Python trong `.venv`, React/Vite và MySQL80. Cấu hình backend nằm tại `backend/config/settings.py`, đọc biến môi trường từ `backend/.env`. Cài mới xem [README dự án](../README.md); mục lục chuyên đề xem [Tài liệu](README.md).

## Cập nhật hoặc cài đặt

Thực hiện tại thư mục dự án. Khi đã có môi trường, giữ nguyên `backend/.env` và database hiện có, không tạo lại tài khoản Admin hoặc chạy migration ngược.

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
npm.cmd --prefix frontend ci
.\.venv\Scripts\python.exe backend/manage.py migrate --noinput
.\.venv\Scripts\python.exe backend/manage.py seed_data
.\.venv\Scripts\python.exe backend/manage.py check
```

Máy mới xem các bước tạo `.venv`, `init_env.py` và `setup_mysql.py` trong README. `seed_data` chỉ bổ sung danh mục kỹ năng, không tạo tài khoản hoặc hoạt động giả; chạy lại không ghi đè dữ liệu đã có. Django chạy migration theo dependency, không theo thứ tự số trong tên file. Không sửa migration đã áp dụng hoặc dùng `--fake` để bỏ qua lỗi.

Mở hai terminal:

```powershell
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

```powershell
npm.cmd --prefix frontend run dev
```

Website: `http://127.0.0.1:5173`. Trang `/trang-thai` kiểm tra kết nối và migration qua Vite proxy. Admin dùng username; Volunteer/Organizer dùng email. Không có mật khẩu mẫu trên GitHub.

Muốn tự động nhắc lịch/gửi email, chạy thêm worker theo [Thông báo](THONG_BAO.md). AI cần chuẩn bị model riêng bằng `prepare_matching_model`; chi tiết cấu hình và dự phòng xem [AI ghép nối](AI_GHEP_NOI.md). Model nằm ngoài Git, không được đóng gói trong bản sao lưu database/media.

## Kiểm tra sau thay đổi

Chạy lần lượt, không chạy backend tests và Playwright đồng thời vì cả hai dùng database kiểm thử cùng tên:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

Backend test và Playwright đều từ chối dùng lại/xóa schema đã tồn tại, kể cả khi chạy `--noinput`. Chỉ database mới với dấu sở hữu của lượt chạy hiện tại được dọn; không hỗ trợ `--keepdb` hoặc nhiều worker. Nếu bị chặn, kiểm tra tiến trình cũ và nguồn gốc schema còn lại, không tự xóa database ứng dụng để giải quyết. Runner Playwright tạo schema MySQL từ toàn bộ migration, xác minh không còn migration chờ và seed chạy lặp không đổi dữ liệu. Chi tiết chốt bảo vệ xem [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md).

Bài kiểm thử xuyên suốt chỉ mô phỏng thời gian bên trong tiến trình máy chủ kiểm thử riêng để đi qua các mốc đăng ký → điểm danh → hoàn thành. Cơ chế này không nằm trong backend ứng dụng, không đổi giờ Windows/MySQL và không có endpoint điều khiển thời gian trên website thật.

## Sao lưu database và media

Tạm dừng thao tác trên website trong lúc sao lưu nếu cần bản database/media nhất quán tại cùng thời điểm. Chạy:

```powershell
.\.venv\Scripts\python.exe scripts/backup.py
```

Script đọc tài khoản ứng dụng từ `.env`, gọi `mysqldump` với transaction nhất quán cho InnoDB và nén `backend/media`. Thông tin kết nối dùng file cấu hình tạm được xóa trong `finally`, không xuất mật khẩu ra command line/log. Không ghi vào database.

Kết quả nằm trong `tmp/backups/snapshot-YYYYMMDD-HHMMSS/`:

- `database.sql`: schema và dữ liệu của database được cấu hình, không thêm lệnh chọn/tạo database.
- `media.zip`: toàn bộ file trong `backend/media`, gồm avatar và ảnh bìa hoạt động.
- `manifest.json`: thời điểm, tên database, số file media và SHA-256 của hai file trên.

Chỉ dùng snapshot có đủ ba file và script kết thúc thành công. Thư mục `tmp` không được đưa lên GitHub; bản sao lưu chứa dữ liệu riêng tư và mật khẩu tài khoản đã băm, cần lưu ở nơi riêng có kiểm soát truy cập. `.env` không được đóng gói: lưu cấu hình bí mật riêng để dùng khi chuyển máy.

## Khôi phục có kiểm soát

1. Chọn snapshot hoàn chỉnh; đối chiếu SHA-256 với manifest và kiểm tra ZIP đọc được.
2. Tạo database khôi phục riêng, chưa thay database ứng dụng. Trong công cụ MySQL, chọn đúng database này trước khi nhập `database.sql`; file SQL chứa thao tác thay bảng nên không nhập trực tiếp vào database đang dùng.
3. Giải nén `media.zip` vào thư mục media của bản cài khôi phục, giữ đường dẫn tương đối của các tệp. Giữ bản media hiện tại riêng trước khi thay thế.
4. Cho bản cài kiểm tra kết nối vào database khôi phục, chạy `manage.py check`, kiểm tra migration, đăng nhập và đối chiếu hồ sơ/avatar, hoạt động, đơn, điểm danh, phản hồi, số liệu.
5. Chỉ chuyển bản đang dùng sang dữ liệu khôi phục sau khi đối chiếu đạt và đã sao lưu trạng thái hiện tại. Khởi động lại backend sau khi đổi cấu hình.

Kiểm tra checksum chỉ xác nhận tính toàn vẹn của tệp, không thay cho thử khôi phục. Thực hiện quy trình ở database riêng và đối chiếu dữ liệu trước khi dùng bản sao lưu để thay thế database đang hoạt động.

## Giới hạn bản local

Email mặc định ghi console; chưa xác minh SMTP thật. Chưa xác nhận triển khai hosting, HTTPS hoặc khả năng chịu tải lớn. AI chạy offline khi model sẵn sàng và có dự phòng; giới hạn chất lượng được công bố trong hai tài liệu AI, không suy từ số ca kiểm thử ứng dụng. Trạng thái chức năng hiện tại xem [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md).
