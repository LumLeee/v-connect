# Giao diện quản trị viên

Cập nhật ngày 09/11/2026. Phạm vi gồm bốn đợt: khung quản trị/Tổng quan/Tài khoản; Hoạt động/Kết quả/Kiểm duyệt phản hồi; Báo cáo/Chi tiết đăng ký/Tổng kết AI/Bảng xếp hạng; Nhật ký/Thông báo/Hồ sơ. Các thay đổi giao diện admin nằm trong workspace local; tài liệu không xác nhận đã commit hoặc đẩy lên GitHub.

## Khung quản trị

- Giữ bảy mục menu chính, chuông thông báo và ô tài khoản dẫn tới hồ sơ. Thu gọn phần trang trí và khoảng cách, thống nhất trạng thái chọn, cỡ chữ, nút và viền focus.
- Menu đóng/mở ở mọi kích thước. Trên máy tính ghi nhớ lựa chọn theo tài khoản; trên màn hình nhỏ dùng menu phủ, đóng bằng Escape, nút đóng hoặc vùng bên ngoài và trả focus về nút mở.
- CSS dùng phạm vi admin, không thay bố cục riêng của Nhà tổ chức hoặc Tình nguyện viên.

## Tổng quan `/quan-tri`

Tiêu đề Tổng quan thay khối lời chào dài, username và liên kết chỉnh sửa hồ sơ lặp. Nút Xem báo cáo và Làm mới nằm trên thanh đầu trang; Làm mới ở bên phải và bị vô hiệu hóa khi đang tải.

Bốn thẻ lấy số liệu toàn hệ thống từ `/reports/overview/`, không tính từ danh sách phân trang:

| Thẻ | Đích đến |
| --- | --- |
| Tổng tài khoản | Danh sách tài khoản |
| Tài khoản bị khóa | Tài khoản với `status=locked` |
| Hoạt động công khai | Hoạt động với `status=published` |
| Lượt tham gia hoàn thành | Chi tiết đăng ký với `metric=attended_completed` |

Trạng thái hoạt động hiển thị số trực tiếp, nhấn dòng mở danh sách tương ứng. Các lối tắt Tài khoản hệ thống, Kiểm duyệt phản hồi và Lịch sử thao tác được trình bày thành hàng gọn. Khi lỗi hoặc tải lại, không giữ số liệu cũ như kết quả mới; giá trị 0 vẫn hiển thị rõ.

## Tài khoản hệ thống `/quan-tri/tai-khoan`

- Bộ lọc họ tên/email/username, vai trò và trạng thái; có Áp dụng, Xóa bộ lọc và bỏ từng điều kiện. URL giữ phạm vi, phân trang và khôi phục đúng các ô khi quay lại/tiến tới.
- Số kết quả lấy từ `data.count` của API theo bộ lọc hiện tại.
- Máy tính hiển thị theo các cột Tài khoản, Vai trò, Trạng thái, Ngày tham gia, Thao tác; màn hình nhỏ chuyển thành thẻ. Email/username và ngày tham gia được hiển thị ngay trên dòng.
- Nhấn dòng, Enter hoặc Space mở chi tiết. Nút Khóa/Mở khóa đặt riêng; thao tác này không đồng thời mở chi tiết. Admin được đánh dấu Được bảo vệ và không có nút đổi trạng thái.
- Hộp xác nhận ghi rõ tài khoản và hành động, bắt buộc lý do có nội dung. Lỗi giữ lý do để thử lại; khi đang gửi chặn gửi lặp và đóng hộp thoại. Thành công giữ các bộ lọc, quay về trang đầu rồi tải dữ liệu mới.

Các chức năng sử dụng API hiện có, gồm trường `date_joined`; không thêm backend hoặc migration. Quyền quản trị, CSRF, bảo vệ tài khoản và vô hiệu hóa phiên đăng nhập vẫn được backend kiểm tra.

## Kiểm chứng đợt 1

