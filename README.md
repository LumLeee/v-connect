# V-Connect

Website quản lý tình nguyện viên, xây mới bằng **React JavaScript + Vite, Django REST Framework và MySQL**. Giao diện tiếng Việt. Không dùng TypeScript, Supabase hoặc ứng dụng mobile riêng.

## Trạng thái

Đã có xác thực/phân quyền, hồ sơ và avatar, hoạt động/timeline/ảnh bìa, đăng ký/xét duyệt, lời mời, điểm danh thủ công/QR, phản hồi, điểm đóng góp, xếp hạng và báo cáo/quản trị. Thông báo có nhắc trước 1 giờ và hàng đợi email; SMTP thật chưa cấu hình. [AI ghép nối](document/AI_GHEP_NOI.md) kết hợp quy tắc với embedding local và có dự phòng. [AI phản hồi/bản nháp báo cáo](document/AI_PHAN_HOI_VA_BAO_CAO.md) là công cụ hỗ trợ thử nghiệm, không phải mô hình cảm xúc chuyên dụng hoặc mô hình sinh văn bản. Xem [trạng thái và giới hạn](document/TRANG_THAI_VA_KIEM_THU.md).

Volunteer/Organizer dùng email đăng nhập; Admin dùng username, không bắt buộc email. Quyền truy cập được kiểm tra trên API. Không có tài khoản mẫu hoặc mật khẩu Admin mặc định. Chi tiết: [Tài khoản và hồ sơ](document/TAI_KHOAN_VA_HO_SO.md).

Giới thiệu dành cho người không biết lập trình: [Mô tả dự án dễ hiểu](document/MO_TA_DU_AN_DE_HIEU.md). Mục lục chuyên đề: [document/README.md](document/README.md). Hướng dẫn [vận hành và sao lưu](document/VAN_HANH_VA_SAO_LUU.md).

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

Để bật mô hình ghép nối, chuẩn bị tệp local bằng lệnh sau sau khi cài dependency. Lệnh cần Internet để tải model cố định, không cần API key hoặc kết nối MySQL; inference sau đó chạy offline trên CPU. Nếu chưa chuẩn bị model, ghép nối vẫn dùng quy tắc dự phòng. Chi tiết cấu hình, điểm và giới hạn: [AI ghép nối](document/AI_GHEP_NOI.md).

```powershell
.\.venv\Scripts\python.exe backend/manage.py prepare_matching_model
```

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

