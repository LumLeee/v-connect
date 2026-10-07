# Giao diện không gian Tình nguyện viên

## Phạm vi

Tất cả trang dành cho Tình nguyện viên đã đăng nhập dùng chung thanh điều hướng, thông tin tài khoản và chuông thông báo. Các chức năng đang có tiếp tục sử dụng dữ liệu thật.

| Nhóm trang | Thay đổi |
| --- | --- |
| Tổng quan | Giữ thẻ chào mừng, số liệu, hoạt động sắp tới và lịch sử; điều chỉnh bố cục theo khung chung. |
| Khám phá hoạt động | Bộ lọc và thẻ ảnh hoạt động trong không gian Tình nguyện viên; các bộ lọc hiện có được giữ lại. |
| Chi tiết hoạt động | Ảnh bìa và nội dung ở cột chính, thông tin và đăng ký ở cột bên; chuyển thành một cột trên màn hình hẹp. |
| Đăng ký của tôi | Hàng thông tin hoạt động, Nhà tổ chức, thời gian, trạng thái và đường dẫn quản lý đăng ký. |
| Lịch sử tham gia | Danh sách lượt có mặt, trạng thái hoạt động, thông tin điểm danh và đường dẫn gửi phản hồi khi đủ điều kiện. |
| Điểm danh của tôi | Trang chọn hoạt động có đường dẫn check-in cho đơn đã được duyệt, hoạt động Công khai và chưa có điểm danh. Trang check-in tiếp tục kiểm tra thời gian và điều kiện trên backend. |
| Đánh giá hoạt động | Trang chọn từ lịch sử có mặt; chỉ hoạt động Hoàn thành có đường dẫn gửi/xem phản hồi. Biểu mẫu có nút chọn 1–5 sao, đồng bộ với ô nhập điểm. |
| Hồ sơ | Ảnh đại diện, thông tin cơ bản, kỹ năng, sở thích và lịch rảnh được trình bày trong các khối nhất quán. |
| Thông báo | Danh sách thông báo và tùy chọn email trong khung chung. |
| Thống kê | Làm nổi bật số liệu và giữ các đường dẫn xem chi tiết. |

Trang chủ, giới thiệu, đăng nhập và đăng ký vẫn dùng khung công khai. Khách chưa đăng nhập vẫn xem hoạt động với giao diện công khai. Giao diện Nhà tổ chức và Admin được giới hạn riêng theo vai trò.

## Đường dẫn mới

- `/tinh-nguyen-vien/check-in`: chọn hoạt động để check-in.
- `/tinh-nguyen-vien/phan-hoi`: chọn hoạt động để gửi hoặc xem phản hồi.

Danh sách chọn điểm danh dùng các đơn đăng ký hiện có; nút check-in chỉ xuất hiện trên đơn phù hợp. Danh sách chọn đánh giá dùng lịch sử có mặt, ghi rõ các hoạt động chưa thể gửi phản hồi. Không tự động ghi nhận điểm danh hay gửi phản hồi khi mở trang.

Các thẻ thống kê sử dụng API báo cáo hiện có, tính toàn bộ dữ liệu của tài khoản; danh sách bên dưới được phân trang trên máy chủ. Không tính số liệu từ riêng trang đang xem.

## Tổ chức mã nguồn

- `layouts/VolunteerLayout.jsx`: khung chung, điều hướng theo đường dẫn, avatar và đăng xuất.
- `layouts/SiteLayout.jsx`: chọn khung theo vai trò và đường dẫn.
- `pages/VolunteerParticipations.jsx`: đăng ký, lịch sử và hai trang chọn hoạt động.
- `pages/FeedbackPage.jsx`: chọn sao, thông tin hoạt động và biểu mẫu phản hồi.
- `styles/volunteer-workspace.css`: giao diện giới hạn trong không gian Tình nguyện viên và các kích thước màn hình.
- `e2e/volunteer-workspace.spec.js`: kiểm tra toàn bộ nhóm trang với dữ liệu thật, gửi đánh giá bằng sao, điều hướng, lỗi mạng và phân quyền khách.

Không thêm bảng, migration hoặc API nghiệp vụ. Các mục AI, tổng giờ đóng góp, điểm tác động và những chức năng chưa triển khai không được hiển thị.

## Kiểm chứng ngày 07/10/2026

- `npm.cmd run lint` và `npm.cmd run build`: đạt.
- Toàn bộ kiểm thử trình duyệt qua `scripts/test_e2e.py`: 74/74 đạt trên hai cấu hình máy tính và màn hình nhỏ, gồm các luồng nghiệp vụ hiện có của các vai trò.
- Nhóm kiểm thử mới đi qua 12 màn hình Tình nguyện viên, kiểm tra điều hướng đang chọn và không tràn ngang ở chiều rộng 320, 390, 768 và 1280 px.
- Kiểm tra dữ liệu đăng ký, xét duyệt, điểm danh và hoàn thành thật trong database thử nghiệm; chọn sao và gửi phản hồi; trạng thái trống, lỗi mạng, thử lại và chuyển khách chưa đăng nhập tới trang đăng nhập.
- Đã xem ảnh chụp giao diện máy tính và màn hình nhỏ cho các trang tiêu biểu: tổng quan, hoạt động, chi tiết, lịch sử, hồ sơ, phản hồi, check-in và thống kê.
- Database thử nghiệm riêng đã được công cụ tự xóa sau khi chạy xong.
