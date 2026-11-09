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
| Phản hồi hoạt động | Truy cập từ Lịch sử; chỉ gửi khi đủ điều kiện. Chọn 1–5 sao, nhập nội dung và xem lại phản hồi đã gửi. Không có mục menu riêng. |
| Hồ sơ | Ảnh đại diện, thông tin cơ bản, kỹ năng, sở thích và lịch rảnh được trình bày trong các khối nhất quán. |
| Thông báo | Danh sách thông báo và tùy chọn email trong khung chung. |
| Đóng góp của tôi | Điểm theo hoạt động, lịch sử điều chỉnh và thống kê tham gia được gộp trong một trang. |

Trang chủ, giới thiệu, đăng nhập và đăng ký vẫn dùng khung công khai. Khách chưa đăng nhập vẫn xem hoạt động với giao diện công khai. Giao diện Nhà tổ chức và Admin được giới hạn riêng theo vai trò.

## Đường dẫn mới

- `/tinh-nguyen-vien/check-in`: chọn hoạt động để check-in.
- `/tinh-nguyen-vien/phan-hoi`: chọn hoạt động để gửi hoặc xem phản hồi.

Danh sách chọn điểm danh dùng các đơn đăng ký hiện có; nút check-in chỉ xuất hiện trên đơn phù hợp. Danh sách chọn đánh giá dùng lịch sử có mặt, ghi rõ các hoạt động chưa thể gửi phản hồi. Không tự động ghi nhận điểm danh hay gửi phản hồi khi mở trang.

Các thẻ thống kê sử dụng API báo cáo hiện có, tính toàn bộ dữ liệu của tài khoản; danh sách bên dưới được phân trang trên máy chủ. Không tính số liệu từ riêng trang đang xem.

## Tổ chức mã nguồn

- `layouts/VolunteerLayout.jsx`: khung chung, điều hướng theo đường dẫn, avatar và đăng xuất.
- `layouts/SiteLayout.jsx`: chọn khung theo vai trò và đường dẫn.
- `pages/VolunteerParticipations.jsx`: các danh sách đăng ký, điểm danh và lịch sử tham gia.
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

---

## Cập nhật giao diện ngày 05/11/2026

### Đợt 1 — Menu, Tổng quan, Đăng ký và Lời mời

Ngày thực hiện: 05/11/2026.

- Menu máy tính lưu trạng thái đóng/mở riêng theo tài khoản. Menu điện thoại vẫn mở dạng hộp thoại, hỗ trợ Escape, quản lý focus và tự đóng khi chuyển trang.
- Tổng quan thu gọn hồ sơ, bỏ các lối tắt và nội dung giới thiệu lặp. Ưu tiên lời mời chờ phản hồi, đơn chờ duyệt, hoạt động đang mở điểm danh và lượt tham gia hoàn thành. Ô số liệu dẫn tới trang chức năng tương ứng.
- Hoạt động đang mở điểm danh xuất hiện trước hoạt động sắp tới; có nút điểm danh trực tiếp. Lịch sử gần đây giữ thông tin xác nhận có mặt và trạng thái hoạt động.
- Đăng ký có tìm theo tên hoạt động và lọc Tất cả/Chờ duyệt/Được duyệt/Từ chối/Đã hủy đăng ký. Giữ trạng thái đơn, thời gian gửi/xét duyệt và cảnh báo thay đổi lịch. Hủy đăng ký vẫn tuân thủ điều kiện nghiệp vụ và có xác nhận.
- Lời mời có tìm theo hoạt động hoặc nhà tổ chức và lọc Tất cả/Chờ phản hồi/Đã chấp nhận/Đã từ chối/Đã thu hồi. Thu gọn lời nhắn dài; giải thích trường hợp không thể chấp nhận. Nhấn dòng vẫn mở hoạt động.
- Tìm kiếm, trạng thái và trang được lưu trong URL. Sau khi xử lý ở trang sau, về trang đầu nhưng giữ tìm kiếm và trạng thái.
- Nút Làm mới nằm bên phải. Bố cục đáp ứng màn hình máy tính và điện thoại.

