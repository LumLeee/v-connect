# Ghép nối hai chiều bằng quy tắc và AI

Quy tắc hai chiều triển khai ngày 09/10/2026; bổ sung AI embedding local ngày 08/11/2026. Chức năng gợi ý hỗ trợ lựa chọn, không phải xác suất được duyệt. Đã bổ sung luồng [lời mời tham gia](LOI_MOI_THAM_GIA.md): Nhà tổ chức chủ động gửi, người nhận xác nhận hợp lệ sẽ được tự động duyệt đăng ký; việc xem gợi ý không tự gửi lời mời. Hướng dẫn cài model, công thức kết hợp và kết quả đánh giá: [AI ghép nối](AI_GHEP_NOI.md).

## Sử dụng

- Tình nguyện viên mở **Gợi ý phù hợp** để xem hoạt động, điểm và lý do; chọn **Xem hoạt động để đăng ký** để tiếp tục quy trình đăng ký hiện có.
- Nhà tổ chức mở **Ghép nối tình nguyện viên**, chọn hoạt động rồi **Xem người phù hợp**. Chỉ chủ hoạt động có quyền xem danh sách này.
- Trong hồ sơ mở rộng, Tình nguyện viên bật **Cho phép Nhà tổ chức tìm thấy tôi trong gợi ý** rồi lưu. Mặc định tắt, có thể thu hồi bất cứ lúc nào. Tắt tùy chọn không ảnh hưởng việc nhận gợi ý hoạt động cho chính mình.

## Điểm và điều kiện

Điểm tối đa 100, không phải xác suất được duyệt. Khi AI hoạt động, hệ thống giữ 70% điểm quy tắc và bổ sung tối đa 30 điểm ngữ nghĩa:

| Tiêu chí | AI hoạt động | Quy tắc khi AI tắt hoặc dự phòng |
| --- | --- | --- |
| Kỹ năng | Tối đa 35 | 50 × số kỹ năng trùng / số kỹ năng hoạt động yêu cầu; không yêu cầu kỹ năng thì 0 điểm |
| Sở thích trùng cụm từ | Tối đa 14 | 20 điểm nếu có ít nhất một cụm sở thích xuất hiện trong tên hoặc mô tả; không phân biệt hoa thường, dấu tiếng Việt và dấu câu |
| Lịch rảnh | Tối đa 21 | 30 × tỷ lệ thời gian hoạt động được lịch rảnh bao phủ, theo giờ Việt Nam và lặp hằng tuần |
| Ngữ nghĩa | Tối đa 30: `30 × max(0, (cosine - 0.35) / 0.65)` theo ngưỡng mặc định | Không dùng |

Thiếu dữ liệu cho tiêu chí nào thì tiêu chí đó nhận 0 điểm; không suy diễn người dùng không có khả năng tham gia. Không bắt buộc khớp tất cả kỹ năng. AI có thể bổ sung điểm cho cách diễn đạt tương đương giữa kỹ năng/sở thích và nội dung hoạt động, nhưng không đánh dấu kỹ năng suy diễn là kỹ năng đã khai báo. Hồ sơ không có kỹ năng và sở thích không được tạo điểm AI. Chỉ đưa ra gợi ý có điểm lớn hơn 0, sắp xếp giảm dần theo điểm rồi phân trang. Giao diện giải thích từng thành phần, mức bao phủ lịch rảnh và trạng thái AI. Khi model thiếu/lỗi/bận/quá hạn hoặc đầu vào vượt giới hạn, toàn response dùng lại công thức 50/20/30; không trộn thang điểm giữa các dòng.

Chỉ xét hoạt động Công khai có thời điểm công khai, chưa bắt đầu, còn chỗ được duyệt và Nhà tổ chức đang hoạt động. Loại người đã có đơn Chờ duyệt/Được duyệt/Bị từ chối của hoạt động; đơn tự hủy được xét lại. Loại xung đột thời gian với hoạt động Công khai khác đã được duyệt. Hai hoạt động tiếp giáp giờ được chấp nhận. Đơn chờ duyệt ở hoạt động khác không chặn gợi ý. Các kiểm tra mốc thời gian/xung đột tuân theo cờ `ACTIVITY_TIME_CHECKS_ENABLED` của dự án. Điều kiện hợp lệ được áp dụng trước khi chạy AI.

