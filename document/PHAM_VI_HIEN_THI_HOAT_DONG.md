# Phạm vi hiển thị hoạt động

Cập nhật ngày 08/10/2026.

## Danh sách và chi tiết công khai

Khách và Tình nguyện viên chỉ xem các hoạt động đang ở trạng thái **Công khai** trên trang khám phá và chi tiết hoạt động. Bản nháp, Hoàn thành và Đã hủy không xuất hiện; truy cập trực tiếp chi tiết hoặc ảnh bìa trả 404. Bộ lọc trạng thái được bỏ trên trang khám phá vì danh sách chỉ có một trạng thái hợp lệ.

API công khai luôn lọc trạng thái ở backend trước khi tìm kiếm, lọc và phân trang. Tham số yêu cầu Hoàn thành/Đã hủy không thể mở rộng quyền xem. API quản lý của Nhà tổ chức và báo cáo quản trị giữ nguyên phạm vi theo vai trò.

## Lịch sử và dữ liệu cá nhân

Lịch sử đăng ký, lượt tham gia và phản hồi riêng vẫn được giữ để người dùng xem kết quả và đánh giá sau hoạt động. Đây là dữ liệu cá nhân đã có quyền truy cập, không phải danh mục hoạt động công khai.

- Với hoạt động không còn Công khai, tổng quan, danh sách cá nhân và báo cáo cá nhân không đặt liên kết đến trang chi tiết công khai.
- Trang phản hồi lấy tên, thời gian và địa chỉ từ API phản hồi cá nhân khi người dùng đã có điểm danh hoặc phản hồi; không gọi API chi tiết công khai của hoạt động đã Hoàn thành.
- Điều kiện gửi phản hồi không đổi: có điểm danh hợp lệ, hoạt động Hoàn thành, đã qua giờ kết thúc và chưa gửi phản hồi.
- Nhà tổ chức vẫn xem ảnh bìa và quản lý hoạt động thuộc sở hữu theo các quyền hiện có.

Không xóa dữ liệu hoạt động, điểm danh, đăng ký hoặc phản hồi; không cần migration.

## Kiểm chứng

- 158 kiểm thử backend và 8 kiểm thử bảo vệ công cụ chạy đạt; kiểm tra Django, migration, lint và build đạt.
- Kiểm tra khách và Tình nguyện viên chỉ nhận trạng thái Công khai trong danh sách và chi tiết; bộ lọc không vượt quyền; ảnh của hoạt động Hoàn thành/Đã hủy bị chặn nhưng chủ sở hữu vẫn xem được.
- Bộ hồi quy trình duyệt 36 ca: 34 đạt lần đầu; hai ca phản hồi dùng bộ chọn liên kết cũ được cập nhật thành tiêu đề trong lịch sử. Chạy lại toàn bộ nhóm phản hồi: 4/4 đạt trên máy tính và màn hình nhỏ.
- Các luồng tạo/công khai/hủy, lịch sử điểm danh, gửi và kiểm duyệt phản hồi, báo cáo và các trang Tình nguyện viên đã được kiểm tra; hoạt động đã hoàn thành không mở được bằng URL chi tiết công khai.