Script tạo database `v_connect` với `utf8mb4_unicode_ci` và tài khoản `v_connect@localhost`, cấp quyền giới hạn cho database ứng dụng cùng `test_v_connect`. `DB_TEST_NAME` phải bắt đầu bằng `test_`, chỉ có chữ ASCII/số/gạch dưới và khác `DB_NAME` kể cả hoa/thường. Backend test và E2E chỉ tạo database mới, từ chối schema đã tồn tại; chỉ dọn database có dấu sở hữu của chính lượt chạy. Quyền DDL dành cho development; production nên dùng tài khoản migration riêng.

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
.\.venv\Scripts\python.exe backend/manage.py test apps.core apps.accounts apps.activities apps.participations apps.feedback apps.reports apps.notifications apps.recommendations --noinput
cd frontend
npm.cmd run lint
npm.cmd run build
cd ..
```

Tests dùng MySQL thật trong database riêng, bao phủ nền tảng, xác thực, migration, hồ sơ, hoạt động, đăng ký/xét duyệt, điểm danh, phản hồi, đóng góp, báo cáo/quản trị, thông báo và AI. Có kiểm thử bảo vệ database và thời gian kiểm thử. Không dùng SQLite thay cho MySQL. Xem [phạm vi và cách kiểm tra](document/TRANG_THAI_VA_KIEM_THU.md).

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

Tests đi qua form React và API Django thật, dùng MySQL `DB_TEST_NAME` riêng; cả Django runner và E2E đều từ chối database đã tồn tại. Không dùng `--keepdb` hoặc `--parallel > 1`, không chạy đồng thời hai bộ kiểm thử. Tài khoản thử chỉ được tạo trong database mới và database đó được dọn khi kết thúc. Nếu lượt chạy cũ bị ngắt, kiểm tra nguồn gốc schema còn lại trước khi dọn; không đổi tên trỏ sang database có dữ liệu để chạy tiếp.

Email đặt lại mật khẩu được ghi ra file cục bộ, không gửi SMTP. Screenshot và email nằm trong `tmp/e2e-*/`; báo cáo HTML nằm trong `frontend/playwright-report/`. Các thư mục này bị Git bỏ qua. Không chia sẻ file email chứa liên kết reset.

Playwright có 62 ca trên desktop 1280px và màn hình hẹp 390px, đồng thời kiểm tra tràn ngang của các form ở 320, 390, 640, 768 và 1280px. Giới hạn tần suất được tăng riêng trong tiến trình E2E vì nhiều test dùng chung IP loopback; các giới hạn thực tế vẫn được kiểm tra trong backend tests. Nghiệp vụ dùng API thật và không tắt CSRF; bài kiểm tra mất kết nối chủ động chặn request rồi bỏ chặn để thử lại. Luồng xuyên suốt mô phỏng thời gian riêng trong máy chủ kiểm thử để đi qua mốc điểm danh/hoàn thành, không đổi giờ hệ thống hoặc dữ liệu ứng dụng thật.

## 7. Cấu hình môi trường

| Biến | Ý nghĩa |
|---|---|
| `DJANGO_DEBUG` | `True` để bật debug local; mặc định `False` khi không khai báo |
| `DJANGO_HTTPS` | `True` để bật HTTPS redirect, secure cookies và HSTS; local dùng `False` |
| `DJANGO_SECRET_KEY` | Khóa bí mật riêng từng môi trường |
| `DJANGO_ALLOWED_HOSTS` | Danh sách host, phân cách bằng dấu phẩy |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Các origin được phép gửi request CSRF |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Kết nối MySQL |
| `DB_TEST_NAME` | Schema kiểm thử chưa tồn tại, dạng `test_…`, tối đa 64 ký tự; mặc định `test_v_connect` |
| `MATCHING_AI_ENABLED`, `MATCHING_AI_MODEL_DIR` | Bật AI ghép nối và thư mục model local; các giới hạn timeout/cache/đầu vào trong [hướng dẫn](document/AI_GHEP_NOI.md) |
| `FEEDBACK_AI_ENABLED`, `FEEDBACK_AI_MAX_ITEMS` | Bật nhãn phản hồi bằng embedding, tối đa 40 phản hồi/lần mặc định; cờ quy tắc có nguồn riêng, vẫn cần đọc thủ công |
| `REPORT_AI_ENABLED`, `REPORT_AI_MAX_FEEDBACK` | Bật chọn trích dẫn cho bản nháp, mặc định xét 40 phản hồi hợp lệ mới nhất; số liệu dùng mẫu cố định |
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

Không gửi `role=admin`, `username` hoặc `is_staff` qua form đăng ký công khai. Backend sẽ từ chối. Mỗi vai trò có dashboard và các trang nghiệp vụ riêng; xem [Giao diện](document/GIAO_DIEN.md).

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

Sau khi đăng nhập, nhấn ô tài khoản hoặc ảnh đại diện để mở `/ho-so`.

- Mọi tài khoản có thể sửa họ tên, số điện thoại, giới thiệu và avatar của chính mình. Email đăng nhập và vai trò không được sửa qua API hồ sơ.
- Nhà tổ chức có thêm tên tổ chức, mô tả, website HTTP/HTTPS và địa chỉ liên hệ. Các trường bổ sung có thể để trống và hoàn thiện dần.
- Nút **Lưu hồ sơ** lưu thông tin văn bản. Chọn ảnh sẽ tải lên và lưu avatar riêng; có nút xóa ảnh.
- Nhận JPEG/PNG/WebP tối đa 5 MB và 16 triệu điểm ảnh. Backend đọc nội dung ảnh, chuyển thành JPEG tối đa 512 × 512, đặt tên ngẫu nhiên và loại metadata bằng cách mã hóa lại.
- File nằm trong `backend/media/avatars/`, database lưu tên file. Ảnh được đọc qua API có kiểm tra quyền: chủ tài khoản, Nhà tổ chức xem ứng viên trong hoạt động của mình hoặc ảnh được phép hiện trên bảng xếp hạng. Không mở toàn bộ `/media/` công khai.

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/v1/auth/profile/` | Xem hồ sơ của phiên hiện tại |
| PATCH | `/api/v1/auth/profile/` | Lưu `full_name`, `phone`, `bio`; Organizer có thêm object `organizer` |
| GET | `/api/v1/auth/profile/avatar/` | Đọc ảnh của phiên hiện tại |
| POST | `/api/v1/auth/profile/avatar/` | Tải một file multipart có tên trường `avatar` |
| DELETE | `/api/v1/auth/profile/avatar/` | Xóa avatar hiện tại |

