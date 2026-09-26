# V-Connect

Website quản lý tình nguyện viên, xây mới bằng **React JavaScript + Vite, Django REST Framework và MySQL**. Giao diện tiếng Việt. Không dùng TypeScript, Supabase hoặc ứng dụng mobile riêng.

## Trạng thái

Đã hoàn thành nghiệp vụ chính và kiểm tra tổng thể giai đoạn 9 trên nhánh `dev`, kế thừa giai đoạn 8 (`feature/reports-admin`, commit `f2a85f5`). Bao gồm xác thực/phân quyền, hồ sơ, avatar, hoạt động, đăng ký/xét duyệt, điểm danh, phản hồi và thống kê/quản trị cơ bản. **Chưa có báo cáo nâng cao hoặc AI.** Xem [kết quả giai đoạn 9](document/GIAI_DOAN_9_KET_QUA.md) và [hướng dẫn vận hành, sao lưu](document/VAN_HANH_VA_SAO_LUU.md).

Volunteer/Organizer dùng email đăng nhập; Admin dùng username, không bắt buộc email. Quyền truy cập được kiểm tra trên API. Không có tài khoản mẫu hoặc mật khẩu Admin mặc định. Kết quả kiểm tra và giới hạn: [giai đoạn 2](document/GIAI_DOAN_2_KET_QUA.md), [cập nhật username Admin](document/CAP_NHAT_ADMIN_USERNAME.md).

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
npm.cmd ci
cd ..
.\.venv\Scripts\python.exe backend/scripts/init_env.py
```

Nếu `py` chưa có trên PATH, dùng đường dẫn đến Python 3.12. Workspace hiện đã có `.venv`, nên không cần tạo lại. `requirements.lock` và `frontend/package-lock.json` cố định phiên bản đã cài; `requirements.txt` mô tả khoảng phiên bản cho lần nâng cấp có chủ đích.

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
.\.venv\Scripts\python.exe backend/manage.py test apps.core apps.accounts apps.activities apps.participations apps.feedback apps.reports --noinput
cd frontend
npm.cmd run lint
npm.cmd run build
cd ..
```

Tests dùng MySQL thật trong database riêng. Hiện có 101 tests gồm nền tảng, xác thực, username Admin, migration, hồ sơ, avatar, hoạt động, đăng ký/xét duyệt, điểm danh, phản hồi, dashboard và thống kê/quản trị, bao gồm thao tác đồng thời giữa các luồng. Có thêm 8 tests bảo vệ database và thời gian kiểm thử. Không dùng SQLite làm kết quả thay thế cho MySQL.

Kiểm tra đường đi qua Vite proxy sau khi hai server chạy:

```powershell
Invoke-RestMethod http://127.0.0.1:5173/api/v1/health/
Invoke-RestMethod http://127.0.0.1:5173/api/v1/skills/
```

### Kiểm thử giao diện bằng Playwright

Cần Google Chrome đã cài trên máy. Chạy từ thư mục dự án, sau bộ kiểm tra backend:

```powershell
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

Runner khởi động backend ở cổng `8001`, Vite ở `5174` và chạy Chrome headless với profile kiểm thử riêng. Hai cổng phải trống. Có thể chọn Edge bằng biến `E2E_BROWSER_CHANNEL=msedge` nếu máy không có Chrome.

Tests đi qua form React và API Django thật, dùng MySQL `DB_TEST_NAME` riêng; runner từ chối chạy nếu database test đã tồn tại. Không chạy đồng thời với bộ tests backend. Tài khoản Admin và các tài khoản đăng ký được tạo trong database test, sau đó database này được xóa khi kết thúc. Database ứng dụng được giữ nguyên.

Email đặt lại mật khẩu được ghi ra file cục bộ, không gửi SMTP. Screenshot và email nằm trong `tmp/e2e-*/`; báo cáo HTML nằm trong `frontend/playwright-report/`. Các thư mục này bị Git bỏ qua. Không chia sẻ file email chứa liên kết reset.

Playwright có 44 ca trên desktop 1280px và màn hình hẹp 390px, đồng thời kiểm tra tràn ngang của các form ở 320, 390, 640, 768 và 1280px. Giới hạn tần suất được tăng riêng trong tiến trình E2E vì nhiều test dùng chung IP loopback; các giới hạn thực tế vẫn được kiểm tra trong backend tests. Nghiệp vụ dùng API thật và không tắt CSRF; bài kiểm tra mất kết nối chủ động chặn request rồi bỏ chặn để thử lại. Luồng xuyên suốt mô phỏng thời gian riêng trong máy chủ kiểm thử để đi qua mốc điểm danh/hoàn thành, không đổi giờ hệ thống hoặc dữ liệu ứng dụng thật.

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

## 8. Tài khoản và xác thực

- Đăng ký: http://127.0.0.1:5173/dang-ky — chọn Tình nguyện viên hoặc Nhà tổ chức.
- Đăng nhập: http://127.0.0.1:5173/dang-nhap
- Quên mật khẩu: http://127.0.0.1:5173/quen-mat-khau
- Khu vực riêng: `/tinh-nguyen-vien`, `/nha-to-chuc`, `/quan-tri`.

Đăng ký thành công tự đăng nhập. Đăng nhập không chọn “Ghi nhớ” dùng cookie phiên trình duyệt; chọn “Ghi nhớ” lưu cookie 14 ngày. Session được lưu phía Django/MySQL, cookie HttpOnly; không lưu token đăng nhập hoặc mật khẩu trong localStorage. Website kiểm tra lại phiên khi lấy focus; API vẫn kiểm tra người dùng và vai trò mỗi request.

Tạo Admin bằng lệnh tương tác, nhập mật khẩu trực tiếp trong terminal:

```powershell
.\.venv\Scripts\python.exe backend/manage.py createsuperuser --username admin
```

Lệnh trên chỉ yêu cầu mật khẩu và xác nhận; bỏ `--username admin` nếu muốn được hỏi username. Không hỏi email hay họ tên; tên hiển thị ban đầu lấy từ username và có thể sửa trong hồ sơ. Username không phân biệt hoa/thường, chỉ gồm chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang. Mật khẩu vẫn được kiểm tra độ mạnh.

Admin dùng username trên cả `/dang-nhap` và Django Admin ở `http://127.0.0.1:8000/admin/`. Volunteer/Organizer vẫn nhập email. Admin không dùng luồng quên mật khẩu qua email; đổi mật khẩu bằng lệnh sau (thay `admin` bằng username thực tế):