Ngày 09/11/2026: 26 lượt kiểm thử trình duyệt khác nhau đạt trên hai cấu hình desktop và màn hình hẹp. Gồm 6 lượt Tổng quan, 10 lượt Tài khoản, 4 lượt luồng tích hợp mới, 4 lượt khung quản trị và 2 lượt kiểm tra khóa/mở khóa có sẵn.

- Đã kiểm tra bố cục từ 320px đến 1440px, nút Làm mới bên phải, menu, thao tác bàn phím, khôi phục focus và ảnh chụp desktop/điện thoại.
- Luồng tích hợp dùng API và MySQL riêng: số liệu thực, bộ lọc, khóa/mở khóa, lý do trong nhật ký, chặn tài khoản bị khóa và phiên cũ không tự hoạt động lại sau khi mở khóa. Dữ liệu ứng dụng hiện tại không bị thay đổi bởi kiểm thử.
- Kiểm tra điều hướng và không tràn ngang trên 11 trang dùng khung admin; nội dung chuyên biệt ngoài phạm vi vẫn để các đợt sau.
- `npm.cmd run lint`, `npm.cmd run build` và `git diff --check` đạt. Build còn cảnh báo kích thước bundle JavaScript hơn 500 kB của ứng dụng hiện tại.

Lượt chạy đầu có 3 lỗi trong mã kiểm thử Tổng quan: đếm request phụ thuộc StrictMode và chọn nhầm vùng nội dung khi đang chuyển trang. Sau khi sửa kiểm thử, toàn bộ 6 lượt Tổng quan và 2 lượt khóa/mở khóa được chạy lại và đạt. Bằng chứng local: `tmp/e2e-fae836c536fb/screenshots`, `tmp/e2e-b623beeb9b06/screenshots`; log trong `tmp/mysql-admin-stage1-c639456113b2/tests.log` và `tmp/mysql-admin-stage1-b50991fbfc75/tests.log`.

## Đợt 2: Hoạt động toàn hệ thống `/bao-cao/hoat-dong`

- Tìm theo tên, lọc trạng thái, Áp dụng/Xóa bộ lọc và bỏ từng điều kiện. Các ô đồng bộ với URL khi quay lại/tiến tới; đổi bộ lọc về trang đầu, phân trang giữ bộ lọc.
- Tổng số lấy từ `count` của API theo toàn bộ phạm vi đã lọc. Không dùng số dòng của trang đang mở làm tổng hoặc tạo thống kê giả.
- Dòng ngang trên máy tính, thẻ trên điện thoại: tên hoạt động, nhà tổ chức, trạng thái, bắt đầu/kết thúc, số người được duyệt và cần tuyển. Nhấn dòng hoặc Enter mở kết quả; không thêm nút chức năng trùng.
- Làm mới ở bên phải, chặn thao tác khi đang tải; có lỗi/thử lại, danh sách trống và trường hợp trang hiện tại không còn dữ liệu.

## Đợt 2: Kết quả hoạt động `/bao-cao/hoat-dong/<id>`

Hiển thị tên, nhà tổ chức, trạng thái, thời gian và địa điểm riêng biệt. Các thẻ số liệu chính và nhóm đăng ký/điểm danh lấy trực tiếp từ API kết quả; nhấn số liệu mở danh sách tương ứng với đúng mã hoạt động.

Phản hồi hiển thị số hợp lệ và điểm trung bình, loại phản hồi đã ẩn. Liên kết Kiểm duyệt phản hồi mở đúng hoạt động với trạng thái Chưa ẩn. Báo cáo tổng kết và bản nháp AI chỉ mở khi Hoàn thành và đã kết thúc theo cấu hình thời gian hiện tại; khi bỏ kiểm tra thời gian, cờ `time_checks_disabled` được tôn trọng. Liên kết hoạt động công khai chỉ xuất hiện khi trạng thái Công khai. Không thêm thao tác sửa hoặc duyệt hoạt động cho admin.

