# Ghép nối theo quy tắc hai chiều

Ngày triển khai: 09/10/2026. Chức năng gợi ý hỗ trợ lựa chọn; không tự đăng ký, gửi lời mời hoặc xét duyệt. Đây là cách tính theo quy tắc, chưa sử dụng AI.

## Sử dụng

- Tình nguyện viên mở **Gợi ý phù hợp** để xem hoạt động, điểm và lý do; chọn **Xem hoạt động để đăng ký** để tiếp tục quy trình đăng ký hiện có.
- Nhà tổ chức mở **Ghép nối tình nguyện viên**, chọn hoạt động rồi **Xem người phù hợp**. Chỉ chủ hoạt động có quyền xem danh sách này.
- Trong hồ sơ mở rộng, Tình nguyện viên bật **Cho phép Nhà tổ chức tìm thấy tôi trong gợi ý** rồi lưu. Mặc định tắt, có thể thu hồi bất cứ lúc nào. Tắt tùy chọn không ảnh hưởng việc nhận gợi ý hoạt động cho chính mình.

## Điểm và điều kiện

Điểm tối đa 100, không phải xác suất được duyệt:

| Tiêu chí | Cách tính |
| --- | --- |
| Kỹ năng | 50 × số kỹ năng trùng / số kỹ năng hoạt động yêu cầu; không yêu cầu kỹ năng thì 0 điểm |
| Sở thích | 20 điểm nếu có ít nhất một cụm sở thích xuất hiện trong tên hoặc mô tả; không phân biệt hoa thường, dấu tiếng Việt và dấu câu |
| Lịch rảnh | 30 × tỷ lệ thời gian hoạt động được lịch rảnh bao phủ, theo giờ Việt Nam và lặp hằng tuần |

Thiếu dữ liệu cho tiêu chí nào thì tiêu chí đó nhận 0 điểm; không suy diễn người dùng không có khả năng tham gia. Không bắt buộc khớp tất cả kỹ năng. Chỉ đưa ra gợi ý có điểm lớn hơn 0, sắp xếp giảm dần theo điểm, phân trang. Giao diện giải thích từng thành phần và mức bao phủ lịch rảnh. Sở thích chỉ đối chiếu cụm từ, chưa hiểu từ đồng nghĩa hoặc ngữ nghĩa.

Chỉ xét hoạt động Công khai có thời điểm công khai, chưa bắt đầu, còn chỗ được duyệt và Nhà tổ chức đang hoạt động. Loại người đã có đơn Chờ duyệt/Được duyệt/Bị từ chối của hoạt động; đơn tự hủy được xét lại. Loại xung đột thời gian với hoạt động Công khai khác đã được duyệt. Hai hoạt động tiếp giáp giờ được chấp nhận. Đơn chờ duyệt ở hoạt động khác không chặn gợi ý.

## Quyền riêng tư và API

- `GET /api/v1/matching/activities/`: chỉ Tình nguyện viên, dựa trên hồ sơ của chính mình.
- `GET /api/v1/organizer/activities/<id>/matching/`: chỉ Nhà tổ chức sở hữu hoạt động; chỉ xét tài khoản Volunteer đang hoạt động và chủ động bật `matching_visible`.
- `PATCH /api/v1/auth/profile/` với `{"volunteer":{"matching_visible":true}}` để bật; dùng `false` để tắt. Việc cập nhật tuân theo session, CSRF và quyền sửa hồ sơ hiện có.
- Kết quả cho Nhà tổ chức chỉ gồm ID, họ tên, điểm, kỹ năng/sở thích trùng và tỷ lệ phù hợp lịch. Không trả email, số điện thoại, toàn bộ kỹ năng/sở thích hoặc các khung giờ rảnh.
- Tính lại từ dữ liệu hiện tại mỗi lần tải, trả `no-store`; tắt tùy chọn có hiệu lực ở lần tải tiếp theo. Dữ liệu đã được người xem nhìn thấy trước đó không thể thu hồi khỏi trí nhớ hoặc bản chụp của họ.

Migration `accounts.0006_volunteerprofile_matching_visible` bổ sung cờ mặc định `False`; giữ nguyên dữ liệu hồ sơ cũ. Chưa lưu lịch sử đề xuất, chưa gửi thông báo ghép nối. Khi dữ liệu tăng lớn cần đo thời gian xử lý để tối ưu việc chấm điểm toàn bộ tập ứng viên trước phân trang.

## Kiểm chứng

Kiểm thử backend bao gồm điểm, thiếu dữ liệu, ranh giới cụm từ, lịch qua ngày/nhiều tuần, xung đột, điều kiện hoạt động, trạng thái đăng ký, phân trang và quyền riêng tư. Kiểm thử trình duyệt kiểm tra lưu/thu hồi tùy chọn, gợi ý hai chiều, xử lý lỗi mạng và bố cục 320–1280px.

Kết quả ngày 09/10/2026: 172 kiểm thử backend, 8 kiểm thử bảo vệ runner, lint/build đều đạt. 12 ca Playwright của ghép nối, hồ sơ mở rộng, quản lý Nhà tổ chức và không gian Tình nguyện viên đạt trên desktop/narrow. Đã kiểm tra ảnh giao diện; đã sao lưu, xác minh checksum và áp dụng migration vào MySQL hiện có.
