# Hoạt động mở rộng: kỹ năng, bộ lọc và ảnh bìa

Phạm vi ngày 28/09/2026: bổ sung kỹ năng yêu cầu, bộ lọc và ảnh bìa. Ngày 09/10/2026 bổ sung các mốc chương trình; xem [timeline hoạt động](TIMELINE_HOAT_DONG.md).

## 1. Kỹ năng yêu cầu

- Nhà tổ chức chọn tối đa 20 kỹ năng từ danh mục chung khi tạo hoặc sửa hoạt động. Có thể không chọn hoặc bỏ toàn bộ.
- Liên kết nhiều–nhiều `Activity.required_skills` dùng lại `core.Skill`; không sao chép tên kỹ năng vào hoạt động.
- Danh sách và trang chi tiết hiển thị các kỹ năng đã chọn. API trả `required_skills` (ID) và `skill_details` (ID, tên, slug).
- Kỹ năng cung cấp thông tin và hỗ trợ tìm kiếm. Người chưa có kỹ năng vẫn đăng ký được; Nhà tổ chức tiếp tục xét duyệt từng đơn.
- Chỉ chủ hoạt động được chỉnh sửa khi còn Nháp/Công khai. Hoạt động Hoàn thành/Đã hủy giữ nguyên thông tin.

## 2. Bộ lọc kết hợp

Áp dụng cho danh sách công khai và danh sách hoạt động của Nhà tổ chức. Các điều kiện kết hợp theo AND, xử lý trong MySQL trước phân trang.

| Tham số | Ý nghĩa |
|---|---|
| `search` | Tên chứa từ khóa, tối đa 200 ký tự |
| `status` | `published`, `completed`, `cancelled`; danh sách của chủ hoạt động có thêm `draft` |
| `date_from` | Ngày bắt đầu sớm nhất, định dạng `YYYY-MM-DD` |
| `date_to` | Ngày bắt đầu muộn nhất, định dạng `YYYY-MM-DD` |
| `location` | Địa chỉ chứa từ khóa, tối đa 200 ký tự |
| `skill` | ID của một kỹ năng yêu cầu |
| `page`, `page_size` | Phân trang hiện có |

Khoảng ngày tính theo ngày **bắt đầu hoạt động**, bao gồm cả hai đầu, theo giờ Việt Nam UTC+7. Không lọc theo ngày kết thúc. Có thể chỉ nhập một đầu của khoảng ngày. Ngày từ lớn hơn ngày đến, trạng thái sai hoặc kỹ năng không tồn tại trả lỗi 400.

Bản nháp và bản nháp đã hủy luôn bị loại khỏi danh sách công khai. Danh sách quản lý chỉ chứa hoạt động thuộc người đang đăng nhập. Bộ lọc không thay đổi các giới hạn này.

Giao diện lưu điều kiện trong URL để tải lại, dùng nút Quay lại của trình duyệt hoặc phân trang vẫn giữ điều kiện. Nút **Xóa tìm kiếm** xóa từ khóa và toàn bộ bộ lọc. Nhấn **Tìm kiếm** để áp dụng các điều kiện vừa nhập.

## 3. Ảnh bìa

1. Nhà tổ chức tạo và lưu hoạt động.
2. Tại trang quản lý chi tiết, chọn **Chọn ảnh bìa hoạt động**. Ảnh được tải lên và lưu ngay.
3. Chọn ảnh khác để thay thế hoặc dùng **Xóa ảnh bìa** để bỏ ảnh.

- Mỗi hoạt động có tối đa một ảnh; ảnh là tùy chọn. Không có ảnh hoặc tải ảnh lỗi sẽ hiển thị hình minh họa mặc định.
- Nhận JPEG, PNG, WebP thực sự hợp lệ, tối đa 5 MB và 16 triệu điểm ảnh. Không chỉ tin phần mở rộng/MIME do trình duyệt gửi.
- Máy chủ sửa chiều ảnh theo EXIF, giới hạn cạnh dài tối đa 1.920 px, mã hóa lại thành JPEG và bỏ metadata gốc. Tên file do máy chủ tạo ngẫu nhiên.
- File lưu trong `backend/media/activities/covers/`; database chỉ lưu đường dẫn. Không công khai trực tiếp thư mục media.
- `GET /api/v1/activities/<id>/cover/`: ảnh hoạt động đã công khai được xem công khai; ảnh Nháp hoặc Nháp đã hủy chỉ chủ hoạt động xem được. Trả 404 khi không có ảnh hoặc không được xem.
- `POST` cùng URL: multipart chỉ gồm một file `cover`. `DELETE` cùng URL: xóa ảnh. Cả hai yêu cầu phiên đăng nhập Organizer, CSRF và quyền sở hữu; chỉ được sửa ở trạng thái Nháp/Công khai.
- File cũ chỉ xóa sau khi transaction database thành công. Nếu lưu database thất bại, file mới được dọn và ảnh cũ được giữ nguyên.
- `cover_url` trong thông tin hoạt động có phiên bản theo tên file để cập nhật ảnh sau khi thay. API ảnh dùng `no-store` để không lưu cache ảnh riêng tư.

## 4. Cập nhật dữ liệu và kiểm chứng

Migration `activities.0002_activity_cover_activity_required_skills` thêm trường ảnh và bảng liên kết kỹ năng. Hoạt động cũ mặc định không có ảnh/kỹ năng; các thông tin và nghiệp vụ hiện có giữ nguyên. Sao lưu MySQL và media trước khi áp dụng migration.

Kiểm thử bao gồm tạo/sửa/xóa kỹ năng, dữ liệu sai, quyền sở hữu, trạng thái kết thúc, lọc kết hợp trước phân trang, ranh giới ngày Việt Nam, quyền xem ảnh bản nháp, thay/xóa ảnh, ảnh giả/quá lớn và rollback khi lưu lỗi. Có kiểm thử riêng xác nhận yêu cầu kỹ năng không chặn đăng ký.

Playwright thao tác giao diện tạo hoạt động với kỹ năng, tải ảnh, công khai, lọc kết hợp, tải lại/Quay lại giữ bộ lọc, xem chi tiết và xóa ảnh trên desktop và màn hình hẹp.

Migration đã áp dụng trên MySQL80 ngày 28/09/2026 sau khi tạo bản sao lưu tại `tmp/backups/snapshot-20260928-194522/`. Đã đối chiếu dữ liệu tài khoản, hồ sơ, kỹ năng hồ sơ, hoạt động, đăng ký, điểm danh, phản hồi và nhật ký trước/sau; các bản ghi cũ giữ nguyên. API readiness và danh sách thật đều trả 200; vẫn có 6 hoạt động công khai.

115 kiểm thử backend và 8 kiểm thử bảo vệ runner đạt; frontend lint/build đạt. Log backend: `tmp/activity-extensions-check.log`.

Lượt kiểm thử trình duyệt cuối ngày 28/09/2026 đạt **50/50 ca**, gồm desktop và màn hình hẹp; database kiểm thử đã được dọn sau khi chạy. Log: `tmp/activity-extensions-e2e.log`; ảnh giao diện: `tmp/e2e-59539715a74d/screenshots/`. Đã kiểm tra trực quan bố cục bộ lọc, thẻ kỹ năng và ảnh bìa.
