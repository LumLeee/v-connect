# Giao diện không gian Quản trị viên

## Phạm vi

Các trang Admin trong website dùng chung thanh điều hướng bên trái, thanh tài khoản, avatar, chuông thông báo và đường dẫn về tổng quan. Bố cục thống nhất với không gian Nhà tổ chức và Tình nguyện viên, điều chỉnh cho màn hình nhỏ.

| Trang | Nội dung |
| --- | --- |
| Tổng quan `/quan-tri` | Lời chào, username, số tài khoản, tài khoản bị khóa, hoạt động công khai, lượt tham gia hoàn thành và trạng thái hoạt động. Các thẻ dẫn đến công việc quản trị hiện có. |
| Tài khoản | Bộ lọc, danh sách dạng hàng, vai trò, trạng thái và thao tác khóa/mở khóa. Hiển thị rõ tài khoản Admin được bảo vệ. |
| Phản hồi | Bộ lọc trạng thái, nội dung đánh giá, lý do ẩn và người xử lý. |
| Nhật ký | Danh sách thao tác, người thực hiện, đối tượng, lý do và thời điểm. |
| Báo cáo | Tổng quan số liệu, danh sách hoạt động, kết quả từng hoạt động và chi tiết đăng ký. |
| Báo cáo mở rộng | Bộ lọc, biểu đồ, xuất Excel và in/lưu PDF trong khung quản trị; khi in ẩn thanh điều hướng. |
| Hồ sơ | Thông tin cơ bản và avatar, tiếp tục dùng username đăng nhập cho Admin. |
| Thông báo | Danh sách và cấu hình thông báo hiện có. |

Trang chủ và các trang công khai tiếp tục dùng giao diện công khai. Không thay đổi giao diện Django Admin tại `/admin/` vì đây là công cụ quản trị kỹ thuật riêng.

## Dữ liệu và quyền hạn

Tổng quan đọc `/reports/overview/`; không thêm API hoặc bảng dữ liệu. Số liệu tính trên toàn hệ thống từ backend, không đếm từ một trang danh sách. Lượt tham gia hoàn thành chỉ tính có điểm danh ở hoạt động Hoàn thành.

Giữ nguyên yêu cầu nhập lý do khi khóa/mở khóa tài khoản và ẩn phản hồi. Các đường dẫn hoạt động mở báo cáo quản trị hiện có, không cấp thêm quyền chỉnh sửa hoạt động của Nhà tổ chức. Không hiển thị chức năng chưa triển khai.

## Mã nguồn

- `layouts/AdminLayout.jsx`: điều hướng, tài khoản, avatar và đăng xuất.
- `layouts/SiteLayout.jsx`: chọn khung Admin theo vai trò và đường dẫn.
- `pages/AdminDashboard.jsx`: tổng quan dùng số liệu thật, trạng thái hoạt động và lối vào các công việc quản trị.
- `pages/AdminAccountsPage.jsx`, `pages/AuditPage.jsx`: bố cục danh sách tài khoản và nhật ký.
- `styles/admin-workspace.css`: bố cục riêng của Admin, dùng chung nền tảng giao diện quản lý đã có.
- `e2e/admin-workspace.spec.js`: kiểm tra 11 màn hình, số liệu, điều hướng, tràn ngang, lỗi mạng, thử lại và chặn khách.

## Kiểm chứng ngày 07/10/2026

- Lint và build frontend: đạt.
- 28/28 kiểm thử trình duyệt liên quan đạt trên cấu hình máy tính và màn hình nhỏ: `admin-workspace`, `auth`, `reports`, `feedback`, `advanced-reports`.
- Kiểm tra 11 màn hình Admin tại các chiều rộng 320, 390, 768 và 1280 px; không tràn ngang, điều hướng chọn đúng mục, số tài khoản khớp API.
- Kiểm tra đăng nhập Admin bằng username, phân quyền, khóa/mở khóa với lý do và vô hiệu phiên cũ, ẩn phản hồi, lọc báo cáo, xuất Excel và in báo cáo.
- Kiểm tra lỗi mạng và thử lại trên tổng quan; khách chưa đăng nhập được chuyển đến đăng nhập.
- Đã xem ảnh chụp tổng quan, danh sách tài khoản, phản hồi, báo cáo mở rộng và hồ sơ ở cấu hình máy tính hoặc màn hình nhỏ. Database thử nghiệm được tự xóa sau khi hoàn tất.
