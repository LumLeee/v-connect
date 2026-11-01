# Lời mời tham gia hoạt động

## Phạm vi và cách sử dụng

Nhà tổ chức mở hoạt động → **Người phù hợp** → **Gửi lời mời**, nhập lời nhắn tùy chọn (tối đa 1.000 ký tự), xác nhận gửi. Chỉ gửi cho tài khoản Tình nguyện viên đang hoạt động và đã bật **Cho phép Nhà tổ chức tìm thấy tôi trong gợi ý**.

Người nhận mở **Lời mời của tôi** trong không gian Tình nguyện viên hoặc theo liên kết trong thông báo. Họ xem tên hoạt động, lịch/địa điểm hiện tại, người gửi, lời nhắn rồi chọn chấp nhận hoặc từ chối. Có bước xác nhận trước khi lưu phản hồi.

Nhà tổ chức xem lời mời đã gửi và phản hồi tại tab **Lời mời** của từng hoạt động; có thể thu hồi lời mời đang chờ. Chỉ chủ hoạt động quản lý được lời mời; Admin không thay Nhà tổ chức gửi hoặc phản hồi.

## Quy tắc nghiệp vụ

- Chỉ gửi cho hoạt động Công khai, đã công bố, chưa bắt đầu và còn chỗ.
- Lời mời đang chờ không tạo đơn đăng ký và không giữ chỗ. Hệ thống kiểm tra lại số người đã duyệt khi người nhận chấp nhận; nếu hết chỗ, giữ lời mời chờ, có thể thử lại khi có chỗ.
- Chấp nhận hợp lệ tạo đăng ký **Được duyệt** ngay; nếu đã có đơn Chờ duyệt hoặc đơn tự hủy, cập nhật đơn đó. Ghi người duyệt là người gửi lời mời, thời điểm duyệt là thời điểm xác nhận; nhật ký ghi rõ nguồn lời mời và người thực sự xác nhận.
- Không dùng lời mời để vượt quy tắc đơn đã bị từ chối, đơn bị hủy do hoạt động hoặc người đã được duyệt. Không tự đổi quyết định xét duyệt hiện có.
- Hạn chấp nhận là giờ bắt đầu hoạt động. Hoạt động hủy/hoàn thành, tài khoản Nhà tổ chức bị khóa hoặc hết chỗ đều chặn chấp nhận và hiển thị lý do.
- Lịch/địa điểm thay đổi sau khi gửi được cảnh báo; xác nhận dùng lịch hiện tại và lưu vào bản đăng ký. Lời mời hết hạn vẫn nằm trong lịch sử, có lý do không thể chấp nhận.
- Mỗi người chỉ có một lời mời cho mỗi hoạt động. Gửi lặp không tạo thêm hoặc gửi lại thông báo. Đã từ chối/thu hồi/chấp nhận không đổi phản hồi, không gửi lại cùng lời mời trong phạm vi này.
- Chấp nhận lặp không tạo thêm đơn hoặc duyệt lại đơn đã hủy sau đó. Muốn hủy tham gia dùng luồng hủy đăng ký hiện có.
- Tắt cho phép được gợi ý chặn lời mời mới; lời mời đã nhận vẫn có thể được người nhận chủ động xử lý.

## Thông báo, email và dữ liệu

Gửi lời mời, thu hồi và phản hồi tạo thông báo trong website cùng hàng đợi email theo tùy chọn nhận email hiện có. Chấp nhận còn thông báo đăng ký đã được tự động duyệt. Email được xử lý bằng công cụ `process_notifications` hiện có; không gửi đồng bộ trong yêu cầu web.

Lời mời không công khai email, điện thoại hoặc toàn bộ hồ sơ/lịch rảnh. Danh sách chỉ dành cho người nhận hoặc chủ hoạt động. Chấp nhận sẽ đưa người nhận vào danh sách đăng ký đã duyệt, áp dụng quyền xem người tham gia hiện có.

Mọi thay đổi lời mời, đăng ký, thông báo và nhật ký nằm trong cùng giao dịch. Khóa dòng hoạt động dùng chung với xét duyệt thủ công, hủy đăng ký và điều chỉnh sức chứa để không vượt số chỗ khi xác nhận đồng thời.

## API

- `GET /api/v1/invitations/`: lời mời của Tình nguyện viên hiện tại, phân trang.
- `POST /api/v1/invitations/<id>/respond/`: `{ "status": "accepted" }` hoặc `declined`.
- `GET /api/v1/organizer/activities/<id>/invitations/`: lời mời đã gửi của hoạt động, phân trang.
- `POST /api/v1/organizer/activities/<id>/invitations/`: `{ "volunteer": "UUID", "message": "Lời nhắn tùy chọn" }`.
- `POST /api/v1/organizer/activities/<id>/invitations/<invitation_id>/withdraw/`: `{}`.

Các thao tác POST yêu cầu đăng nhập đúng vai trò, đúng chủ thể và CSRF. Migration `participations.0005_invitation` tạo dữ liệu lời mời; `reports.0005_alter_auditevent_action` thêm loại nhật ký.

## Kiểm chứng ngày 01/11/2026

- 203 kiểm thử backend, 8 kiểm thử bảo vệ môi trường chạy, Django check, kiểm tra migration và frontend lint/build đều đạt.
- Sáu ca trình duyệt của lời mời và ghép nối trên desktop/narrow đã đạt. Lượt đầu có một ca desktop lỗi bộ chọn thông báo trùng với trạng thái tải; sau khi sửa bộ chọn, chạy lại riêng ca đó đạt.
- Kiểm tra gửi từ trang Người phù hợp, nhận lời mời, lỗi mạng/thử lại, chấp nhận và tự động duyệt, từ chối, thu hồi, tải lại giữ kết quả và hồi quy quyền được gợi ý.
- Đã kiểm tra ảnh giao diện Nhà tổ chức/Tình nguyện viên trên màn hình rộng và hẹp; kiểm tra không tràn ngang ở 320, 390, 768 và 1280px.
- Đã sao lưu, xác minh checksum và áp dụng hai migration vào MySQL80. Kiểm thử dùng database riêng, được dọn sau khi hoàn tất; không tạo lời mời hoặc gửi email thật từ dữ liệu kiểm thử.
