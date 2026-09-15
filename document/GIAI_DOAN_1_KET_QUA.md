# Kết quả triển khai giai đoạn 1

Ngày: 14/09/2026.

Bản GitHub được tách từ workspace ngày 15/09/2026 theo phạm vi giai đoạn 1; không phải khôi phục từ commit lịch sử. Đã loại phần xác thực website của giai đoạn 2 và chạy lại 9 tests nền tảng, Django check, kiểm tra migrations, frontend lint/build trước khi đẩy lên GitHub.

## Đã thực hiện

- Django 5.2 + Django REST Framework; dùng một file `backend/config/settings.py`, các giá trị tùy chỉnh đọc từ `.env` theo yêu cầu mới.
- MySQL80 hiện có, phiên bản 8.0.40; tạo database `v_connect` và user ứng dụng riêng. Không sử dụng root làm tài khoản runtime.
- Tạo schema bằng Django migrations, bao gồm custom User với email, UUID và ba vai trò; không tạo tài khoản hoặc API xác thực công khai ở giai đoạn này.
- Chuẩn bị package cho accounts, activities, participations, feedback, notifications, reports, recommendations và core. Các package nghiệp vụ ngoài accounts/core chưa có implementation.
- Tạo bảng kỹ năng, seed 8 kỹ năng tiếng Việt; lệnh seed có thể chạy lại mà không ghi đè dữ liệu đã chỉnh sửa.
- API `/api/v1/health/`: kiểm tra MySQL và trạng thái migrations; trả 503 khi chưa sẵn sàng.
- API `/api/v1/skills/`: danh mục read-only, phân trang mặc định 20, tối đa 100 bản ghi/trang.
- Cấu trúc lỗi API, request ID và logging cơ bản; mặc định API yêu cầu xác thực, riêng health/catalog được công khai.
- Frontend React JavaScript/Vite có trang chủ, giới thiệu, trạng thái, route 404, layout và CSS responsive; có loading/error/retry khi gọi API.
- Frontend dùng proxy `/api` trong development. Không có TypeScript source/direct dependency hoặc Supabase trong ứng dụng.
- File `.env.example`, script tạo `.env` bằng secrets ngẫu nhiên, script chuẩn bị MySQL, lệnh kiểm tra và README cho Windows.
- Lưu phiên bản Python dependencies và npm dependencies trong lockfile.

## Kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Cài đặt Python dependencies | `pip check`: không có dependency bị lỗi |
| Tạo schema MySQL | Tất cả migration ban đầu áp dụng thành công |
| Django system check | Không có vấn đề |
| Cấu hình Django | Đã gộp thành một file, Django check và 9 tests vẫn đạt; chưa triển khai production |
| Model/migration consistency | `makemigrations --check --dry-run`: không có thay đổi |
| Backend tests | 9/9 đạt trên MySQL; database test riêng được Django tạo/xóa |
| Frontend lint | Đạt |
| Frontend production build | Đạt |
| Health qua Vite proxy | HTTP 200, database connected, migrations applied |
| Catalog qua Vite proxy | 8 kỹ năng; phân trang trả liên kết qua đúng origin frontend |
| Mã hóa dữ liệu | Đã kiểm tra UTF-8 tiếng Việt qua HTTP và emoji trong MySQL test |
| SPA fallback qua HTTP | `/`, `/gioi-thieu`, `/trang-thai`, route bất kỳ trả entry point của ứng dụng |

9 tests bao gồm: health bình thường, health khi MySQL lỗi, migration chờ, phân trang/UTF-8, cấm ghi catalog, JSON 404, seed chạy lại, password hashing/email normalization và vai trò superuser.

Lệnh tái kiểm tra:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
```

Lưu ý: script PowerShell `.ps1` bị execution policy hiện tại chặn. Đã cung cấp runner Python để không cần thay đổi chính sách máy.

## Mở bản local

- Website: http://127.0.0.1:5173/
- Trạng thái: http://127.0.0.1:5173/trang-thai
- API: http://127.0.0.1:8000/api/v1/health/

Hai dev server đã được khởi chạy ở lượt bàn giao. Nếu tiến trình dừng sau khi kết thúc phiên, chạy lại theo README.

## Giới hạn và việc tiếp theo

- Công cụ trình duyệt báo không có browser khả dụng, nên chưa chạy kiểm thử tương tác hoặc kiểm tra trực quan desktop/mobile. Kiểm tra HTTP và build không thay thế việc này.
- Chưa có đăng ký/đăng nhập website, CRUD hoạt động, điểm danh, thông báo, báo cáo hoặc AI. Trang chủ ghi rõ đây là bản nền tảng, không hiển thị số liệu tác động giả.
- Chưa deploy production hoặc cấu hình SMTP, tên miền, reverse proxy và storage production.
- Khóa và mật khẩu nằm trong `backend/.env`, bị loại khỏi Git; không được ghi vào tài liệu này.
- Giai đoạn 1 đã đáp ứng tiêu chí nền tảng. Mốc M1 trong kế hoạch vẫn cần hoàn thành xác thực/phân quyền ở giai đoạn 2.
