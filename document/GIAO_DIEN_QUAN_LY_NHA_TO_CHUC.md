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

Thanh chuyển nghiệp vụ của một hoạt động gồm Tổng quan hoạt động, Đăng ký tham gia, Bảng điểm danh, Đánh giá, Người phù hợp, Lời mời, Điểm đóng góp và Báo cáo kết quả.

Các mục chọn hoạt động mới:

- `/nha-to-chuc/dang-ky`: chọn hoạt động cần xét duyệt.
- `/nha-to-chuc/diem-danh`: chọn hoạt động cần điểm danh.
- `/nha-to-chuc/phan-hoi`: chọn hoạt động cần xem phản hồi.

Các danh sách dùng API hiện có, phân trang và lọc trên máy chủ theo tài khoản Nhà tổ chức. Thẻ tổng hợp ở đầu danh sách tính trên toàn bộ hoạt động của tài khoản; số kết quả bên dưới tính theo bộ lọc đang áp dụng. Tổng đơn chờ duyệt ở đầu danh sách bao gồm cả đơn quá hạn; mục cần xử lý trên dashboard chỉ tính đơn còn hạn.

## Màn hình nhỏ và in báo cáo

Menu chung hỗ trợ đóng/mở; trên màn hình hẹp mặc định đóng. Thanh chuyển nghiệp vụ hoạt động ở chiều rộng tối đa 700 px dùng một hàng cuộn ngang và đưa mục đang chọn vào vùng nhìn thấy. Các hàng thông tin, biểu mẫu và khối số liệu chuyển thành một hoặc hai cột theo không gian còn lại. Bảng báo cáo chi tiết vẫn có vùng cuộn riêng khi cần.

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

## Hoàn thiện đợt 1 — 05/11/2026

- Chi tiết hoạt động chỉ hiển thị tên một lần; nhóm trạng thái, thời gian, địa điểm và số người tham gia ở đầu trang.
- Đưa chỉnh sửa và chuyển trạng thái lên đầu, tách nút Hủy bằng màu và đường phân cách; giữ hộp xác nhận hiện có.
- Hướng dẫn chờ đến giờ kết thúc chỉ hiện khi nút Hoàn thành đang bị giới hạn thời gian, không hiện trong chế độ tắt kiểm tra thời gian.
- Thanh nghiệp vụ điện thoại cuộn ngang, giữ đường dẫn và thao tác bàn phím.
- Lint/build đạt. Kiểm tra Edge với API mô phỏng tại 320–1440 px đạt, gồm hộp xác nhận, lỗi/thử lại, các trạng thái hoạt động, chính sách thời gian và trang công khai.

## Hoàn thiện đợt 2 — 05/11/2026

- Biểu mẫu tạo/sửa có một thanh lưu bám đáy vùng nhìn thấy, kèm trạng thái có thay đổi chưa lưu. Trên điện thoại, nút Quay lại và Lưu vẫn cùng hàng.
- Khi còn thay đổi, trình duyệt hỏi xác nhận trước khi rời qua liên kết, Back/Forward hoặc đăng xuất; tải lại/đóng trang dùng cảnh báo gốc của trình duyệt. Hoàn nguyên nội dung không còn cảnh báo, lưu thành công chuyển trang trực tiếp.
- Lỗi nhập liệu và lỗi API được tập hợp đầu biểu mẫu, giữ nguyên dữ liệu và có liên kết tới trường/mốc tương ứng. Vẫn kiểm tra dữ liệu ở backend; không gửi lại ngày giờ không đổi khi sửa hoạt động cũ.
- Guard lịch sử được khởi tạo trong `main.jsx` trước BrowserRouter để có thể hủy Back/Forward trước khi trang bị tháo khỏi giao diện.
- Lint/build đạt; 6 kiểm thử `e2e/activity-editor-ui.spec.js` với API mô phỏng đạt trên máy tính và điện thoại, kiểm tra cả lỗi/thử lại, giữ dữ liệu khi hủy rời trang và lưu lịch cũ. Giao diện không tràn ngang ở 320–1440 px.

## Hoàn thiện đợt 3 — 05/11/2026