Các thao tác ghi đều kiểm tra CSRF. Khi cập nhật bản cài có sẵn, chạy `backend/manage.py migrate` bằng Python trong `.venv`. Migration hồ sơ `accounts.0002` phụ thuộc migration xác thực `accounts.0003`; Django chạy theo dependency. Không dùng `--fake` hoặc chạy lại migration đã áp dụng. Xem [Tài khoản, phiên đăng nhập và hồ sơ](document/TAI_KHOAN_VA_HO_SO.md).

### Phạm vi hiện tại

Các chức năng đã có, phần chưa triển khai và cách kiểm tra được gom trong [Trạng thái và kiểm thử](document/TRANG_THAI_VA_KIEM_THU.md). Tài liệu chuyên đề thay cho báo cáo lặp theo từng giai đoạn; tra cứu tại [mục lục](document/README.md).

Tài liệu kỹ thuật tham khảo: [Django MySQL](https://docs.djangoproject.com/en/5.2/ref/databases/#mysql-notes), [custom User](https://docs.djangoproject.com/en/5.2/topics/auth/customizing/#using-a-custom-user-model-when-starting-a-project), [Vite proxy](https://vite.dev/config/server-options.html#server-proxy).

## 10. Hoạt động

Chạy migration khi cập nhật: `python backend/manage.py migrate --noinput`. Mở `/hoat-dong` để tìm và xem hoạt động công khai; Organizer mở `/nha-to-chuc/hoat-dong` để tạo và quản lý. Quy tắc, API và kết quả kiểm thử: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).

Danh sách dùng lưới thẻ với khối tìm kiếm riêng; chi tiết công khai chia nội dung và thông tin tham gia thành hai cột trên desktop, một cột trên màn hình nhỏ. Chi tiết: [Giao diện V-Connect](document/GIAO_DIEN.md).

Hoạt động có thể chọn tối đa 20 kỹ năng yêu cầu và một ảnh bìa. Bộ lọc kết hợp tên, trạng thái, khoảng ngày bắt đầu theo giờ Việt Nam, địa điểm và kỹ năng; điều kiện được giữ khi phân trang/tải lại. Kỹ năng không tự chặn người đăng ký. Chủ hoạt động tải/thay/xóa ảnh tại trang quản lý chi tiết khi còn Nháp/Công khai. Ảnh bản nháp chỉ chủ hoạt động xem được. Quy tắc, API và migration: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).

## 11. Đăng ký và xét duyệt

Volunteer đăng ký/hủy tại chi tiết hoạt động, xem kết quả tại `/tinh-nguyen-vien/dang-ky`. Organizer mở danh sách đăng ký của hoạt động mình để duyệt hoặc từ chối. Khi bật kiểm tra thời gian, các thao tác này phải trước giờ bắt đầu. Tự hủy được đăng ký lại về chờ duyệt; bị từ chối không được gửi lại. Sức chứa tính theo số người được duyệt. Quy tắc chế độ thử nằm trong tài liệu bên dưới.

| Method | API | Chức năng |
|---|---|---|
| GET | `/api/v1/participations/` | Danh sách đơn của Volunteer hiện tại |
| GET/POST | `/api/v1/activities/<id>/participation/` | Xem đơn của mình / đăng ký với body `{}` |
| POST | `/api/v1/activities/<id>/participation/cancel/` | Tự hủy với body `{}` |
| GET | `/api/v1/organizer/activities/<id>/applicants/` | Chủ hoạt động xem danh sách ứng viên |
| POST | `/api/v1/organizer/activities/<id>/applicants/<entry_id>/review/` | Body `{"status":"approved"}` hoặc `{"status":"rejected"}` |