```powershell
.\.venv\Scripts\python.exe backend/manage.py changepassword admin
```

Không gửi `role=admin`, `username` hoặc `is_staff` qua form đăng ký công khai. Backend sẽ từ chối. Các trang workspace có thông tin tài khoản và đường dẫn chỉnh sửa hồ sơ, chưa phải dashboard nghiệp vụ.

### API xác thực

Mọi endpoint dưới đây có tiền tố `/api/v1/auth/`.

| Method | Endpoint | Dữ liệu / hành vi |
|---|---|---|
| GET | `csrf/` | Trả `csrfToken` và đặt cookie CSRF |
| POST | `register/` | `email`, `full_name`, `role`, `password`, `password_confirm`; trả 201 và `user` |
| POST | `login/` | `identifier` (email hoặc username Admin), `password`, `remember` (boolean); trả `user` gồm cả `username` |
| POST | `logout/` | Hủy session hiện tại |
| GET | `me/` | Chỉ thông tin người đang đăng nhập, không nhận ID để xem người khác |
| GET | `workspace/<role>/` | Chỉ cho phép đúng vai trò `volunteer`, `organizer`, `admin` |
| POST | `password-reset/` | `email`; trả thông báo chung cho email có/không tồn tại |
| POST | `password-reset/confirm/` | `uid`, `token`, `password`, `password_confirm` |

Client phải giữ cookies, lấy CSRF token trước POST và gửi bằng header `X-CSRFToken`. CSRF được kiểm tra cả khi chưa đăng nhập. Đăng nhập sẽ xoay token; frontend lấy token hiện tại trước mỗi POST. Chưa đăng nhập/hết phiên trả 401; sai quyền hoặc CSRF không hợp lệ trả 403.

API đăng nhập còn nhận `email` hoặc `username` thay cho `identifier` để tương thích; chỉ gửi một trong ba trường. Email của Admin cũ được giữ nếu có nhưng không dùng làm tên đăng nhập hoặc đích khôi phục mật khẩu.

### Email đặt lại mật khẩu

Mặc định dùng console email: nội dung email và liên kết xuất hiện ở **terminal backend**, chưa gửi tới hộp thư thật. Mở liên kết để đặt mật khẩu mới. Liên kết chỉ dùng được một lần, hết hạn sau 1 giờ; đặt lại mật khẩu làm các phiên đăng nhập cũ mất hiệu lực. Không chia sẻ log có liên kết đặt lại mật khẩu.

Khi cần gửi email thật, cấu hình trong `backend/.env`:

```dotenv
FRONTEND_URL=http://127.0.0.1:5173
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-account
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-sender@example.com
```

Đổi `FRONTEND_URL` thành origin website thực tế khi triển khai. Backend không lấy địa chỉ liên kết từ Host hoặc redirect do người gọi gửi lên. TLS được bật cho SMTP. Đã kiểm thử email bằng backend email trong bộ nhớ; chưa xác minh nhà cung cấp SMTP thật.

