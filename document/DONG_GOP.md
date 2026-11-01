# Chấm điểm đóng góp

Ngày cập nhật: 01/11/2026. Điểm nguyên 0–10 thay thế hoàn toàn số giờ/phút đóng góp.

## Quy tắc

- Nhà tổ chức sở hữu hoạt động xác nhận cho từng người đã được duyệt và có bản ghi điểm danh.
- Chỉ xác nhận khi hoạt động Hoàn thành và đã qua giờ kết thúc. Không tự tính từ check-in; chưa triển khai check-out.
- Nhập điểm nguyên từ 0 đến 10, không nhận điểm lẻ. Điểm 0 là đã chấm, khác với chưa chấm. Giới hạn điểm độc lập với thời lượng hoạt động.
- Điều chỉnh điểm phải có lý do tối đa 1.000 ký tự. Mỗi lần thay đổi lưu điểm cũ, điểm mới, người thực hiện, thời điểm và phiên bản.
- Gửi cùng điểm ở phiên bản hiện tại không tạo thêm lịch sử hoặc thông báo. Yêu cầu dùng phiên bản cũ bị từ chối và cần tải lại.
- Ghi nhận và lịch sử được lưu trong cùng giao dịch; khóa dòng hoạt động khi cập nhật để tránh ghi đè giữa các yêu cầu đồng thời.
- Tình nguyện viên chỉ xem dữ liệu của mình. Nhà tổ chức chỉ chấm điểm và xem lịch sử hoạt động sở hữu. Admin có quyền đọc API lịch sử; không chấm thay Nhà tổ chức.

## Sử dụng

Nhà tổ chức mở **Quản lý đóng góp**, chọn hoạt động Hoàn thành hoặc mở **Điểm đóng góp** trong thanh quản lý hoạt động. Chọn **Xác nhận đóng góp**, nhập điểm rồi lưu. Với dữ liệu đã chấm, chọn **Điều chỉnh đóng góp**, nhập điểm mới và lý do.

Tình nguyện viên mở **Đóng góp của tôi** để xem tổng điểm, số hoạt động đã chấm, số hoạt động chờ chấm và chi tiết. Tổng cộng trên toàn bộ dữ liệu hợp lệ, không chỉ trang đang xem, và có thể lớn hơn 10 khi tham gia nhiều hoạt động. Có thể mở lịch sử điều chỉnh của từng lượt tham gia. Điểm đóng góp /10 độc lập với điểm phản hồi /5 và điểm ghép nối /100.

Xác nhận hoặc điều chỉnh tạo thông báo trong website và hàng đợi email theo tùy chọn email hiện có. Việc gửi email thực tế phụ thuộc tiến trình xử lý và cấu hình SMTP.

## Dữ liệu và API

- `Contribution`: một bản ghi cho mỗi điểm danh, `score` hiện tại (0–10), phiên bản và người chấm gần nhất.
- `ContributionChange`: `previous_score`, `score`, lý do, thời điểm, người chấm; lịch sử bất biến qua API, không cung cấp xóa hoặc sửa các lần trước.
- Database giới hạn điểm hiện tại/lịch sử trong 0–10.
- `GET /api/v1/contributions/`: danh sách và tổng cá nhân `summary.score`, `confirmed`, `pending`, phân trang.
- `GET /api/v1/contributions/<attendance_id>/history/`: lịch sử có kiểm tra quyền, phân trang.
- `GET /api/v1/organizer/activities/<id>/contributions/`: người đủ điều kiện trong hoạt động sở hữu.
- `POST /api/v1/organizer/activities/<id>/contributions/<attendance_id>/`: chấm/điều chỉnh với `score`, `revision`, `reason`. Lần đầu gửi `revision=0`. Ví dụ `{ "score": 8, "revision": 0, "reason": "" }`. Payload `minutes` cũ bị từ chối.

Điểm được hiển thị ở trang đóng góp và mẫu tổng kết. Các biểu đồ/Excel thống kê lượt tham gia và phản hồi giữ các chỉ số hiện có. Chức năng chứng nhận/chứng chỉ đã được gỡ theo yêu cầu.

Kết quả sau khi gỡ chức năng: 200 kiểm thử backend, 8 kiểm thử bảo vệ môi trường chạy, lint/build và 4 ca trình duyệt báo cáo đều đạt. Chấm/sửa điểm không còn phụ thuộc bảng hoặc dịch vụ chứng nhận. Xem [mẫu báo cáo tổng kết](MAU_BAO_CAO.md).

## Chuyển dữ liệu từ giờ sang điểm

Theo lựa chọn của người dùng, không quy đổi số phút cũ thành điểm. Migration `participations.0006_contribution_points` xóa chứng nhận theo giờ, lịch sử xác nhận theo giờ và bản ghi đóng góp theo giờ trước khi đổi trường sang điểm. Giữ tài khoản, hoạt động, đăng ký, điểm danh, phản hồi và lời mời để Nhà tổ chức chấm lại.

Migration `reports.0006_certificate_points` chuyển bản chụp chứng nhận sang điểm. Bước xóa không thể đảo ngược bằng migration: cần sao lưu và kiểm tra checksum trước khi áp dụng. Muốn khôi phục giờ cũ phải khôi phục bản sao lưu cùng code tương ứng. Nhật ký/thông báo cũ vẫn là lịch sử theo đơn vị lúc phát sinh, không tự chuyển thành điểm.

## Kiểm chứng chuyển sang điểm (trước khi gỡ chứng nhận)

- 205 kiểm thử backend và 8 kiểm thử bảo vệ môi trường chạy đạt; Django check, kiểm tra migration, frontend lint/build đạt.
- 8 ca trình duyệt đạt trên desktop/narrow: chấm/sửa điểm, lý do bắt buộc, phiên bản cũ, quyền riêng tư, tổng cá nhân, lịch sử, cấp/in/tra cứu chứng nhận, tự thu hồi khi đổi điểm và cấp lại.
- Kiểm tra giới hạn âm/lớn hơn 10/điểm lẻ, payload phút cũ, điểm 0 so với chưa chấm và tổng qua nhiều hoạt động vượt 10. Database chặn điểm ngoài phạm vi.
- Đã xem ảnh giao diện và kiểm tra không tràn ngang ở 320, 390, 768 và 1280px. Bốn PDF thử từ desktop/narrow đều rõ tiếng Việt, đúng điểm, mỗi mẫu một trang với dữ liệu kiểm thử: chứng nhận A4 ngang, tổng kết A4 dọc.
- Đã sao lưu MySQL và media vào `tmp/backups/snapshot-20261101-211942`, xác minh SHA-256, áp dụng hai migration. Bản ghi đóng góp/lịch sử giờ cũ đã được xóa; đăng ký và điểm danh còn để chấm lại. Kiểm thử dùng database riêng và dọn sau khi chạy.
