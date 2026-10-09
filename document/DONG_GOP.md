# Xác nhận giờ đóng góp

Ngày cập nhật: 08/10/2026.

## Quy tắc

- Nhà tổ chức sở hữu hoạt động xác nhận cho từng người đã được duyệt và có bản ghi điểm danh.
- Chỉ xác nhận khi hoạt động Hoàn thành và đã qua giờ kết thúc. Không tự tính từ check-in; chưa triển khai check-out.
- Nhập số phút nguyên từ 0 đến thời lượng hoạt động, lấy phần phút nguyên của khoảng kết thúc trừ bắt đầu. 0 phút là đã xác nhận nhưng không công nhận thời gian; khác với chưa xác nhận.
- Điều chỉnh số phút phải có lý do tối đa 1.000 ký tự. Mỗi lần thay đổi lưu số cũ, số mới, người thực hiện, thời điểm và phiên bản.
- Gửi cùng số phút ở phiên bản hiện tại không tạo thêm lịch sử hoặc thông báo. Yêu cầu dùng phiên bản cũ bị từ chối và cần tải lại.
- Ghi nhận và lịch sử được lưu trong cùng giao dịch; khóa dòng hoạt động khi cập nhật để tránh ghi đè giữa các yêu cầu đồng thời.
- Tình nguyện viên chỉ xem dữ liệu của mình. Nhà tổ chức chỉ xác nhận và xem lịch sử hoạt động sở hữu. Admin có quyền đọc API lịch sử; chưa có quyền sửa giờ đóng góp.

## Sử dụng

Nhà tổ chức mở **Quản lý đóng góp**, chọn hoạt động Hoàn thành hoặc mở **Giờ đóng góp** trong thanh quản lý hoạt động. Chọn **Xác nhận đóng góp**, nhập số phút rồi lưu. Với dữ liệu đã xác nhận, chọn **Điều chỉnh đóng góp**, nhập số mới và lý do.

Tình nguyện viên mở **Đóng góp của tôi** để xem tổng giờ/phút, số hoạt động đã xác nhận, số hoạt động chờ xác nhận và chi tiết. Tổng tính trên toàn bộ dữ liệu hợp lệ, không chỉ trang đang xem. Có thể mở lịch sử điều chỉnh của từng lượt tham gia.

Xác nhận hoặc điều chỉnh tạo thông báo trong website và hàng đợi email theo tùy chọn email hiện có. Việc gửi email thực tế phụ thuộc tiến trình xử lý và cấu hình SMTP.

## Dữ liệu và API

- `Contribution`: một bản ghi cho mỗi điểm danh, số phút hiện tại, phiên bản và người xác nhận gần nhất.
- `ContributionChange`: lịch sử bất biến qua API; không cung cấp thao tác xóa hoặc sửa các lần trước.
- Migration `participations/0004_contribution_contributionchange.py` chỉ thêm bảng; không tự gán giờ cho dữ liệu cũ.
- `GET /api/v1/contributions/`: danh sách và tổng cá nhân, phân trang.
- `GET /api/v1/contributions/<attendance_id>/history/`: lịch sử có kiểm tra quyền, phân trang.
- `GET /api/v1/organizer/activities/<id>/contributions/`: người đủ điều kiện trong hoạt động sở hữu.
- `POST /api/v1/organizer/activities/<id>/contributions/<attendance_id>/`: xác nhận/điều chỉnh với `minutes`, `revision`, `reason`. Lần đầu gửi `revision=0`.

Giờ đóng góp được hiển thị ở trang đóng góp; chưa bổ sung cột giờ vào các biểu đồ hoặc tệp báo cáo Excel/PDF hiện có.

## Kiểm chứng và cập nhật database

- 164 kiểm thử backend và 8 kiểm thử bảo vệ công cụ chạy đạt; Django check, kiểm tra migration, lint và build đạt.
- 28/28 kiểm thử trình duyệt liên quan đạt trên máy tính và màn hình nhỏ, gồm đóng góp, luồng nghiệp vụ chính, giao diện hai vai trò, thông báo và báo cáo.
- Kiểm tra xác nhận lần đầu, điều chỉnh có lý do, từ chối vượt thời lượng/giá trị không hợp lệ, phiên bản cũ, sai vai trò và sai chủ sở hữu; lỗi tạo thông báo hoàn tác cả xác nhận và lịch sử.
- Kiểm tra tổng trên toàn bộ dữ liệu có phân trang và phân biệt chờ xác nhận với xác nhận 0 phút. Giao diện được kiểm tra không tràn ngang ở 320, 390, 768 và 1280 px; đã xem ảnh chụp trang xác nhận và lịch sử.
- Đã sao lưu MySQL và media, kiểm tra SHA-256 của bản sao lưu, sau đó áp dụng migration `0004` thành công vào MySQL80 hiện có. Các bản ghi cũ không được tự gán giờ đóng góp.