API xác thực giới hạn 30 request/phút cho mỗi user đã đăng nhập hoặc IP chưa đăng nhập; nhóm đặt lại mật khẩu giới hạn 5 request/phút. Cache mặc định nằm trong từng tiến trình, phù hợp bản local; triển khai nhiều worker cần cache chung và giới hạn tại reverse proxy.

## 9. Các bước tiếp theo

### Hồ sơ cơ bản — giai đoạn 3 theo phạm vi ngày 22/09/2026

Sau khi đăng nhập, chọn **Chỉnh sửa hồ sơ** trong khu vực tài khoản hoặc mở `/ho-so`.

- Mọi tài khoản có thể sửa họ tên, số điện thoại, giới thiệu và avatar của chính mình. Email đăng nhập và vai trò không được sửa qua API hồ sơ.
- Nhà tổ chức có thêm tên tổ chức, mô tả, website HTTP/HTTPS và địa chỉ liên hệ. Các trường bổ sung có thể để trống và hoàn thiện dần.
- Nút **Lưu hồ sơ** lưu thông tin văn bản. Chọn ảnh sẽ tải lên và lưu avatar riêng; có nút xóa ảnh.
- Nhận JPEG/PNG/WebP tối đa 5 MB và 16 triệu điểm ảnh. Backend đọc nội dung ảnh, chuyển thành JPEG tối đa 512 × 512, đặt tên ngẫu nhiên và loại metadata bằng cách mã hóa lại.
- File nằm trong `backend/media/avatars/`, database lưu tên file. Ảnh hiện chỉ được chủ tài khoản xem qua API có xác thực; không mở đường dẫn `/media/` công khai.

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/v1/auth/profile/` | Xem hồ sơ của phiên hiện tại |
| PATCH | `/api/v1/auth/profile/` | Lưu `full_name`, `phone`, `bio`; Organizer có thêm object `organizer` |
| GET | `/api/v1/auth/profile/avatar/` | Đọc ảnh của phiên hiện tại |
| POST | `/api/v1/auth/profile/avatar/` | Tải một file multipart có tên trường `avatar` |
| DELETE | `/api/v1/auth/profile/avatar/` | Xóa avatar hiện tại |

Các thao tác ghi đều kiểm tra CSRF. Khi cập nhật bản cài có sẵn, chạy `backend/manage.py migrate` bằng Python trong `.venv`. Migration hồ sơ `accounts.0002` phụ thuộc migration xác thực `accounts.0003`; Django chạy theo dependency. Không dùng `--fake` hoặc chạy lại migration đã áp dụng. Xem [kết quả giai đoạn 3](document/GIAI_DOAN_3_KET_QUA.md).

### Tiến độ tiếp theo

Giai đoạn 2 đã đẩy lên `feature/auth` ngày 21/09/2026, commit `0efe855`: 39 tests backend, 12 ca Playwright trên Chrome và 5 tests bảo vệ dọn database đạt; lint/build đạt. Giai đoạn 3 hoàn thiện hồ sơ, avatar và hồ sơ Nhà tổ chức trên nhánh `feature/profile`, kế thừa bản xác thực Admin bằng username. Xem [kết quả giai đoạn 2](document/GIAI_DOAN_2_KET_QUA.md) và [giai đoạn 3](document/GIAI_DOAN_3_KET_QUA.md).

Theo kế hoạch điều chỉnh ngày 22/09/2026, nghiệp vụ chính đã hoàn thành kiểm tra tổng thể ở giai đoạn 9. Tiếp theo là chọn nhóm chức năng giai đoạn 10: kỹ năng, sở thích, lịch rảnh, QR, bản đồ, timeline, thông báo, báo cáo nâng cao và ba chức năng AI. Các nhóm này chưa triển khai. Xem [kế hoạch](document/KE_HOACH_TRIEN_KHAI.md).

Tài liệu kỹ thuật tham khảo: [Django MySQL](https://docs.djangoproject.com/en/5.2/ref/databases/#mysql-notes), [custom User](https://docs.djangoproject.com/en/5.2/topics/auth/customizing/#using-a-custom-user-model-when-starting-a-project), [Vite proxy](https://vite.dev/config/server-options.html#server-proxy).

## 10. Hoạt động

Chạy migration khi cập nhật: `python backend/manage.py migrate --noinput`. Mở `/hoat-dong` để tìm và xem hoạt động công khai; Organizer mở `/nha-to-chuc/hoat-dong` để tạo và quản lý. Quy tắc, API và kết quả kiểm thử: [giai đoạn 4](document/GIAI_DOAN_4_KET_QUA.md).

## 11. Đăng ký và xét duyệt

Volunteer đăng ký/hủy tại chi tiết hoạt động, xem kết quả tại `/tinh-nguyen-vien/dang-ky`. Organizer chọn **Xem danh sách đăng ký** trong hoạt động của mình để duyệt hoặc từ chối. Mọi thao tác phải trước giờ bắt đầu. Tự hủy được đăng ký lại về chờ duyệt; bị từ chối không được gửi lại. Sức chứa tính theo số người được duyệt.

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/v1/participations/` | Danh sách đơn của Volunteer hiện tại |
| GET/POST | `/api/v1/activities/<id>/participation/` | Xem đơn của mình / đăng ký với body `{}` |
| POST | `/api/v1/activities/<id>/participation/cancel/` | Tự hủy với body `{}` |
| GET | `/api/v1/organizer/activities/<id>/applicants/` | Chủ hoạt động xem danh sách ứng viên |
| POST | `/api/v1/organizer/activities/<id>/applicants/<entry_id>/review/` | Body `{"status":"approved"}` hoặc `{"status":"rejected"}` |