Các thao tác ghi kiểm tra CSRF, vai trò, chủ sở hữu, thời hạn và trạng thái. Migration `participations.0001_initial` thêm bảng đơn đăng ký. Chi tiết quy tắc và kiểm thử: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).

## 12. Điểm danh thủ công

Organizer mở trang điểm danh của hoạt động để xác nhận người được duyệt có mặt. Hoạt động phải Công khai; khi bật kiểm tra thời gian, chỉ thực hiện từ giờ bắt đầu đến giờ kết thúc. Mỗi đơn có một bản ghi; bấm lại không ghi trùng hoặc đổi người/thời điểm xác nhận. Volunteer xem kết quả tại **Điểm danh của tôi** và **Lịch sử hoạt động**.

Chạy migration khi cập nhật bằng Python trong `.venv`: `python backend/manage.py migrate --noinput`. Migration `participations.0002_attendance` thêm bảng điểm danh. API, quy tắc giữ lịch sử khi hủy hoạt động và kết quả kiểm thử: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).

## 13. Đánh giá và phản hồi

Volunteer đã có mặt mở **Lịch sử tham gia** → hoạt động Hoàn thành → **Gửi hoặc xem phản hồi của tôi**. Điểm 1–5 và nội dung tối đa 2.000 ký tự, chỉ gửi một lần, chưa sửa/xóa. Organizer chọn **Xem phản hồi hoạt động** để xem danh sách và điểm trung bình. Admin mở **Quản lý phản hồi** trong tài khoản để ẩn nội dung không phù hợp, bắt buộc nhập lý do.

Phản hồi bị ẩn vẫn được lưu để đối chiếu nhưng không hiển thị cho Organizer và không tính vào điểm trung bình. Người gửi xem được lý do xử lý. Migration bổ sung `feedback.0001_initial`; chạy `python backend/manage.py migrate --noinput` bằng Python trong `.venv` khi cập nhật. API và kiểm thử: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).

Nút **Phân tích AI** trong danh sách phản hồi của Organizer/Admin gợi ý sắc thái, chủ đề và nội dung cần xem lại theo bộ lọc. Đây là công cụ thử nghiệm; không có cờ không có nghĩa là không có sự cố hoặc quảng cáo. Kết quả đo, giới hạn và nguồn quy tắc/AI: [AI phản hồi và báo cáo](document/AI_PHAN_HOI_VA_BAO_CAO.md). Không tự ẩn phản hồi hoặc thay đổi điểm.

## 14. Thống kê và quản trị

Chọn **Xem thống kê** trong tài khoản để xem số liệu theo vai trò và mở danh sách đối chiếu. Organizer mở **Xem kết quả hoạt động** để xem số liệu riêng. “Đã tham gia” chỉ tính hoạt động Hoàn thành có điểm danh; lượt có mặt ở hoạt động chưa hoàn thành/bị hủy hiển thị riêng.

Admin có **Quản lý tài khoản** và **Nhật ký thao tác**. Khóa/mở khóa bắt buộc lý do, không áp dụng cho Admin và làm phiên cũ hết hiệu lực. Django Admin cung cấp màn hình chỉ đọc cho dữ liệu nghiệp vụ; trạng thái tài khoản được quản lý qua website để ghi lý do.

Admin có Tổng quan, Tài khoản, Hoạt động, Kiểm duyệt phản hồi, Báo cáo, Xếp hạng và Nhật ký. Bộ lọc giữ trong URL, số liệu mở đúng danh sách, Excel/in theo phạm vi đang xem; thao tác xử lý yêu cầu lý do và chặn gửi trùng. Bản nháp AI tách khỏi số liệu gốc. Xem [Giao diện V-Connect](document/GIAO_DIEN.md).

Chạy migration bằng Python trong `.venv`: `python backend/manage.py migrate --noinput`. Bổ sung `accounts.0004_user_session_version` và `reports.0001_initial`. Quy tắc, API, giới hạn nhật ký và kiểm thử: [Báo cáo, tổng kết và nhật ký quản trị](document/BAO_CAO_VA_NHAT_KY.md).

## 15. Không gian tình nguyện viên