## Đợt 2: Kiểm duyệt phản hồi `/quan-tri/phan-hoi`

- Các bộ lọc Tất cả/Chưa ẩn/Đã ẩn và hoạt động giữ trong URL, giữ phạm vi qua phân trang và sau khi xử lý. Có thể bỏ riêng bộ lọc hoạt động để trở về phạm vi toàn hệ thống.
- Dòng hiển thị người gửi, hoạt động, điểm /5, nội dung trích, thời gian và trạng thái. Nhấn dòng, Enter hoặc Space đọc toàn bộ; phản hồi đã ẩn có lý do, người xử lý và thời điểm. Không có chức năng mở lại phản hồi vì API chưa hỗ trợ.
- Nút Ẩn phản hồi tách khỏi thao tác mở dòng. Xác nhận bắt buộc lý do có nội dung, gửi lý do đã bỏ khoảng trắng đầu/cuối; chặn gửi trùng và đóng hộp thoại khi đang lưu. Lỗi giữ lý do để thử lại; thành công tải trang đầu, giữ bộ lọc và xóa kết quả AI cũ.
- Phân tích AI vẫn do admin chủ động yêu cầu, dùng đúng bộ lọc trạng thái và hoạt động trên mọi trang trong phạm vi đó. AI không tự ẩn phản hồi. Các lựa chọn, bản phân tích và số liệu không chuyển sang toàn hệ thống khi bộ lọc hoạt động không hợp lệ.

Đợt 2 thêm tham số UUID `activity` tùy chọn cho `GET /api/v1/admin/feedback/` và `POST /api/v1/admin/feedback/ai-analysis/`. Hai endpoint dùng chung bộ lọc đã kiểm tra; mã sai trả 400, mã không tồn tại trả 404, không bỏ lọc ngầm. Không thay quyền truy cập, CSRF, giới hạn AI hoặc quy tắc ẩn/ghi nhật ký; không thêm bảng hay migration. Giao diện Nhà tổ chức/Tình nguyện viên được giữ bằng nhánh theo vai trò trong các trang dùng chung.

## Kiểm chứng đợt 2

Ngày 09/11/2026: 124 kiểm thử backend của `apps.feedback` và `apps.reports` đạt, gồm bốn kiểm thử mới cho bộ lọc hoạt động, phân quyền, kiểm tra dữ liệu đầu vào và phạm vi AI. `manage.py check` và kiểm tra không phát sinh migration đạt.

48 lượt kiểm thử trình duyệt đạt trên desktop và màn hình hẹp: 6 lượt danh sách hoạt động, 6 lượt kết quả, 10 lượt kiểm duyệt phản hồi, 4 lượt tích hợp API thật; thêm 4 lượt khung admin, 6 lượt Tổng quan và 12 lượt phản hồi/bản nháp AI để kiểm tra tương thích.

Đã xem ảnh máy tính/điện thoại, kiểm tra không tràn ngang từ 320px đến 1440px, lọc/phân trang/quay lại, điều hướng bàn phím, khôi phục focus, điều kiện mở tổng kết và thao tác con không kích hoạt mở dòng. Luồng thật kiểm tra ẩn phản hồi, lý do đã bỏ khoảng trắng đầu/cuối, nhật ký, số lượt/điểm trung bình, nguồn AI thay đổi và quyền Nhà tổ chức/Tình nguyện viên. Bộ kiểm thử này tắt inference thật để kiểm tra phạm vi và dự phòng; không dùng nó để khẳng định chất lượng mô hình.

`npm.cmd run lint`, `npm.cmd run build` và `git diff --check` đạt; build còn cảnh báo bundle JavaScript hơn 500 kB. Toàn bộ kiểm thử dùng MySQL riêng và dữ liệu tạm, đã dọn tiến trình/database sau khi chạy. Dịch vụ MySQL80 và database ứng dụng được giữ nguyên. Bằng chứng local: `tmp/e2e-019b7149579d/screenshots`; log backend `tmp/mysql-admin-stage2-bfb798b070d9/checks.log`, log trình duyệt `tmp/mysql-admin-stage2-b9125b75069b/checks.log`.

