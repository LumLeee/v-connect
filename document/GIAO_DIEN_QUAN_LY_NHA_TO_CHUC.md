# Giao diện các trang quản lý Nhà tổ chức

## Phạm vi cập nhật

Các trang nội bộ của Nhà tổ chức dùng chung thanh điều hướng, thông tin tài khoản và chuông thông báo với trang tổng quan. Màu xanh và bố cục thẻ trắng thống nhất trong toàn bộ không gian quản lý.

| Nhóm trang | Nội dung |
| --- | --- |
| Hoạt động | Danh sách dạng hàng, tổng hợp số liệu, bộ lọc, trạng thái, thời gian, địa điểm, sức chứa và thao tác chi tiết/chỉnh sửa. |
| Tạo và sửa hoạt động | Chia biểu mẫu thành thông tin cơ bản; thời gian, địa điểm và số lượng; kỹ năng yêu cầu. |
| Chi tiết hoạt động | Thẻ thông tin và sức chứa, thanh chuyển nghiệp vụ, ảnh bìa, nội dung và các thao tác quản lý. |
| Đăng ký | Chọn hoạt động từ danh sách riêng; xem người đăng ký theo hàng thông tin liên hệ, trạng thái và nút xét duyệt. |
| Điểm danh | Chọn hoạt động, xem thời gian được điểm danh, quản lý QR/mã và danh sách người tham gia. |
| Phản hồi | Chọn hoạt động, xem điểm trung bình và các phản hồi hợp lệ. |
| Báo cáo | Tổng quan, danh sách, kết quả từng hoạt động và báo cáo mở rộng dùng chung khung quản lý; các số thống kê được làm nổi bật. |
| Hồ sơ | Chia khu vực ảnh đại diện, thông tin cá nhân và thông tin tổ chức. Avatar trên thanh điều hướng được cập nhật sau khi đổi ảnh. |
| Thông báo | Danh sách thông báo và tùy chọn email nằm trong không gian quản lý. |

Thanh chuyển nghiệp vụ của một hoạt động gồm Tổng quan hoạt động, Đăng ký tham gia, Bảng điểm danh, Đánh giá và Báo cáo kết quả.

Các mục chọn hoạt động mới:

- `/nha-to-chuc/dang-ky`: chọn hoạt động cần xét duyệt.
- `/nha-to-chuc/diem-danh`: chọn hoạt động cần điểm danh.
- `/nha-to-chuc/phan-hoi`: chọn hoạt động cần xem phản hồi.

Các danh sách dùng API hiện có, phân trang và lọc trên máy chủ theo tài khoản Nhà tổ chức. Thẻ tổng hợp ở đầu danh sách tính trên toàn bộ hoạt động của tài khoản; số kết quả bên dưới tính theo bộ lọc đang áp dụng. Tổng đơn chờ duyệt ở đầu danh sách bao gồm cả đơn quá hạn; mục cần xử lý trên dashboard chỉ tính đơn còn hạn.

## Màn hình nhỏ và in báo cáo

Thanh điều hướng chuyển lên phía trên trên màn hình hẹp. Các hàng thông tin, biểu mẫu và khối số liệu chuyển thành một hoặc hai cột theo không gian còn lại. Bảng báo cáo chi tiết vẫn có vùng cuộn riêng khi cần.

Khi in/lưu PDF, thanh điều hướng và thanh tài khoản được ẩn; chỉ giữ nội dung báo cáo.

## Tổ chức mã nguồn

- `layouts/OrganizerLayout.jsx`: khung chung và mục điều hướng đang được chọn.
- `layouts/SiteLayout.jsx`: áp dụng khung quản lý theo vai trò và đường dẫn.
- `pages/OrganizerDashboard.jsx`: nội dung tổng quan, dùng khung chung.
- `pages/OrganizerActivities.jsx`: danh sách quản lý và các màn hình chọn hoạt động.
- `components/OrganizerActivityHeader.jsx`: ngữ cảnh hoạt động và thanh chuyển nghiệp vụ.
- `styles/organizer-management.css`: bố cục nội bộ, responsive và quy tắc in; giới hạn trong không gian Nhà tổ chức.
- `e2e/organizer-management.spec.js`: kiểm tra các trang, điều hướng, xét duyệt, dữ liệu, lỗi mạng, kích thước màn hình và chế độ in.

Không thêm bảng, migration hoặc API nghiệp vụ mới. Các quy tắc đăng ký, xét duyệt, điểm danh và phản hồi tiếp tục được kiểm tra ở backend hiện có.

## Kiểm chứng ngày 06/10/2026

- ESLint và build frontend: đạt.
- Chạy bộ 70 trường hợp Playwright: 69 đạt ban đầu; đã sửa trạng thái bị hiển thị lặp ở trang chi tiết khiến một trường hợp không xác định được phần tử.
- Chạy lại 8 trường hợp thuộc luồng nghiệp vụ xuyên suốt và giao diện quản lý trên bản cuối: đạt toàn bộ, bao gồm trường hợp trước đó chưa đạt.
- Kiểm tra 14 màn hình quản lý ở chiều rộng 320, 390, 768 và 1280 px; không tràn ngang. Đã xem ảnh chụp desktop và màn hình hẹp, sửa chồng biểu tượng tìm kiếm và độ rộng hàng thông tin.
- Kiểm tra xét duyệt cập nhật sức chứa, đường dẫn nghiệp vụ, lỗi mạng/thử lại, bản in ẩn điều hướng và giao diện trang công khai.
- Database kiểm thử tạm đã được xóa sau khi chạy; không cần chỉnh dữ liệu đang sử dụng.
