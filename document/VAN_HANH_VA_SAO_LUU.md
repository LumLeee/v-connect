# Chạy, kiểm tra và sao lưu V-Connect

Áp dụng cho bản nghiệp vụ chính đến giai đoạn 9 trên Windows, Python trong `.venv`, React/Vite và MySQL80. Cấu hình dùng một file `backend/config/settings.py` và `backend/.env` như đã thống nhất.

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

## Kiểm tra sau thay đổi

Chạy lần lượt, không chạy backend tests và Playwright đồng thời vì cả hai dùng database kiểm thử cùng tên:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

Runner Playwright từ chối dùng lại/xóa database kiểm thử đã tồn tại. Nếu bị chặn, kiểm tra tiến trình kiểm thử còn chạy; không tự xóa database ứng dụng để giải quyết. Runner tạo MySQL mới từ toàn bộ migration, xác minh không còn migration chờ và seed chạy lặp không đổi dữ liệu.

Bài kiểm thử xuyên suốt chỉ mô phỏng thời gian bên trong tiến trình máy chủ kiểm thử riêng để đi qua các mốc đăng ký → điểm danh → hoàn thành. Cơ chế này không nằm trong backend ứng dụng, không đổi giờ Windows/MySQL và không có endpoint điều khiển thời gian trên website thật.

## Sao lưu database và avatar

Tạm dừng thao tác trên website trong lúc sao lưu nếu cần bản database/avatar nhất quán tại cùng thời điểm. Chạy:

```powershell
.\.venv\Scripts\python.exe scripts/backup.py
```

Script đọc tài khoản ứng dụng từ `.env`, gọi `mysqldump` với transaction nhất quán cho InnoDB và nén `backend/media`. Thông tin kết nối dùng file cấu hình tạm được xóa trong `finally`, không xuất mật khẩu ra command line/log. Không ghi vào database.

Kết quả nằm trong `tmp/backups/snapshot-YYYYMMDD-HHMMSS/`:

- `database.sql`: schema và dữ liệu của database được cấu hình, không thêm lệnh chọn/tạo database.
- `media.zip`: file avatar trong `backend/media`.
- `manifest.json`: thời điểm, tên database, số file media và SHA-256 của hai file trên.

Chỉ dùng snapshot có đủ ba file và script kết thúc thành công. Thư mục `tmp` không được đưa lên GitHub; bản sao lưu chứa dữ liệu riêng tư và mật khẩu tài khoản đã băm, cần lưu ở nơi riêng có kiểm soát truy cập. `.env` không được đóng gói: lưu cấu hình bí mật riêng để dùng khi chuyển máy.

## Khôi phục có kiểm soát

1. Chọn snapshot hoàn chỉnh; đối chiếu SHA-256 với manifest và kiểm tra ZIP đọc được.
2. Tạo database khôi phục riêng, chưa thay database ứng dụng. Trong công cụ MySQL, chọn đúng database này trước khi nhập `database.sql`; file SQL chứa thao tác thay bảng nên không nhập trực tiếp vào database đang dùng.
3. Giải nén `media.zip` vào thư mục media của bản cài khôi phục, giữ đường dẫn tương đối của avatar. Giữ bản media hiện tại riêng trước khi thay thế.
4. Cho bản cài kiểm tra kết nối vào database khôi phục, chạy `manage.py check`, kiểm tra migration, đăng nhập và đối chiếu hồ sơ/avatar, hoạt động, đơn, điểm danh, phản hồi, số liệu.
5. Chỉ chuyển bản đang dùng sang dữ liệu khôi phục sau khi đối chiếu đạt và đã sao lưu trạng thái hiện tại. Khởi động lại backend sau khi đổi cấu hình.

Trong giai đoạn 9 đã tạo và kiểm tra tính toàn vẹn của snapshot local; chưa thực hiện thay thế database thật bằng bản khôi phục. Quy trình khôi phục trên đây cần chạy ở database riêng trước khi dùng trong tình huống sự cố.

## Giới hạn bản local

Đã kiểm thử trên MySQL80 và Chrome ở desktop/màn hình nhỏ. Email đặt lại mật khẩu dùng backend kiểm thử; chưa xác minh SMTP thật. Chưa triển khai hosting, HTTPS hoặc kiểm thử tải lớn. Các chức năng phụ, QR và AI chưa thuộc bản nghiệp vụ chính này.