## Đợt 3: Báo cáo và đối chiếu số liệu

- `/bao-cao` và `/bao-cao/mo-rong`: ba chế độ Tổng hợp/Theo hoạt động/Biểu đồ dùng chung dữ liệu analytics; lọc theo tên, trạng thái, khoảng ngày bắt đầu và nhà tổ chức. URL giữ bộ lọc, chế độ và trang, đồng bộ lại khi quay lại/tiến tới. Có bỏ từng điều kiện, xuất Excel và in/lưu PDF. Tổng số lấy từ toàn bộ kết quả API, không từ trang đang mở. Bản in chứa toàn bộ kết quả đang xem, Excel lấy dữ liệu mới theo cùng năm bộ lọc; không gửi chế độ/trang vào phạm vi xuất. Mỗi báo cáo giữ giới hạn 2.000 hoạt động của API.
- `/bao-cao/dang-ky`: đối chiếu từng chỉ số và hoạt động; giữ phạm vi khi đổi chỉ số hoặc phân trang. Dòng hiển thị tình nguyện viên, hoạt động, trạng thái đơn, ngày đăng ký và thời gian điểm danh; nhấn dòng hoặc Enter đọc chi tiết và mở kết quả đúng hoạt động. Xóa bộ lọc bỏ cả chỉ số và phạm vi hoạt động; có thể bỏ riêng phạm vi. Admin không được gán thêm thao tác duyệt đăng ký của Nhà tổ chức.
- `/bao-cao/hoat-dong/<id>/tong-ket`: báo cáo số liệu gốc đứng trước, bản nháp AI ở phần riêng có liên kết đi tới. Có nút trở về Kết quả hoạt động cùng thanh công cụ. AI vẫn do người dùng chủ động yêu cầu, sửa/sao chép riêng; không tự lưu hoặc xuất bản. Nguồn thay đổi chặn sao chép bản cũ; lỗi tạo lại giữ nội dung đã chỉnh sửa. Bản in chỉ chứa báo cáo gốc và ngày giờ tuyệt đối, không in phần nháp AI.
- `/bang-xep-hang`: bảng admin theo hạng, tên, tổng điểm và cấp bậc; giữ đồng hạng từ API, tối đa 20 người. Không có khối tiến độ cá nhân hoặc liên kết riêng của Tình nguyện viên; quy tắc cấp bậc thu gọn. Không hiển thị email, điện thoại hoặc hồ sơ riêng tư.

## Đợt 4: Nhật ký, thông báo và hồ sơ

- `/quan-tri/nhat-ky` và chi tiết: tìm theo người, hoạt động, loại thao tác, khoảng ngày và mã định danh; giữ bộ lọc khi mở chi tiết/quay lại. Dữ liệu trước–sau được trình bày theo kiểu giá trị thực đã lưu, không dựng lại lịch sử từ dữ liệu hiện tại. Nhật ký chỉ đọc.
- `/thong-bao`: bộ lọc Tất cả/Chưa đọc/Đã đọc có tổng số từ API, phân trang và nhóm theo ngày. Nhấn dòng hoặc Enter mở liên kết nội bộ hợp lệ; thông báo chưa đọc được đánh dấu thành công trước khi điều hướng. Nút đánh dấu riêng không đồng thời mở dòng. Đánh dấu tất cả tác động đến hộp thư của chính tài khoản, không phải toàn hệ thống. Tùy chọn email thu gọn, có hoàn tác giá trị nếu lưu lỗi; tài khoản chưa có email được giải thích rõ.
- `/ho-so`: ảnh đại diện có chọn/dán/xóa gọn; ảnh được lưu riêng với thông tin hồ sơ. Username đăng nhập chỉ đọc; form chỉ gửi họ tên, điện thoại và giới thiệu. Có trạng thái chưa lưu, Hoàn tác, Làm mới giữ bản đang sửa và xác nhận khi rời trang có thay đổi chưa lưu. Lưu thành công cập nhật tên trên khung tài khoản; lỗi giữ nội dung để sửa/thử lại và chặn gửi trùng.