Các thao tác ghi kiểm tra CSRF, vai trò, chủ sở hữu, thời hạn và trạng thái. Migration `participations.0001_initial` thêm bảng đơn đăng ký. Chi tiết quy tắc và kiểm thử: [giai đoạn 5](document/GIAI_DOAN_5_KET_QUA.md).

## 12. Điểm danh thủ công

Organizer mở chi tiết hoạt động → **Điểm danh người tham gia**, chọn người được duyệt và xác nhận có mặt. Chỉ thực hiện từ giờ bắt đầu đến giờ kết thúc, khi hoạt động còn Công khai. Mỗi đơn có một bản ghi; bấm lại không ghi trùng hoặc thay đổi người/thời điểm xác nhận. Volunteer xem kết quả tại đơn đăng ký và **Lịch sử tham gia** trong tài khoản.

Chạy migration khi cập nhật bằng Python trong `.venv`: `python backend/manage.py migrate --noinput`. Migration `participations.0002_attendance` thêm bảng điểm danh. API, quy tắc giữ lịch sử khi hủy hoạt động và kết quả kiểm thử: [giai đoạn 6](document/GIAI_DOAN_6_KET_QUA.md).

## 13. Đánh giá và phản hồi

Volunteer đã có mặt mở **Lịch sử tham gia** → hoạt động Hoàn thành → **Gửi hoặc xem phản hồi của tôi**. Điểm 1–5 và nội dung tối đa 2.000 ký tự, chỉ gửi một lần, chưa sửa/xóa. Organizer chọn **Xem phản hồi hoạt động** để xem danh sách và điểm trung bình. Admin mở **Quản lý phản hồi** trong tài khoản để ẩn nội dung không phù hợp, bắt buộc nhập lý do.

Phản hồi bị ẩn vẫn được lưu để đối chiếu nhưng không hiển thị cho Organizer và không tính vào điểm trung bình. Người gửi xem được lý do xử lý. Migration bổ sung `feedback.0001_initial`; chạy `python backend/manage.py migrate --noinput` bằng Python trong `.venv` khi cập nhật. API và kiểm thử: [giai đoạn 7](document/GIAI_DOAN_7_KET_QUA.md).

## 14. Thống kê và quản trị

Chọn **Xem thống kê** trong tài khoản để xem số liệu theo vai trò và mở danh sách đối chiếu. Organizer mở **Xem kết quả hoạt động** để xem số liệu riêng. “Đã tham gia” chỉ tính hoạt động Hoàn thành có điểm danh; lượt có mặt ở hoạt động chưa hoàn thành/bị hủy hiển thị riêng.

Admin có **Quản lý tài khoản** và **Nhật ký thao tác**. Khóa/mở khóa bắt buộc lý do, không áp dụng cho Admin và làm phiên cũ hết hiệu lực. Django Admin cung cấp màn hình chỉ đọc cho dữ liệu nghiệp vụ; trạng thái tài khoản được quản lý qua website để ghi lý do.

Chạy migration bằng Python trong `.venv`: `python backend/manage.py migrate --noinput`. Bổ sung `accounts.0004_user_session_version` và `reports.0001_initial`. Quy tắc, API, giới hạn nhật ký và kiểm thử: [giai đoạn 8](document/GIAI_DOAN_8_KET_QUA.md).

## 15. Không gian tình nguyện viên

Trang `/tinh-nguyen-vien` dùng bố cục tham khảo Volunteer Dashboard trong báo cáo: thẻ chào mừng và hồ sơ, thao tác nhanh, ba ô thống kê, hoạt động sắp tới và lịch sử gần đây. Giữ màu sắc V-Connect, dùng dữ liệu thật và ẩn chức năng chưa triển khai. API riêng kiểm tra vai trò và chỉ trả dữ liệu của tài khoản trong phiên; không cần migration mới. Xem [chi tiết cập nhật dashboard](document/CAP_NHAT_VOLUNTEER_DASHBOARD.md).
