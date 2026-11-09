# Giao diện tổng quan Nhà tổ chức

## Phạm vi

Cập nhật riêng trang `/nha-to-chuc`. Bố cục gồm thanh điều hướng bên trái, thanh thông tin tài khoản và chuông thông báo phía trên, ba thẻ thống kê và các khối công việc. Màu sắc và nội dung được điều chỉnh theo V-Connect; chỉ hiển thị chức năng đã có.

Sau đợt cập nhật tiếp theo, các trang quản lý bên trong dùng chung khung điều hướng với tổng quan. Xem `GIAO_DIEN_QUAN_LY_NHA_TO_CHUC.md` để biết phạm vi và cách tổ chức mã nguồn.

## Dữ liệu hiển thị

| Khu vực | Quy tắc |
| --- | --- |
| Hoạt động đã tạo | Tất cả hoạt động thuộc Nhà tổ chức đang đăng nhập, bao gồm bản nháp. |
| Đơn chờ xét duyệt | Đơn chờ duyệt của hoạt động Công khai. Khi bật kiểm tra thời gian, chỉ tính đơn chưa quá hạn xét duyệt. |
| Hoạt động hoàn thành | Hoạt động có trạng thái Hoàn thành. |
| Đang diễn ra | Hoạt động Công khai, từ giờ bắt đầu đến giờ kết thúc; hiển thị tối đa 3 hoạt động, ưu tiên kết thúc sớm. |
| Sắp tới | Hoạt động Công khai chưa bắt đầu; hiển thị tối đa 4 hoạt động gần nhất. |
| Đăng ký cần xử lý | Đặt ngay sau thống kê, xem trước tối đa 4 đơn có thể xét duyệt. Nhấn cả dòng để mở danh sách đơn chờ của hoạt động. Không có đơn thì dùng thông báo thu gọn. |
| Kết quả và phản hồi | Lượt tham gia có điểm danh ở hoạt động Hoàn thành và phản hồi được phép hiển thị. |

Số tổng trên từng khu vực tính toàn bộ dữ liệu phù hợp, không chỉ số mục xem trước. Danh sách đầy đủ nằm ở trang Quản lý hoạt động và Báo cáo. Mục Đơn đăng ký trong thanh điều hướng mở trang chọn hoạt động để xét duyệt; khu vực cần xử lý trên tổng quan chỉ hiển thị đơn còn hạn.

Thời gian hiển thị theo múi giờ Việt Nam. Nút Làm mới tải lại cả số liệu và các danh sách. Hệ thống có trạng thái đang tải, lỗi kèm nút thử lại và thông báo thu gọn khi chưa có dữ liệu.

## Các trang quản lý liên quan

- Menu theo luồng Tổng quan, Hoạt động, Đơn đăng ký, Ghép nối, Điểm danh, Đóng góp, Phản hồi, Báo cáo, Bảng xếp hạng. Trạng thái menu máy tính được nhớ riêng theo tài khoản; menu điện thoại mặc định đóng.
- Trang chọn hoạt động hiển thị số liệu theo chức năng. Tổng tính trên toàn bộ hoạt động phù hợp bộ lọc trước khi phân trang; chỉ trang quản lý hoạt động có nút tạo mới.
- Điểm danh và đóng góp hỗ trợ tìm tên/email, lọc trạng thái và thống kê phía server. Điểm 0 vẫn là đã chấm. Mã QR thu gọn được, lịch sử điều chỉnh điểm mở trong hộp thoại.
- Ghép nối hiển thị kỹ năng phù hợp và trạng thái lời mời. Phản hồi hiển thị trích nhận xét, số sao, thời điểm gửi, có lọc sao và thứ tự thời gian.
- Báo cáo Nhà tổ chức dùng chung bộ lọc cho ba chế độ Tổng hợp, Theo hoạt động, Biểu đồ; giữ xuất Excel và in toàn bộ dữ liệu đã lọc. Đường dẫn báo cáo cũ vẫn hoạt động.
- Bảng xếp hạng có hướng dẫn cấp bậc thu gọn; nút Làm mới nằm bên phải ở màn hình nhỏ.

## Tổ chức mã nguồn

- `frontend/src/pages/OrganizerDashboard.jsx`: bố cục, số liệu và lối tắt.
- `frontend/src/styles/organizer-dashboard.css`: giao diện riêng, tự điều chỉnh theo chiều rộng màn hình.
- `frontend/src/layouts/SiteLayout.jsx`: dùng khung riêng tại trang tổng quan Nhà tổ chức.
- `backend/apps/reports/organizer_dashboard.py`: API `GET /api/v1/reports/organizer-dashboard/` tổng hợp dữ liệu, chỉ dành cho Nhà tổ chức và giới hạn theo tài khoản hiện tại.
- `backend/apps/reports/tests/test_organizer_dashboard.py`: kiểm tra quyền, phạm vi dữ liệu, giới hạn danh sách và mốc thời gian.
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

## Kiểm chứng đợt hoàn thiện ngày 05/11/2026

- 254 kiểm thử backend đạt trên MySQL riêng, gồm quyền truy cập, phạm vi tài khoản, bộ lọc, phân trang và số liệu tổng hợp.
- Các luồng trình duyệt với React và Django thật đạt trên máy tính và màn hình hẹp: tổng quan, quản lý hoạt động, đơn đăng ký, ghép nối, điểm danh, đóng góp, phản hồi, báo cáo và bảng xếp hạng.
- Kiểm tra giao diện tại 320–1440 px đạt, bao gồm dữ liệu rỗng, lỗi mạng, thử lại, menu đóng/mở và xuất/in báo cáo.
- ESLint, bản build frontend và kiểm tra khoảng trắng Git đạt.
- Đã dừng máy chủ kiểm thử và xóa dữ liệu MySQL tạm sau khi hoàn tất.
