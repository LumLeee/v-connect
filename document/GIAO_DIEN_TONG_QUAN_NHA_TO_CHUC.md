# Giao diện tổng quan Nhà tổ chức

## Phạm vi

Cập nhật riêng trang `/nha-to-chuc`. Bố cục gồm thanh điều hướng bên trái, thanh thông tin tài khoản và chuông thông báo phía trên, ba thẻ thống kê và các khối công việc. Màu sắc và nội dung được điều chỉnh theo V-Connect; chỉ hiển thị chức năng đã có.

Sau đợt cập nhật tiếp theo, các trang quản lý bên trong dùng chung khung điều hướng với tổng quan. Xem `GIAO_DIEN_QUAN_LY_NHA_TO_CHUC.md` để biết phạm vi và cách tổ chức mã nguồn.

## Dữ liệu hiển thị

| Khu vực | Quy tắc |
| --- | --- |
| Hoạt động đã tạo | Tất cả hoạt động thuộc Nhà tổ chức đang đăng nhập, bao gồm bản nháp. |
| Đơn chờ xét duyệt | Đơn chờ duyệt của hoạt động Công khai và chưa đến giờ bắt đầu. Không tính đơn đã quá hạn xét duyệt. |
| Hoạt động hoàn thành | Hoạt động có trạng thái Hoàn thành. |
| Đang diễn ra | Hoạt động Công khai, từ giờ bắt đầu đến giờ kết thúc; hiển thị tối đa 3 hoạt động, ưu tiên kết thúc sớm. |
| Sắp tới | Hoạt động Công khai chưa bắt đầu; hiển thị tối đa 4 hoạt động gần nhất. |
| Đăng ký cần xử lý | Tối đa 4 đơn còn hạn, ưu tiên hoạt động sắp bắt đầu rồi đến đơn đăng ký sớm. |
| Kết quả và phản hồi | Lượt tham gia có điểm danh ở hoạt động Hoàn thành và phản hồi được phép hiển thị. |

Số tổng trên từng khu vực tính toàn bộ dữ liệu phù hợp, không chỉ số mục xem trước. Danh sách đầy đủ nằm ở trang Quản lý hoạt động và Báo cáo. Mục Đơn đăng ký trong thanh điều hướng mở trang chọn hoạt động để xét duyệt; khu vực cần xử lý trên tổng quan chỉ hiển thị đơn còn hạn.

Thời gian hiển thị theo múi giờ Việt Nam. Nút Cập nhật dữ liệu tải lại tổng quan. Hệ thống có trạng thái đang tải, lỗi kèm nút thử lại và hướng dẫn khi chưa có dữ liệu.

## Tổ chức mã nguồn

- `frontend/src/pages/OrganizerDashboard.jsx`: bố cục, số liệu và lối tắt.
- `frontend/src/styles/organizer-dashboard.css`: giao diện riêng, tự điều chỉnh theo chiều rộng màn hình.
- `frontend/src/layouts/SiteLayout.jsx`: dùng khung riêng tại trang tổng quan Nhà tổ chức.
- `backend/apps/reports/organizer_dashboard.py`: API `GET /api/v1/reports/organizer-dashboard/` tổng hợp dữ liệu, chỉ dành cho Nhà tổ chức và giới hạn theo tài khoản hiện tại.
- `backend/apps/reports/test_organizer_dashboard.py`: kiểm tra quyền, phạm vi dữ liệu, giới hạn danh sách và mốc thời gian.
- `frontend/e2e/organizer-dashboard.spec.js`: kiểm tra trình duyệt với dữ liệu thật, lối tắt, màn hình nhỏ, trạng thái trống và lỗi mạng.

Thay đổi này không thêm bảng hoặc migration và không cần tạo dữ liệu mẫu trong database đang sử dụng.

## Kiểm chứng ngày 06/10/2026

- Django check và kiểm tra migration: đạt, không có migration mới.
- 155 kiểm thử backend và 8 kiểm thử an toàn: đạt.
- ESLint và bản build frontend: đạt.
- 66 kiểm thử Playwright trên màn hình máy tính và màn hình hẹp: đạt.
- Đã xem ảnh chụp giao diện có dữ liệu ở cả hai kích thước; kiểm tra không tràn ngang tại 320, 390, 768 và 1280 px.
- Kiểm thử dùng database MySQL tạm và đã xóa database kiểm thử sau khi hoàn tất.

Hai bộ kiểm thử đăng nhập được điều chỉnh để nhận nhãn bắt đầu bằng “Email hoặc username”, tương thích với nhãn người dùng đã sửa trong trang đăng nhập.