- Lời mời của Nhà tổ chức hiển thị theo dòng ngang: người nhận, trạng thái, lời nhắn, thời điểm gửi/phản hồi/thu hồi. Không lặp tên hoạt động trong từng dòng. Nhấn dòng hoặc Enter để xem đầy đủ; nút Thu hồi tách riêng và có xác nhận.
- Tìm theo tên người nhận, lọc Tất cả/Chờ phản hồi/Đã chấp nhận/Đã từ chối/Đã thu hồi. API tổng hợp số lượng sau tìm kiếm, trước lọc trạng thái và phân trang; thứ tự gửi mới nhất được giữ ổn định.
- Tìm kiếm, trạng thái và trang nằm trong URL. Thu hồi thành công trở về trang 1, giữ bộ lọc và tải lại số đếm; Làm mới cập nhật cả ngữ cảnh hoạt động và danh sách.
- API vẫn giới hạn theo hoạt động của tài khoản hiện tại. Không thêm email vào dữ liệu lời mời và giữ luồng nhận lời mời của Tình nguyện viên.
- 15 kiểm thử backend trên MySQL riêng và 4 kiểm thử giao diện với API mô phỏng đạt; lint/build đạt. Đã kiểm tra 320–1440 px, lỗi/thử lại, thu hồi mục cuối trang, số đếm và giao diện Tình nguyện viên. MySQL tạm đã dừng và dữ liệu kiểm thử đã được xóa.

## Hoàn thiện đợt 4 — 05/11/2026

- Kết quả hoạt động của Nhà tổ chức có bốn chỉ số chính và bốn nhóm chi tiết: đăng ký, điểm danh, đóng góp, phản hồi. Các chỉ số đăng ký/điểm danh dẫn đến đúng danh sách theo hoạt động; quy tắc tính được thu gọn.
- Số điểm đóng góp lấy từ thống kê toàn bộ danh sách đủ điều kiện của API hiện có. Làm mới cập nhật kết quả và điểm đóng góp; lỗi phần điểm có thể thử lại riêng.
- Mẫu tổng kết dùng thanh thao tác gọn, ba nhóm số liệu và bố cục dễ đọc trên điện thoại. Giữ đầy đủ nội dung, kỹ năng, chương trình và thông tin lập báo cáo.
- Màn hình giữ cách hiển thị thời gian tương đối. Bản in A4 dọc sử dụng ngày giờ đầy đủ, hàng số liệu và mốc chương trình có quy tắc ngắt trang; nền trang cuối trắng.
- Lint/build và 4 kiểm thử giao diện với API mô phỏng đạt, gồm màn hình 320–1440 px, liên kết chi tiết, lỗi/thử lại, hoạt động chưa hoàn thành và giao diện Admin. Hai bản PDF mẫu đều đủ 12 mốc, thông tin cuối báo cáo và nằm trong lề; đã kiểm tra ảnh render của cả ba trang.

## Hoàn thiện đợt 5 và 6 — 05/11/2026

- Hồ sơ riêng của Nhà tổ chức có cụm Chọn ảnh/Dán ảnh/Xóa ảnh gọn và trạng thái thay đổi chưa lưu. Cập nhật ảnh được lưu riêng, không xóa trạng thái phần chữ; chỉ lưu hồ sơ thành công mới đặt lại trạng thái. Hồ sơ ứng viên giữ ảnh đại diện, các trường có dữ liệu và kỹ năng đã chọn.
- Thông báo Nhà tổ chức bỏ khẩu hiệu, thu gọn cài đặt email và nhóm theo ngày Việt Nam: Hôm nay, Hôm qua, ngày đầy đủ. Nội dung email phù hợp từng vai trò; đánh dấu đã đọc giữ bộ lọc và về trang 1 để tránh trang cuối hết dữ liệu.
- Biểu mẫu tạo/sửa có nút Xem trước. Nội dung được kiểm tra trước khi mở; dùng bố cục trang chi tiết công khai với dữ liệu đang nhập, ảnh bìa hiện có, kỹ năng, thời gian và chương trình đã sắp xếp. Không có thao tác đăng ký trong cửa sổ xem trước. Đóng cửa sổ giữ nguyên biểu mẫu và trạng thái chưa lưu.
- Xem trước không gửi yêu cầu ghi dữ liệu, lưu hoặc công khai hoạt động. Phần xác thực, chuyển giờ Việt Nam và dữ liệu gửi khi lưu được dùng chung để giữ nhất quán.
- Lint/build đạt. 20 trường hợp kiểm thử giao diện với API mô phỏng trên máy tính/điện thoại đạt, gồm cả luồng tạo/sửa cũ, cảnh báo rời trang, chọn/dán/xóa ảnh, lỗi/lưu hồ sơ, hồ sơ ứng viên, thông báo và các vai trò. Đã xem ảnh chụp; không tràn ngang tại 320–1440 px.

Cả sáu đợt cải tiến còn lại đã hoàn tất.
