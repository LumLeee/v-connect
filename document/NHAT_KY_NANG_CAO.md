# Nhật ký thao tác nâng cao

Ngày triển khai: 10/10/2026. Trang **Quản trị → Lịch sử thao tác** chỉ dành cho Admin.

## Tra cứu và xem chi tiết

- Kết hợp loại thao tác, từ ngày/đến ngày, người thực hiện, tài khoản liên quan và tên hoạt động. Ngày tính theo giờ Việt Nam, bao gồm cả hai ngày đầu/cuối.
- Tìm người theo tên, email hoặc username hiện tại. Phần **Tra cứu bằng mã định danh** nhận UUID chính xác của người thực hiện, tài khoản, hoạt động hoặc đối tượng nghiệp vụ.
- Phân trang giữ nguyên bộ lọc; bộ lọc nằm trên URL để tải lại/chia sẻ trong phạm vi tài khoản Admin. Xóa bộ lọc để xem lại tất cả.
- **Xem chi tiết thao tác** hiển thị người thực hiện, đối tượng, hoạt động, lý do, thời điểm, mã nhật ký và dữ liệu trước–sau. Có liên kết xem lịch sử của cùng người/tài khoản/hoạt động; quay lại giữ bộ lọc trước đó.
- Bản ghi cũ không có dữ liệu trước–sau được ghi rõ, không dựng lại từ dữ liệu hiện tại. Tên người và tên hoạt động ở phần thông tin chung lấy theo hồ sơ hiện tại; UUID giữ định danh. Nội dung trước–sau đã lưu không đổi theo các lần sửa nghiệp vụ về sau.

## Các thao tác được ghi nhận

| Nhóm | Dữ liệu trước–sau |
| --- | --- |
| Khóa/mở khóa tài khoản | Trạng thái hoạt động; lý do giữ ở nhật ký |
| Duyệt/từ chối đăng ký | Trạng thái chờ duyệt → được duyệt/bị từ chối |
| Xác nhận có mặt | Chưa có mặt → có mặt, phương thức thủ công/QR/mã |
| Tạo/thu hồi mã điểm danh | Thời điểm cấp, hết hạn, thu hồi; không lưu nonce, mã ngắn hoặc token QR |
| Ẩn phản hồi | Trạng thái ẩn; lý do giữ ở nhật ký |
| Tạo hoạt động | Các thông tin nghiệp vụ ban đầu và timeline |
| Sửa hoạt động | Chỉ các trường thực sự thay đổi: tên, mô tả, địa điểm, lịch, sức chứa, kỹ năng và timeline |
| Đổi trạng thái hoạt động | Nháp/Công khai/Hoàn thành/Đã hủy trước và sau |
| Đổi/xóa ảnh bìa | Tên tệp nội bộ trước và sau; không giữ bản sao ảnh đã xóa và không cung cấp đường dẫn xem ảnh cũ |
| Xác nhận/điều chỉnh đóng góp | Số phút, lần xác nhận và lý do; liên kết đối tượng bằng UUID điểm danh |

Thay đổi timeline nằm trong thao tác **Sửa hoạt động**, hiển thị danh sách mốc trước/sau. Thao tác lưu lại dữ liệu không thay đổi không sinh sự kiện sửa hoạt động. Các thao tác lặp vốn không làm thay đổi trạng thái tiếp tục không tạo nhật ký giả. Nhật ký được ghi cùng transaction với thay đổi nghiệp vụ: lỗi ghi nhật ký làm rollback thay đổi đó.

Chưa ghi lịch sử riêng cho mọi hành động trong hệ thống (ví dụ xem trang, sửa hồ sơ cá nhân, tự đăng ký/hủy đơn). Chưa có chức năng cấp quyền quản trị chi tiết/chứng nhận nên chưa có nhật ký cho các mục này. Các thao tác SQL trực tiếp hoặc công cụ bên ngoài API không tự được ghi nhận.

## API và lưu trữ

- `GET /api/v1/admin/audit/`: giữ phân trang; thêm `date_from`, `date_to` (YYYY-MM-DD), `actor`, `subject`, `activity`, `object_id` (UUID), `actor_search`, `subject_search`, `activity_search`, cùng `action` hiện có.
- `GET /api/v1/admin/audit/<uuid>/`: chi tiết, gồm `before` và `after`. Danh sách không tải hai trường JSON này.
- Chỉ Admin được đọc; API không hỗ trợ thêm/sửa/xóa nhật ký. Django Admin tiếp tục chỉ đọc. Cả danh sách và chi tiết trả `no-store`.
- Migration `reports.0003_auditevent_after_auditevent_before_and_more` thêm hai trường JSON nullable, các loại thao tác và chỉ mục theo người thực hiện/tài khoản/hoạt động cùng thời điểm. Bản ghi cũ giữ `null`.
- Dữ liệu được lấy từ danh sách trường nghiệp vụ cho phép, không sao chép toàn bộ request/model; không lưu mật khẩu, cookie, session, token hoặc mã điểm danh.

## Kiểm chứng

Kiểm thử bao gồm biên ngày Việt Nam, kết hợp bộ lọc, phân trang, dữ liệu đầu vào không hợp lệ, quyền truy cập, API chỉ đọc, lịch sử cũ, thay đổi timeline, lưu lại không đổi dữ liệu, không lộ mã điểm danh và rollback khi ghi nhật ký lỗi. Trình duyệt kiểm tra lọc và quay lại danh sách, chi tiết trước–sau, lỗi mạng, trạng thái trống và bố cục nhiều kích thước.

Kết quả ngày 10/10/2026: 184 kiểm thử backend, 8 kiểm thử bảo vệ runner và lint/build đạt. Nhóm 6 kiểm thử nhật ký chạy lại đạt sau khi bổ sung giới hạn ngày. 20 ca Playwright hồi quy đạt; 2 ca nhật ký chạy lại đạt sau khi hoàn thiện thông báo lỗi và thứ tự hiển thị mốc. Đã kiểm tra ảnh desktop/narrow và bố cục 320–1280px. Migration đã áp dụng trên MySQL sau khi sao lưu và xác minh checksum.