## Quyền riêng tư và API

- `GET /api/v1/matching/activities/`: chỉ Tình nguyện viên, dựa trên hồ sơ của chính mình.
- `GET /api/v1/organizer/activities/<id>/matching/`: chỉ Nhà tổ chức sở hữu hoạt động; chỉ xét tài khoản Volunteer đang hoạt động và chủ động bật `matching_visible`.
- `PATCH /api/v1/auth/profile/` với `{"volunteer":{"matching_visible":true}}` để bật; dùng `false` để tắt. Việc cập nhật tuân theo session, CSRF và quyền sửa hồ sơ hiện có.
- Kết quả cho Nhà tổ chức chỉ gồm ID, họ tên, điểm, kỹ năng/sở thích trùng và tỷ lệ phù hợp lịch. Không trả email, số điện thoại, toàn bộ kỹ năng/sở thích hoặc các khung giờ rảnh.
- Tính lại từ dữ liệu hiện tại mỗi lần tải, trả `no-store`; tắt tùy chọn có hiệu lực ở lần tải tiếp theo. Dữ liệu đã được người xem nhìn thấy trước đó không thể thu hồi khỏi trí nhớ hoặc bản chụp của họ.
- AI chỉ nhận kỹ năng/sở thích và tên/mô tả/kỹ năng yêu cầu của hoạt động; không đưa thông tin liên hệ, bio, địa chỉ hoặc lịch rảnh vào model. Inference chạy local, vector/văn bản có cache RAM giới hạn theo tiến trình. Model chỉ được tải qua lệnh chuẩn bị riêng. API trả trạng thái `active`, `fallback`, `disabled` hoặc `not_applicable`, model/revision khi đã áp dụng; không trả vector hay lỗi nội bộ.

Migration ban đầu `accounts.0006_volunteerprofile_matching_visible` bổ sung cờ mặc định `False`; giữ nguyên dữ liệu hồ sơ cũ. Tích hợp AI không cần migration mới. Chưa lưu lịch sử đề xuất hoặc gửi thông báo chỉ vì có gợi ý; lời mời có thông báo theo luồng riêng. Mặc định vượt 256 văn bản khác nhau sẽ dự phòng bằng quy tắc cho cả danh sách. Khi dữ liệu tăng lớn cần đo thời gian xử lý toàn bộ tập ứng viên trước phân trang.

## Kiểm chứng

Kiểm thử backend bao gồm điểm, thiếu dữ liệu, ranh giới cụm từ, lịch qua ngày/nhiều tuần, xung đột, điều kiện hoạt động, trạng thái đăng ký, phân trang và quyền riêng tư. Kiểm thử trình duyệt kiểm tra lưu/thu hồi tùy chọn, gợi ý hai chiều, xử lý lỗi mạng và bố cục 320–1280px.

Kết quả lịch sử ngày 09/10/2026 của bản quy tắc: 172 kiểm thử backend, 8 kiểm thử bảo vệ runner, lint/build đều đạt. 12 ca Playwright của ghép nối, hồ sơ mở rộng, quản lý Nhà tổ chức và không gian Tình nguyện viên đạt trên desktop/narrow. Đã kiểm tra ảnh giao diện; đã sao lưu, xác minh checksum và áp dụng migration vào MySQL hiện có.

Đợt AI ngày 08/11/2026: 61 kiểm thử backend liên quan đạt trên MySQL tạm và 6 kiểm thử công cụ đánh giá đạt. Mô hình thật xếp hoạt động dương cao hơn ở 19/20 cặp tổng hợp bằng điểm kết hợp, một cặp bằng điểm; kết quả này không đại diện độ chính xác toàn hệ thống. Xem bộ dữ liệu, kết quả từng ca và giới hạn trong [AI ghép nối](AI_GHEP_NOI.md).

Hoàn tất ngày 09/11/2026: 30 ca trình duyệt liên quan đạt trên desktop/narrow qua các lượt chạy, gồm luồng AI thật hai chiều và gửi/chấp nhận lời mời. Lint/build và kiểm tra dependency đạt. Model đã chuẩn bị và kiểm tra lại offline trên CPU.