Trang `/tinh-nguyen-vien` ưu tiên lời mời, đơn chờ duyệt, hoạt động đang mở điểm danh, hoạt động sắp tới và lịch sử gần đây. Các ô số liệu dẫn tới chức năng tương ứng; API chỉ trả dữ liệu của tài khoản trong phiên. Ba trang đăng ký, điểm danh và lịch sử phục vụ các việc khác nhau. Xem [Giao diện V-Connect](document/GIAO_DIEN.md).

## 16. Hồ sơ tình nguyện viên mở rộng

Trong `/ho-so`, Volunteer chọn kỹ năng, nhập sở thích (mỗi dòng một mục) và thêm lịch rảnh lặp hằng tuần theo giờ Việt Nam. Các mục đều tùy chọn và được lưu bằng nút **Lưu hồ sơ**. API kiểm tra giới hạn, dữ liệu trùng và lịch chồng lấn, chỉ cho chủ tài khoản cập nhật. Kỹ năng và sở thích được dùng cho [ghép nối AI](document/AI_GHEP_NOI.md); lịch rảnh được đối chiếu bằng code. Chỉ hồ sơ chủ động bật cho phép mới xuất hiện trong gợi ý ứng viên cho Nhà tổ chức. Gợi ý không tự đăng ký hoặc tự duyệt.

Khi cập nhật bản cài, sao lưu rồi chạy `python backend/manage.py migrate --noinput` bằng Python trong `.venv`; migration `accounts.0005_volunteerprofile_availabilityslot` bổ sung bảng mới. Xem [Tài khoản, phiên đăng nhập và hồ sơ](document/TAI_KHOAN_VA_HO_SO.md).

## 17. Báo cáo mở rộng

Organizer/Admin mở **Xem thống kê → Báo cáo mở rộng** để xem biểu đồ, lọc theo tên, trạng thái và khoảng ngày bắt đầu hoạt động. Admin lọc thêm Nhà tổ chức. **Xuất Excel** tải toàn bộ kết quả bộ lọc; **In / Lưu PDF** dùng hộp thoại in của trình duyệt và hiển thị đủ dữ liệu qua các trang. Organizer chỉ truy cập hoạt động của mình. Giới hạn 2.000 hoạt động mỗi báo cáo, không tự cắt bớt kết quả.

Không cần migration mới. Cập nhật thư viện bằng `python -m pip install -r backend/requirements.lock` trong môi trường `.venv`. Quy tắc số liệu, API, cấu trúc file và kiểm thử: [Báo cáo, tổng kết và nhật ký quản trị](document/BAO_CAO_VA_NHAT_KY.md).

## 18. Thông báo và email

Mở chuông ở thanh đầu trang hoặc `/thong-bao` để xem thông báo, lọc đã đọc/chưa đọc, mở nội dung liên quan và bật/tắt email. Nhắc lịch trước **1 giờ** dành cho người đã được duyệt trước mốc nhắc; tất cả thông báo nghiệp vụ đều có email nếu tài khoản bật nhận thư.

Sau khi sao lưu và chạy migration, duy trì thêm tiến trình `.venv/Scripts/python.exe backend/manage.py process_notifications --loop` hoặc `powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Target notifications`. Backend API không tự chạy bộ nhắc lịch. Email hiện mặc định ghi ra console; cần cấu hình SMTP trong `.env` để gửi thật. Xem [quy tắc, vận hành, SMTP và kiểm thử](document/THONG_BAO.md).

## 19. Điểm danh nâng cao

Nhà tổ chức mở trang điểm danh → **Tạo mã mới** để hiển thị QR và mã 8 chữ số. Khi bật kiểm tra thời gian, mã có hạn tối đa 5 phút. Volunteer đã được duyệt quét camera/chọn ảnh QR/nhập mã rồi xác nhận. Có thể thay hoặc thu hồi mã; điểm danh thủ công dùng chung bản ghi, không tăng số lượt khi thao tác lặp.

Hoạt động phải Công khai; cửa sổ check-in và hạn mã tuân theo cấu hình kiểm tra thời gian. Chưa có check-out hoặc tính giờ đóng góp. Sau khi cập nhật code, chạy `npm ci` trong `frontend` và migration Django bằng Python của `.venv`. Quy tắc, API và chế độ thử: [Hoạt động và tham gia](document/HOAT_DONG_VA_THAM_GIA.md).
