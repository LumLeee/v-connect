# V-Connect

Website quản lý tình nguyện viên, xây mới bằng **React JavaScript + Vite, Django REST Framework và MySQL**. Giao diện tiếng Việt. Không dùng TypeScript, Supabase hoặc ứng dụng mobile riêng.

## Trạng thái

Bản nền tảng giai đoạn 1: Django/DRF, MySQL, custom User, danh mục kỹ năng, health API và giao diện React tiếng Việt. Chưa có đăng ký/đăng nhập website, hồ sơ, hoạt động hoặc AI.

Kết quả: [giai đoạn 1](document/GIAI_DOAN_1_KET_QUA.md).

Kế hoạch chi tiết: [document/KE_HOACH_TRIEN_KHAI.md](document/KE_HOACH_TRIEN_KHAI.md).

## 1. Yêu cầu

- Python 3.12, pip và venv.
- Node.js 22.12+ hoặc 24; npm. Môi trường hiện tại được kiểm tra với Node 24.
- MySQL 8.0.11+; máy hiện tại dùng dịch vụ **MySQL80, phiên bản 8.0.40**, cổng 3306.
- Terminal PowerShell, thư mục làm việc `D:\V-connect`.

Trên Windows/Python 3.12, `mysqlclient` có wheel. Trên Linux, cần cài các thư viện phát triển MySQL và compiler trước khi cài Python dependencies.

## 2. Cài đặt

```powershell
cd D:\V-connect
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
cd frontend
npm.cmd ci --cache D:/V-connect/.npm-cache
cd ..
.\.venv\Scripts\python.exe backend/scripts/init_env.py
```

Nếu `py` chưa có trên PATH, dùng đường dẫn đến Python 3.12. `requirements.lock` và `frontend/package-lock.json` cố định phiên bản đã cài; `requirements.txt` mô tả khoảng phiên bản cho lần nâng cấp có chủ đích.

`init_env.py` sinh khóa Django và mật khẩu tài khoản ứng dụng ngẫu nhiên. Nếu `backend/.env` đã tồn tại, script giữ nguyên toàn bộ nội dung.

## 3. Chuẩn bị MySQL80

Kiểm tra MySQL đang chạy:

```powershell
Get-Service MySQL80
```

Điền `MYSQL_ADMIN_USER` và `MYSQL_ADMIN_PASSWORD` trong `backend/.env` bằng tài khoản MySQL có quyền tạo database/user. Không gửi mật khẩu lên Git hoặc đưa vào command line.

Sau đó chạy:

```powershell
.\.venv\Scripts\python.exe backend/scripts/setup_mysql.py
.\.venv\Scripts\python.exe backend/manage.py migrate --noinput
.\.venv\Scripts\python.exe backend/manage.py seed_data
```

Script tạo database `v_connect` với `utf8mb4_unicode_ci` và tài khoản `v_connect@localhost`, cấp quyền giới hạn cho database ứng dụng cùng `test_v_connect`. Database test do Django tạo/xóa khi kiểm thử; không đặt `DB_TEST_NAME` trùng database có dữ liệu cần giữ. Quyền DDL là để chạy migration/test trong development; production nên dùng tài khoản migration riêng.

Script không xóa database và không thay mật khẩu user đã tồn tại. Nếu tên user trùng tài khoản có sẵn, phải đặt `DB_PASSWORD` đúng với user đó hoặc chọn tên ứng dụng riêng. Không đổi thông tin ứng dụng sau khi provision nếu chưa cập nhật tương ứng trong MySQL.

`MYSQL_ADMIN_*` chỉ được script chuẩn bị database sử dụng. Ứng dụng chạy với `DB_USER`, không dùng root. Có thể xóa giá trị `MYSQL_ADMIN_PASSWORD` sau khi hoàn tất chuẩn bị database.

`seed_data` tạo 8 kỹ năng tiếng Việt, có thể chạy nhiều lần, không ghi đè tên kỹ năng đã chỉnh sửa. Không tạo số liệu hoạt động giả.

## 4. Chạy local

Mở hai terminal ở thư mục dự án.

**Terminal 1 — backend:**

```powershell
.\.venv\Scripts\python.exe backend/manage.py runserver 127.0.0.1:8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm.cmd run dev
```

Hoặc dùng `./scripts/dev.ps1 -Target backend` và `./scripts/dev.ps1 -Target frontend` nếu máy cho phép chạy PowerShell script.

- Website: http://127.0.0.1:5173/
- Trang kiểm tra kết nối: http://127.0.0.1:5173/trang-thai
- API readiness: http://127.0.0.1:8000/api/v1/health/
- Django Admin: http://127.0.0.1:8000/admin/ — chưa có tài khoản sẵn.