#### API

- `GET /api/v1/participations/?status=...&search=...`: tìm kiếm trước khi tính `summary`, sau đó lọc trạng thái và phân trang. Hai danh sách điểm danh/lịch sử giữ hợp đồng hiện có.
- `GET /api/v1/invitations/?status=...&search=...`: tính `summary` trên kết quả tìm kiếm trước lọc trạng thái và phân trang; chỉ truy vấn lời mời của tài khoản hiện tại.
- `GET /api/v1/reports/volunteer-dashboard/`: thêm `summary.pending_registrations`, `summary.pending_invitations`, `checkin_now_count`, `checkin_now` (tối đa 3 mục). Điểm danh yêu cầu đơn được duyệt, hoạt động công khai, chưa có mặt và tuân thủ chính sách kiểm tra thời gian của dự án.
- Không có migration hoặc phụ thuộc mới.

#### Kiểm tra

- 91 kiểm thử backend: toàn bộ `apps.participations` và `apps.reports.tests.test_dashboard`; chạy bằng MySQL tạm, không sử dụng dữ liệu dự án.
- 26 kiểm thử trình duyệt mô phỏng API đều đạt: `volunteer-dashboard-ui.spec.js`, `volunteer-registration-ui.spec.js`, `volunteer-invitations-ui.spec.js` và kiểm tra hồi quy `organizer-invitations-ui.spec.js`, `volunteer-modes.spec.js`.
- ESLint và bản build production.

### Đợt 2 — Khám phá, Chi tiết và Gợi ý phù hợp

Ngày thực hiện: 05/11/2026.

- Khám phá có thời gian bắt đầu, tag kỹ năng, số chỗ còn lại và số người được duyệt trên từng thẻ. Nhấn cả thẻ để mở hoạt động. Bộ lọc đang áp dụng hiển thị thành nhãn có thể bỏ từng điều kiện; tìm kiếm và phân trang giữ trạng thái trong URL. Kiểm tra khoảng ngày trước khi gửi và giữ kỹ năng đã chọn khi danh mục tải lỗi.
- Chi tiết chỉ hiển thị nhà tổ chức một lần; thời gian, địa điểm và số lượng nằm trong một cụm thông tin. Số đã duyệt, cần tuyển và còn lại hiển thị trực tiếp. Trên điện thoại, panel tham gia nằm trước phần thông tin dài. Hành động chính thay đổi theo trạng thái đơn; chỉ mở check-in trong khung giờ hoặc chế độ thử nghiệm, và không hiển thị hủy sau khi đã có mặt.
- Gợi ý có phần mở/đóng “Vì sao được gợi ý?” với lý do và điểm từng tiêu chí do API trả về. Kỹ năng khớp hồ sơ có nhãn và dấu tích, tách khỏi kỹ năng khác của hoạt động. Nút Xem chi tiết dẫn đến hoạt động và nằm bên trái trên điện thoại.
- Thời gian cùng ngày tiếp tục dùng định dạng tương đối. Bản xem trước của nhà tổ chức tiếp tục chỉ đọc và không gọi API đăng ký.
- Danh sách công khai được sắp xếp ổn định theo thời gian bắt đầu rồi mã hoạt động trước phân trang. Không có migration, phụ thuộc hoặc thuật toán ghép nối mới.

#### Kiểm tra đợt 2