Các biến thể dùng class hoặc nhánh render dành riêng cho admin để giữ giao diện các vai trò khác. Không thêm quyền quản trị, bảng dữ liệu hoặc migration cho các đợt còn lại.

## Kiểm chứng đợt 3 và 4

Ngày 09/11/2026: 100 lượt kiểm thử trình duyệt khác nhau đạt trên hai cấu hình desktop và màn hình hẹp, gồm giao diện mới, luồng API thật và kiểm tra tương thích. Các ca thất bại đã được sửa và chạy lại; số này không cộng các lượt chạy lặp.

- Báo cáo: bộ lọc/URL/quay lại/phân trang, số liệu khớp API, Excel đúng năm điều kiện, bản in chứa toàn bộ kết quả và trạng thái tải/lỗi/trống. Chi tiết đăng ký giữ phạm vi qua đổi chỉ số và phân trang, mở dòng bằng bàn phím, đóng hộp thoại trả focus.
- Tổng kết: đối chiếu số liệu thật, fingerprint nguồn AI, giữ nội dung đã sửa khi làm mới hoặc tạo lại lỗi, chặn sao chép khi nguồn cũ, bản in chỉ chứa báo cáo gốc. Kiểm thử tắt inference thật, xác nhận luồng dự phòng và phạm vi dữ liệu; không đánh giá độ chính xác mô hình.
- Nhật ký: bộ lọc kết hợp, lý do từ thao tác thật, so sánh trước–sau có kiểu, dữ liệu cũ thiếu ảnh chụp, giữ điều kiện khi trở về, chặn khoảng ngày sai ở form và API. Xếp hạng đối chiếu điểm đóng góp thật, đồng hạng và không lộ thông tin liên hệ.
- Thông báo/hồ sơ: phân trang/trạng thái đọc, thao tác con độc lập, liên kết nội bộ, chặn gửi lặp, lỗi/thử lại và tùy chọn email được lưu; hồ sơ giữ bản sửa, hoàn tác, cảnh báo rời trang, lưu đúng payload và avatar lưu riêng. Kiểm tra hồi quy hồ sơ/thông báo/AI của Nhà tổ chức và Tình nguyện viên cũng đạt.
- Đã xem ảnh desktop/điện thoại và kiểm tra không tràn ngang từ 320px đến 1440px. Sửa nhãn truy cập của các ô chọn và ẩn legend phụ ở bộ lọc báo cáo; các lỗi còn lại khi chạy đầu thuộc bộ chọn test, kỳ vọng kiểm tra ngày cũ hoặc dùng nhầm ID đăng ký thay cho ID điểm danh trong fixture.
- `npm.cmd run lint`, `npm.cmd run build`, `git diff --check`, `manage.py check` và kiểm tra không phát sinh migration đạt. Build còn cảnh báo bundle JavaScript 650,82 kB lớn hơn 500 kB; không có lỗi build.

Kiểm thử dùng MySQL và database riêng; các tiến trình và thư mục dữ liệu tạm đã dọn sau khi chạy. Dịch vụ MySQL80 và database ứng dụng được giữ nguyên. Bằng chứng local: `tmp/e2e-9f007c458f88/screenshots`, `tmp/e2e-2f784ab68717/screenshots`, `tmp/e2e-6c2a11262dab/screenshots`, `tmp/e2e-6b598bf4eccb/screenshots`. Log tương ứng: `tmp/mysql-admin-remaining-a841eec795dd/checks.log`, `tmp/mysql-admin-remaining-0cdb774943e3/checks.log`, `tmp/mysql-admin-remaining-53acc432b46d/checks.log`, `tmp/mysql-admin-remaining-33bee7530104/checks.log`.