Vite proxy `/api` tới `http://127.0.0.1:8000`; frontend gọi API cùng origin. Không cấu hình CORS mở toàn bộ. Development chỉ bind loopback; responsive cho màn hình nhỏ đã được chuẩn bị, truy cập từ thiết bị khác cần cấu hình mạng/host riêng.

## 5. API nền tảng

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/api/v1/health/` | Kiểm tra kết nối MySQL và migration đã áp dụng |
| GET | `/api/v1/skills/` | Danh mục kỹ năng, public/read-only, có phân trang |

Health trả HTTP 200 khi database kết nối được và không còn migration chờ. Trả HTTP 503 khi database chưa sẵn sàng hoặc migration chưa đầy đủ. Không trả credentials hoặc nội dung lỗi kết nối MySQL.

```json
{
  "status": "ok",
  "service": "v-connect-api",
  "database": "connected",
  "migrations": "applied",
  "timestamp": "<ISO-8601>"
}
```

Danh sách dùng cấu trúc `count`, `next`, `previous`, `results`. Mặc định 20 bản ghi; `?page=2&page_size=10`, tối đa 100 mỗi trang. Lỗi API dùng cấu trúc:

```json
{
  "error": {
    "code": "method_not_allowed",
    "message": "Phương thức không được hỗ trợ.",
    "details": {}
  }
}
```

Khi `DJANGO_DEBUG=True`, Django có thể trả trang debug cho đường dẫn không tồn tại ngoài DRF. Khi debug tắt (bao gồm lúc chạy Django tests), handler 400/403/404/500 dùng JSON. Mỗi response có `X-Request-ID`; log ứng dụng ghi method/path/status/thời gian, không ghi body, cookie, header xác thực hoặc giá trị query.

## 6. Kiểm tra

```powershell
.\.venv\Scripts\python.exe scripts/check.py
```

Lệnh này dừng ngay khi có bước lỗi. `scripts/check.ps1` là tùy chọn tương đương cho máy cho phép chạy PowerShell script; máy hiện tại chặn `.ps1`, nên dùng lệnh Python trên, không cần đổi execution policy.

Hoặc chạy từng bước:

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe backend/manage.py test apps.core apps.accounts --noinput
cd frontend
npm.cmd run lint
npm.cmd run build
cd ..
```

Tests dùng MySQL thật trong database riêng. Hiện có 9 tests nền tảng: readiness, phân trang, UTF-8, seed, custom User và vai trò superuser. Không dùng SQLite làm kết quả thay thế cho MySQL.

Kiểm tra đường đi qua Vite proxy sau khi hai server chạy:

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/v1/health/
Invoke-RestMethod http://127.0.0.1:5173/api/v1/skills/
```

## 7. Cấu hình môi trường

| Biến | Ý nghĩa |
|---|---|
| `DJANGO_DEBUG` | `True` để bật debug local; mặc định `False` khi không khai báo |
| `DJANGO_HTTPS` | `True` để bật HTTPS redirect, secure cookies và HSTS; local dùng `False` |
| `DJANGO_SECRET_KEY` | Khóa bí mật riêng từng môi trường |
| `DJANGO_ALLOWED_HOSTS` | Danh sách host, phân cách bằng dấu phẩy |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Các origin được phép gửi request CSRF |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Kết nối MySQL |
| `DB_TEST_NAME` | Database kiểm thử riêng, mặc định `test_v_connect` |
| `VITE_API_BASE_URL` | URL công khai, mặc định `/api/v1` |
| `VITE_BACKEND_PROXY` | Backend cho Vite development proxy |

Frontend có `frontend/.env.example`; chỉ cần copy thành `.env` khi muốn đổi mặc định. Mọi biến `VITE_*` có thể xuất hiện trong bundle, không lưu secrets ở frontend.

Django dùng duy nhất `backend/config/settings.py`, không tách file theo môi trường và không dùng `DJANGO_ENV`. Khi triển khai HTTPS, đặt `DJANGO_DEBUG=False`, `DJANGO_HTTPS=True` và `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend` trong biến môi trường. Cần đặt host thật, CSRF origins, email SMTP, reverse proxy, static/media và WSGI/ASGI server trước khi triển khai. `TRUST_PROXY_SSL_HEADER=1` chỉ dùng sau trusted proxy có ghi đè `X-Forwarded-Proto`. Không dùng Django runserver hoặc Vite dev server cho production.

Build frontend nằm ở `frontend/dist`; web server production phải fallback các route ứng dụng về `index.html` và proxy `/api` tới Django. `npm run preview` chỉ xem build tĩnh, không được cấu hình làm server API.

## 8. Bước tiếp theo

Giai đoạn 2: đăng ký Volunteer/Organizer, đăng nhập/đăng xuất, quản lý phiên, đặt lại mật khẩu và phân quyền.