- 44 lượt kiểm thử trình duyệt trên desktop/narrow đều đạt: 38 lượt mô phỏng giao diện và bản xem trước, 6 lượt với React/Django/MySQL thật.
- Luồng dữ liệu thật kiểm tra Khám phá → Gợi ý → Chi tiết → đăng ký → được duyệt → hủy, đồng bộ số chỗ và loại hoạt động đã đăng ký khỏi gợi ý. Có kiểm tra điều kiện đủ chỗ, thời gian và quyền xuất hiện trong gợi ý của nhà tổ chức.
- 3 kiểm thử `apps.activities.tests.test_discovery` đạt, gồm thứ tự ổn định qua nhiều trang và trường hợp trùng giờ bắt đầu.
- ESLint và bản build production đạt; đã xem ảnh máy tính và điện thoại, kiểm tra không tràn ngang ở 320–1440 px.
- MySQL và các schema dùng kiểm thử được tạo riêng rồi xóa sau khi chạy; không thay đổi dữ liệu dự án.

### Đợt 3 — Điểm danh, Lịch sử và Gửi phản hồi

Hoàn tất kiểm tra ngày 08/11/2026.

- Điểm danh có các bộ lọc Tất cả/Đang mở/Chưa đến giờ/Đã điểm danh/Đã hết giờ, tìm hoạt động và phân trang giữ URL. Mỗi dòng hiển thị khung giờ và thời gian có mặt; chỉ cho check-in khi đủ điều kiện. Danh sách và số đếm tự tải lại ở mốc bắt đầu/kết thúc, kể cả khi bộ lọc đang trống hoặc hoạt động nằm ngoài trang hiện tại.
- Trang check-in tách Quét QR và Nhập mã, hỗ trợ bàn phím, camera, chọn/dán ảnh và mã tám chữ số. Người dùng xác nhận thủ công sau khi nhận QR. Kết quả có thời gian, người xác nhận và hình thức điểm danh; giữ bằng chứng sau khi làm mới hoặc hoạt động bị hủy.
- Lịch sử tìm theo tên hoạt động, lọc khoảng ngày điểm danh và phản hồi Chưa gửi/Đã gửi. Giữ rõ điểm 0, chưa chấm điểm, lượt có mặt của hoạt động đã hủy và thời gian xác nhận. Ngày lọc tính theo ngày tại Việt Nam; lỗi ngày ngược được kiểm tra trước khi gửi và xóa khi quay lại URL hợp lệ.
- Gửi phản hồi dùng lựa chọn 1–5 sao bằng radio, kiểm tra nội dung và số ký tự. Giữ bản nháp khi lỗi mạng/làm mới, cảnh báo trước khi rời trang hoặc đăng xuất. Khi mất phản hồi sau khi gửi, kiểm tra lại kết quả để tránh gửi trùng; bản đã gửi chỉ đọc, gồm lý do bị ẩn nếu có.
- API `/participations/check-in/` tính summary trước trạng thái/phân trang và trả `next_transition_at` trên toàn kết quả tìm kiếm. Mốc kết thúc vẫn cho phép điểm danh đúng thời điểm đó. API `/participations/history/` hỗ trợ `search`, `date_from`, `date_to`, `feedback`; summary tính trước lọc phản hồi/phân trang. Không có migration hoặc phụ thuộc mới.

#### Kiểm tra đợt 3

- 58 lượt kiểm thử trình duyệt desktop/narrow đạt qua các lần chạy và chạy lại mục lỗi sau khi sửa: 40 lượt kiểm tra giao diện mới, 10 lượt hồi quy danh sách đăng ký/chế độ trang và 8 lượt luồng QR/phản hồi với React/Django/MySQL thật.
- Kiểm tra QR thật từ ảnh và video mô phỏng, mã hết hạn/thay thế/thu hồi, thời điểm kết thúc, trạng thái rỗng khi hoạt động đến giờ, bộ lọc/phân trang, lỗi mạng và giữ bản nháp.
- Đã xem ảnh máy tính/điện thoại và kiểm tra không tràn ngang ở 320–1440 px. Database và MySQL kiểm thử được tạo riêng rồi dọn sau mỗi lần chạy.

### Đợt 4 — Đóng góp, Bảng xếp hạng, Hồ sơ và Thông báo

Ngày thực hiện: 08/11/2026.

