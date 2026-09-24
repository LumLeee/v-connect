# Giai đoạn 4: Quản lý và xem hoạt động

Ngày hoàn thiện: 24/09/2026. Code ở local trên `feature/activities`, chưa commit/push.

## Chức năng

- Organizer tạo/sửa hoạt động: tên, mô tả, địa chỉ, thời gian bắt đầu/kết thúc và sức chứa từ 1 đến 100.000 người.
- Danh sách và chi tiết riêng cho Organizer; tìm theo tên, phân trang, chỉ quản lý hoạt động của mình.
- Guest/Volunteer xem hoạt động công khai, tìm kiếm và phân trang. Không trả email hoặc thông tin liên hệ riêng của chủ hoạt động.
- Giao diện tiếng Việt có trạng thái tải, lỗi, rỗng, lỗi theo trường và xác nhận chuyển trạng thái.
- Nhập/hiển thị thời gian theo giờ Việt Nam (UTC+7); backend lưu datetime có múi giờ.

## Quy tắc đã chốt

| Hiện tại | Chuyển sang | Điều kiện |
|---|---|---|
| Nháp | Công khai | Thời gian bắt đầu ở tương lai |
| Nháp | Đã hủy | Chủ hoạt động xác nhận |
| Công khai | Hoàn thành | Đã qua thời gian kết thúc |
| Công khai | Đã hủy | Chủ hoạt động xác nhận |
| Hoàn thành/Đã hủy | Không chuyển tiếp | Không chỉnh sửa nội dung |

Thời gian bắt đầu khi tạo/sửa phải ở tương lai; kết thúc phải sau bắt đầu. Có thể sửa nội dung hoạt động công khai. Trạng thái chỉ thay đổi qua endpoint riêng. Không xóa vật lý hoặc chuyển công khai về nháp.

Hoạt động từng công khai vẫn xuất hiện với nhãn hoàn thành/hủy. Nháp bị hủy trước khi công khai vẫn riêng tư. API quản lý kiểm tra vai trò Organizer và chủ sở hữu; cập nhật/chuyển trạng thái khóa hàng trong transaction. Database có ràng buộc thời gian, sức chứa và trạng thái. Admin quản trị nghiệp vụ thực hiện ở giai đoạn 8.

## Sử dụng và API

- Công khai: `/hoat-dong`, `/hoat-dong/:id`.
- Organizer: `/nha-to-chuc/hoat-dong`, `/nha-to-chuc/hoat-dong/tao`, `/nha-to-chuc/hoat-dong/:id`, `/nha-to-chuc/hoat-dong/:id/sua`.
- Chọn **Hoạt động** trên thanh điều hướng hoặc **Quản lý hoạt động** trong tài khoản Organizer.

Tiền tố API `/api/v1/`. Endpoint quản lý yêu cầu session Organizer; thao tác ghi yêu cầu CSRF.

| Phương thức | Endpoint | Chức năng |
|---|---|---|
| GET | `activities/` | Danh sách công khai |
| GET | `activities/<uuid>/` | Chi tiết công khai, trả 404 cho nháp |
| GET/POST | `organizer/activities/` | Danh sách riêng/tạo nháp |
| GET/PATCH | `organizer/activities/<uuid>/` | Xem/sửa hoạt động của mình |
| POST | `organizer/activities/<uuid>/status/` | Chuyển bằng trường `status` |

Danh sách nhận `search`, `page`, `page_size` tối đa 100; giao diện dùng 12 mục/trang. Payload tạo/sửa: `title`, `description`, `address`, `starts_at`, `ends_at`, `capacity`.

## Migration và kiểm chứng

- `activities.0001_initial` đã áp dụng vào MySQL local ngày 22/09 sau khi sao lưu. Đối chiếu tài khoản và hồ sơ trước/sau không thay đổi.
- Backup local: `tmp/backups/before-activities-20260922-202645.sql`.
- 57/57 tests backend trên MySQL đạt, gồm 9 tests hoạt động: quyền, CSRF, nháp riêng tư, dữ liệu sai, cập nhật một phần, phân trang và trạng thái.
- 5/5 tests bảo vệ database, Django check và kiểm tra migration đạt.
- 22/22 ca Playwright đạt ngày 22/09: 4 ca hoạt động, 12 ca xác thực, 6 ca hồ sơ trên desktop/màn hình hẹp. Luồng hoạt động kiểm tra tạo/sửa/công khai/tìm xem/hủy, giờ Việt Nam và truy cập trái quyền. Hoàn thành sau giờ kết thúc được kiểm tra ở backend bằng thời gian kiểm soát.
- Đã xem ảnh desktop/màn hình hẹp và kiểm tra tràn ngang ở 320, 390, 768, 1280px.
- Lint/build chạy lại ngày 24/09 sau chỉnh sửa nhỏ về nội dung/bố cục đều đạt.
- Log local: `tmp/phase4-check.log`, `tmp/phase4-e2e.log`; ảnh: `tmp/e2e-396ebc989f61/screenshots/`. Runner đã dọn database test; không tạo hoạt động mẫu trong database ứng dụng.

## Tiếp theo

Giai đoạn 5: đăng ký/hủy đăng ký, xét duyệt và trạng thái tham gia. Hiện chưa mở đăng ký trực tuyến; chưa có điểm danh, timeline, bản đồ, ảnh hoạt động hoặc AI. Các chức năng phụ giữ ở đợt 2 theo kế hoạch.
