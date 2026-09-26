# Giai đoạn 9 — Kiểm tra hoàn chỉnh nghiệp vụ chính

Ngày kiểm tra: 26/09/2026. Nhánh bàn giao: `dev`, kế thừa toàn bộ giai đoạn 1–8 đến commit `f2a85f5`.

## Kết quả

Hoàn thành kiểm tra đợt nghiệp vụ chính trên React, Django và MySQL80. Luồng giao diện chạy xuyên suốt: đăng ký Organizer/Volunteer → cập nhật hồ sơ → tạo và công khai hoạt động → Guest xem → Volunteer đăng ký → Organizer duyệt → điểm danh → hoàn thành → gửi phản hồi → xem thống kê → Admin ẩn phản hồi và số liệu cập nhật tương ứng.

| Kiểm tra | Kết quả |
|---|---|
| Backend trên MySQL thật, database kiểm thử riêng | 99 tests đạt |
| Bảo vệ database và cơ chế thời gian kiểm thử | 8 tests đạt |
| Playwright Chrome: desktop 1280px và màn hình hẹp 390px | 42/42 ca đạt trong một lượt chạy |
| Django system check, kiểm tra migration chưa tạo | Đạt |
| Frontend lint và build | Đạt |
| Database MySQL mới | 28 migration áp dụng đủ, không còn migration chờ |
| Seed dữ liệu chạy hai lần | Không thay đổi dữ liệu sau lần đầu |
| Snapshot database và avatar | Đã tạo, đối chiếu SHA-256 và kiểm tra ZIP đạt |

Đã xem ảnh kết quả hoạt động trên desktop và màn hình hẹp; nội dung và các thẻ thống kê hiển thị đầy đủ. Không phát hiện lỗi chặn luồng chính trong phạm vi các kiểm tra trên.

## Thay đổi trong giai đoạn này

- Sửa `useApi` để dữ liệu của URL/lần tải trước không xuất hiện khi chuyển bộ lọc hoặc thử tải lại. Trong lúc chờ phản hồi mới, giao diện hiển thị trạng thái tải.
- Thêm kiểm thử giao diện xuyên suốt bốn vai trò; kiểm tra mất kết nối, thử lại và kết quả tìm kiếm rỗng.
- Thêm ba kiểm thử đồng thời trên MySQL: đăng ký với hủy hoạt động; điểm danh với hủy hoạt động; duyệt đơn với giảm sức chứa. Kết quả không để lại đơn hoạt động sau khi hủy, giữ đúng lịch sử có mặt và không duyệt vượt sức chứa.
- Runner E2E xác minh migration và tính lặp an toàn của seed trên database mới.
- Thêm `scripts/backup.py` và [hướng dẫn chạy, kiểm tra, sao lưu/khôi phục](VAN_HANH_VA_SAO_LUU.md).

Bộ kiểm thử hồi quy bao gồm tài khoản bị khóa, phiên cũ sau mở khóa, truy cập ngoài quyền, dữ liệu không hợp lệ, đăng ký/điểm danh trùng, giới hạn sức chứa, hủy hoạt động và điều kiện gửi phản hồi. Các quy tắc nghiệp vụ đã chốt được giữ nguyên.

## Cách kiểm chứng

Chạy lần lượt từ thư mục dự án:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

E2E dùng React và API thật, có session/CSRF, trên MySQL kiểm thử riêng. Bài kiểm thử mất kết nối chủ động chặn request trong trình duyệt rồi bỏ chặn để xác minh phục hồi; không dùng dữ liệu API giả để thay cho nghiệp vụ.

Để đi qua giờ bắt đầu/kết thúc mà không phải đợi nhiều giờ, runner mô phỏng thời gian theo từng request trong tiến trình máy chủ kiểm thử. Cơ chế chỉ khởi tạo khi kết nối đúng database test, yêu cầu khóa ngẫu nhiên và cô lập giữa các luồng; không được import vào backend ứng dụng. Không thay đồng hồ Windows/MySQL hay thêm endpoint điều khiển thời gian vào website thật.

Bằng chứng local: `tmp/phase9-check.log`, `tmp/phase9-e2e.log`, ảnh trong `tmp/e2e-1bb7c0182ccb/screenshots/`. Database E2E đã được dọn sau khi chạy. Các log, email kiểm thử và snapshot không đưa lên Git.

## Sao lưu và giới hạn

Đã tạo `tmp/backups/snapshot-20260926-123824/` gồm SQL, ZIP media và manifest SHA-256. Đã kiểm tra tính toàn vẹn; chưa thực hiện khôi phục vào database khác hoặc thay thế database đang dùng. Giai đoạn này không bổ sung migration nghiệp vụ và không thay đổi dữ liệu ứng dụng thật.

Bản bàn giao được xác minh trong môi trường local. Chưa xác minh SMTP thật, hosting/HTTPS hoặc tải lớn. Kết quả kiểm thử không phải cam kết không còn mọi lỗi. Các chức năng phụ và AI thuộc giai đoạn 10, chưa triển khai trong giai đoạn 9.