- Đóng góp có tìm hoạt động, bộ lọc Tất cả/Chờ chấm/Đã chấm và phân trang giữ URL. Tổng điểm, số hoạt động đã/chưa chấm tính trên kết quả tìm kiếm trước trạng thái/phân trang. Điểm 0 vẫn là đã chấm. Lịch sử điều chỉnh hiển thị riêng; thống kê tham gia tiếp tục gộp tại trang này và được thu gọn sau danh sách.
- Bảng xếp hạng làm rõ điểm, thứ hạng và cấp bậc cá nhân; các cột thống nhất với dòng dữ liệu và đánh dấu bản thân. Giữ nguyên đồng hạng, giới hạn 20 người và thông tin riêng tư. Quy tắc điểm/cấp bậc nằm trong phần mở rộng.
- Hồ sơ chia rõ ảnh đại diện, thông tin cơ bản, kỹ năng/sở thích và lịch rảnh. Có theo dõi thay đổi, hoàn tác, cảnh báo rời trang và giữ bản nháp khi tải lại hoặc lưu lỗi. Chọn/dán ảnh lưu riêng với thông tin hồ sơ. Hồ sơ ứng viên tiếp tục chỉ đọc và ẩn trường trống/kỹ năng chưa chọn.
- Kiểm tra phiên khi cửa sổ được focus giữ tài khoản/bản nháp trong lỗi mạng hoặc máy chủ tạm thời. Phiên hết hạn thật vẫn chuyển về đăng nhập; đổi tài khoản vẫn xóa bản nháp của tài khoản cũ.
- Thông báo lọc Tất cả/Chưa đọc/Đã đọc với số đếm toàn bộ tài khoản, phân trang giữ trạng thái và hồi phục khi trang vượt giới hạn. Giữ trạng thái khi đánh dấu lỗi, không gửi lại yêu cầu đọc khi mở mục đã đọc. Tùy chọn email thu gọn; lỗi lưu khôi phục lựa chọn trước đó.
- API `/contributions/` hỗ trợ `search` và `status=all|pending|confirmed`; `/notifications/` thêm `summary={total,unread,read}` trước lọc/phân trang. Giữ phân quyền và dữ liệu của từng tài khoản; không có migration hoặc phụ thuộc mới.
- Thông báo hủy dẫn tới các đăng ký đã hủy. Thông báo cũ dẫn trang công khai của hoạt động đã Hoàn thành/Đã hủy được chuyển tới đăng ký cá nhân khi trả API, không cần sửa bản ghi đã lưu.

#### Kiểm tra đợt 4 và các API liên quan

- 64 lượt kiểm thử trình duyệt desktop/narrow đạt qua các lần chạy và chạy lại mục lỗi sau khi sửa: 30 lượt giao diện/giữ phiên mới, 10 lượt hồi quy giao diện nhà tổ chức và 24 lượt nghiệp vụ thật/hồi quy không gian tình nguyện viên.
- Kiểm tra điểm 0/chưa chấm, tổng trước phân trang, lịch sử điều chỉnh, đồng hạng và tài khoản ngoài 20 hàng dù mang hạng nhỏ; lưu hồ sơ/avatar/lịch rảnh, thông báo hủy, đánh dấu đọc/email, lỗi mạng và phục hồi phiên. Có kiểm tra đổi tài khoản và 401 để không giữ dữ liệu của người trước.
- 155 kiểm thử backend liên quan đợt 3–4 đạt: toàn bộ participation/feedback, hồ sơ cơ bản/mở rộng, bảng xếp hạng và thông báo. Chạy bằng các MySQL/schema tạm riêng, không sửa dữ liệu dự án.
- ESLint, build production và `git diff --check` đạt. Build còn cảnh báo kích thước bundle trên 500 kB như trước.
- Đã xem ảnh máy tính/điện thoại, kiểm tra không tràn ngang ở 320–1440 px; dọn MySQL/database và các tiến trình server kiểm thử sau khi chạy.

Phản hồi tiếp tục truy cập từ Lịch sử; thống kê tiếp tục nằm trong Đóng góp của tôi.
