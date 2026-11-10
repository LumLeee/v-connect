# Giao diện V-Connect

Tài liệu mô tả giao diện hiện tại của trang công khai và ba không gian Tình nguyện viên, Nhà tổ chức, Quản trị viên. Quy tắc nghiệp vụ nằm trong các tài liệu chuyên đề; tài liệu này tập trung vào nội dung hiển thị, điều hướng và cách tương tác.

## Khung và quy tắc dùng chung

- Các trang nội bộ dùng khung theo vai trò, có menu, thanh tài khoản và chuông thông báo. Ô tài khoản và ảnh đại diện dẫn tới `/ho-so`; không cần một mục chỉnh sửa hồ sơ lặp trong menu. Trang chủ, giới thiệu và xác thực dùng khung công khai. Django Admin tại `/admin/` là công cụ kỹ thuật riêng.
- Menu đóng/mở ở mọi kích thước. Máy tính ghi nhớ lựa chọn riêng theo tài khoản; màn hình hẹp mặc định đóng, mở dưới dạng lớp phủ. Hỗ trợ nút đóng, vùng nền, Escape, giữ focus trong menu và trả focus về nút mở khi đóng; chuyển trang tự đóng menu hẹp.
- Thanh đầu trang đặt hành động chính và Làm mới cùng hàng khi đủ chỗ; Làm mới nằm bên phải. Các khối dữ liệu chuyển cột theo chiều rộng; bảng hoặc thanh nghiệp vụ dài có vùng cuộn riêng. Khi in báo cáo, ẩn menu, thanh tài khoản và các thao tác không thuộc nội dung in.
- Danh sách có một chức năng chính cho phép nhấn cả dòng/thẻ, Enter hoặc Space để mở; bỏ nút lặp không cần thiết. Các nút xử lý độc lập như Duyệt, Từ chối, Thu hồi, Khóa hoặc Đánh dấu đã đọc không kích hoạt việc mở dòng. Liên kết tiêu đề vẫn hoạt động như liên kết thông thường.
- Các bộ lọc đã hỗ trợ URL giữ tìm kiếm, trạng thái và trang khi làm mới hoặc quay lại/tiến tới. Đổi bộ lọc về trang đầu; phân trang giữ phạm vi. Số tổng lấy từ API trên toàn phạm vi tương ứng, không đếm riêng các dòng đang nhìn thấy. Phải phân biệt tổng trước/sau bộ lọc trạng thái theo từng chức năng.
- Có trạng thái đang tải, lỗi/thử lại, dữ liệu rỗng và trang không còn kết quả. Thao tác ghi chặn gửi lặp; lỗi giữ dữ liệu nhập để sửa hoặc thử lại. Không dùng số liệu giả hoặc suy ra số giờ đóng góp từ thời lượng hoạt động.
- Thời gian dùng múi giờ Việt Nam. Trong cùng ngày, cách hiển thị thông thường là “5 phút trước”, “2 giờ nữa”, “Vừa xong”; khác ngày dùng ngày giờ đầy đủ. Bản in báo cáo dùng ngày giờ tuyệt đối. Không thay đổi giá trị thời gian lưu trữ chỉ để đổi cách hiển thị.
- Biểu mẫu có nhãn, thông báo lỗi và focus rõ ràng; cửa sổ xác nhận hỗ trợ bàn phím. Tôn trọng cài đặt giảm chuyển động. Chuông hiển thị số chưa đọc, rung khi phát hiện thông báo mới; đây là cơ chế tải định kỳ và làm mới khi quay lại cửa sổ, không phải kết nối thời gian thực.

## Trang công khai và khám phá hoạt động

`/hoat-dong` hiển thị hoạt động Công khai còn mở đăng ký và còn chỗ. Khách dùng khung công khai; Tình nguyện viên đã đăng nhập xem cùng chức năng trong không gian của mình.

- Tìm theo tên, ngày bắt đầu, địa điểm và kỹ năng; có nhãn bộ lọc để bỏ từng điều kiện, xóa tất cả và phân trang. Kiểm tra khoảng ngày trước khi gửi; giữ kỹ năng đã chọn nếu danh mục tải lỗi.
- Thẻ có ảnh bìa hoặc hình thay thế, trạng thái, thời gian bắt đầu, tên, nhà tổ chức, tag kỹ năng và thông tin chỗ. Nhấn thẻ mở `/hoat-dong/<id>`.
- Trang chi tiết tách nội dung/ảnh/chương trình khỏi cụm thời gian, địa điểm, sức chứa và tham gia. Địa điểm hiển thị trường địa điểm, không lấy mô tả thay thế. Trên điện thoại, phần tham gia được đặt trước nội dung dài.
- Hành động tham gia thay đổi theo trạng thái đơn và điều kiện backend. Không tự đăng ký hay điểm danh khi mở trang; không hiện hủy đăng ký sau khi đã có mặt.

## Không gian Tình nguyện viên

Menu gồm Tổng quan, Bảng xếp hạng, Khám phá, Gợi ý phù hợp, Lời mời của tôi, Quản lý đăng ký, Điểm danh của tôi, Lịch sử hoạt động và Đóng góp của tôi. Phản hồi truy cập từ Lịch sử, không có trang danh sách/menu đánh giá riêng; thống kê tham gia nằm trong Đóng góp của tôi.

| Trang | Nội dung và tương tác |
| --- | --- |
| Tổng quan `/tinh-nguyen-vien` | Hồ sơ thu gọn; ưu tiên số lời mời chờ, đơn chờ duyệt, hoạt động đang mở điểm danh và lượt tham gia hoàn thành. Ô số liệu dẫn tới chức năng tương ứng. Hiển thị hoạt động mở điểm danh trước hoạt động sắp tới và lịch sử gần đây. |
| Quản lý đăng ký `/tinh-nguyen-vien/dang-ky` | Theo dõi mọi đơn của bản thân, tìm theo hoạt động và lọc trạng thái. Giữ ngày gửi/xét duyệt, cảnh báo đổi lịch/địa điểm và điều kiện hủy. Hủy cần xác nhận; sau xử lý trở về trang đầu, giữ bộ lọc. |
| Điểm danh của tôi `/tinh-nguyen-vien/check-in` | Theo dõi các đơn được duyệt theo Tất cả/Đang mở/Chưa đến giờ/Đã điểm danh/Đã hết giờ. Hiển thị khung giờ và thời gian có mặt; chỉ cho check-in khi đủ điều kiện. Danh sách và số đếm tải lại tại mốc chuyển thời gian, kể cả khi trang hiện tại đang trống. |
| Check-in `/hoat-dong/<id>/check-in` | Tách Quét QR và Nhập mã tám chữ số; hỗ trợ camera, chọn/dán ảnh và bàn phím. Nhận QR vẫn cần người dùng xác nhận. Kết quả ghi thời gian, người xác nhận và hình thức điểm danh; giữ bằng chứng sau khi làm mới hoặc hoạt động bị hủy. |
| Lịch sử hoạt động `/tinh-nguyen-vien/lich-su` | Chỉ theo dõi lượt đã có mặt. Tìm hoạt động, lọc ngày điểm danh và phản hồi Đã gửi/Chưa gửi. Phân biệt điểm 0 với chưa chấm, giữ lịch sử của hoạt động đã hủy và thời gian xác nhận; mở gửi/xem phản hồi khi đủ điều kiện. |
| Phản hồi `/hoat-dong/<id>/phan-hoi` | Chọn 1–5 sao bằng radio, nhập nội dung, xem số ký tự. Giữ bản nháp khi lỗi/làm mới và cảnh báo rời trang. Khi mất phản hồi mạng sau khi gửi, kiểm tra kết quả trước khi gửi lại; phản hồi đã gửi chỉ đọc, có lý do ẩn nếu bị kiểm duyệt. |
| Lời mời `/tinh-nguyen-vien/loi-moi` | Hàng ngang có hoạt động, nhà tổ chức, trạng thái, lời nhắn và thời gian. Tìm/lọc trạng thái; nhấn dòng mở hoạt động, nút chấp nhận/từ chối hoạt động riêng. Giải thích trường hợp không thể chấp nhận. |
| Gợi ý phù hợp `/tinh-nguyen-vien/ghep-noi` | Hiển thị điểm /100, kỹ năng khớp và phần mở rộng “Vì sao được gợi ý?”. Xem chi tiết mở hoạt động, nút nằm bên trái trên điện thoại. Hiển thị nguồn AI + quy tắc hoặc quy tắc dự phòng đúng kết quả API; mức tương đồng không phải xác suất được duyệt. |
| Đóng góp của tôi `/tinh-nguyen-vien/dong-gop` | Tìm hoạt động, lọc Chờ chấm/Đã chấm; tổng điểm và số hoạt động tính trước trạng thái/phân trang trên kết quả tìm kiếm. Điểm 0 vẫn là đã chấm. Xem riêng lịch sử điều chỉnh; thống kê tham gia thu gọn dưới danh sách. |
| Bảng xếp hạng `/bang-xep-hang` | Hạng, tổng điểm, cấp bậc và dấu nhận biết bản thân; quy tắc thu gọn. Giữ đồng hạng, tối đa 20 người và dữ liệu riêng tư. Phần cá nhân không được suy ra từ việc có tên trong 20 dòng đang xem. |

Ba trang đăng ký, điểm danh và lịch sử dùng dữ liệu liên quan nhưng phục vụ ba việc khác nhau: theo dõi đơn, thực hiện/xem điểm danh và xem lại lượt đã tham gia. Không gộp thành cùng một danh sách với các tiêu đề khác nhau.

Nguồn số liệu chính là `/reports/volunteer-dashboard/`, `/participations/`, `/participations/check-in/`, `/participations/history/` và `/contributions/`. Số tổng độc lập với danh sách xem trước/phân trang. Lời mời và đăng ký tính `summary` sau tìm kiếm, trước lọc trạng thái; lịch sử tính trước lọc phản hồi; điểm danh trả mốc chuyển tiếp trên toàn kết quả tìm kiếm. Chỉ truy vấn dữ liệu của người trong phiên.

## Không gian Nhà tổ chức

Menu gồm Tổng quan, Quản lý hoạt động, Đơn đăng ký, Ghép nối tình nguyện viên, Quản lý điểm danh, Quản lý đóng góp, Phản hồi hoạt động, Báo cáo và Bảng xếp hạng. Mọi danh sách quản lý giới hạn theo hoạt động của tài khoản hiện tại.

### Tổng quan và chọn hoạt động

`/nha-to-chuc` dùng `/reports/organizer-dashboard/`. Các chỉ số và khu vực có nguồn khác nhau:

| Khu vực | Phạm vi |
| --- | --- |
| Hoạt động đã tạo | Tất cả hoạt động thuộc tài khoản, gồm bản nháp. |
| Đơn chờ xét duyệt/cần xử lý | Đơn chờ của hoạt động Công khai, còn hạn xét duyệt khi bật kiểm tra thời gian; xem trước tối đa 4 đơn. |
| Hoạt động hoàn thành | Hoạt động có trạng thái Hoàn thành. |
| Đang diễn ra | Công khai và trong khung bắt đầu–kết thúc; tối đa 3 mục, ưu tiên kết thúc sớm. |
| Sắp tới | Công khai, chưa bắt đầu; tối đa 4 mục gần nhất. |
| Kết quả và phản hồi | Lượt có điểm danh ở hoạt động Hoàn thành và phản hồi được phép hiển thị. |

Tổng trên từng khu vực tính toàn bộ dữ liệu phù hợp, không chỉ mục xem trước. Nhấn dòng cần xử lý mở danh sách chờ của đúng hoạt động; Làm mới tải lại cả số liệu và các danh sách.

Các trang chọn hoạt động theo chức năng nằm dưới `/nha-to-chuc`: `dang-ky`, `diem-danh`, `dong-gop`, `phan-hoi` và `ghep-noi`. Mỗi dòng hiển thị số liệu tương ứng: đơn đăng ký/chờ/đã duyệt, điểm danh, đóng góp hoặc phản hồi; không dùng cùng nội dung chung cho mọi trang. Số tổng tính theo phạm vi API trước phân trang. Chỉ trang quản lý hoạt động có nút tạo mới. Tổng đơn chờ trên danh sách có thể gồm đơn đã quá hạn; cần phân biệt với công việc còn xử lý được trên tổng quan.

### Quản lý một hoạt động

| Trang | Nội dung và tương tác |
| --- | --- |
| Quản lý hoạt động `/nha-to-chuc/hoat-dong` | Danh sách dạng hàng, số liệu tổng hợp, lọc theo tên/trạng thái/ngày/địa điểm/kỹ năng; trạng thái, thời gian và sức chứa theo dữ liệu API. Nhấn dòng mở chi tiết; nút tạo mới cùng thanh Làm mới. |
| Tạo/sửa | Biểu mẫu chia thông tin cơ bản; thời gian, địa điểm, số lượng; kỹ năng và chương trình. Thanh lưu bám đáy có trạng thái chưa lưu. Tổng hợp lỗi đầu form, liên kết tới trường/mốc; giữ dữ liệu khi lỗi. Có cảnh báo trước khi rời qua liên kết, lịch sử trình duyệt, đăng xuất hoặc đóng trang. |
| Ảnh và xem trước | Chọn/dán/xóa ảnh bìa dùng cụm thao tác gọn. Xem trước kiểm tra dữ liệu rồi mở bố cục chi tiết công khai với thông tin đang nhập, ảnh, kỹ năng và chương trình; chỉ đọc, không gọi API đăng ký, lưu hay công khai. Đóng xem trước giữ nguyên biểu mẫu. |
| Chi tiết | Tên hiển thị một lần; trạng thái, thời gian, địa điểm, sức chứa và thao tác quản lý ở đầu. Chỉnh sửa/chuyển trạng thái tách rõ với Hủy; thao tác nhạy cảm giữ hộp xác nhận. Thanh nghiệp vụ cuộn ngang trên điện thoại, đưa mục đang chọn vào vùng nhìn thấy. |
| Đăng ký `.../<id>/dang-ky` | Dòng ứng viên có liên hệ, trạng thái, thời gian và thao tác Duyệt/Từ chối. Xem hồ sơ mở đúng hồ sơ chỉ đọc của ứng viên với ngữ cảnh hoạt động. |
| Điểm danh `.../<id>/diem-danh` | Tìm tên/email, lọc trạng thái, số đếm từ server; QR/mã có thể thu gọn. Dòng mở thông tin tình nguyện viên; nút ghi nhận có mặt hoạt động riêng và kết quả hiển thị thời gian điểm danh. |
| Người phù hợp `.../<id>/ghep-noi` | Điểm, kỹ năng khớp và lý do từ API; quy tắc/nguồn AI được giải thích trong phần riêng. Xem hồ sơ và gửi lời mời là hai hành động độc lập; gửi cần xác nhận, lời nhắn tùy chọn. |
| Lời mời `.../<id>/loi-moi` | Hàng ngang có người nhận, trạng thái, lời nhắn, các mốc gửi/phản hồi/thu hồi. Tìm người nhận và lọc trạng thái; số tổng tính sau tìm kiếm, trước trạng thái/phân trang. Nhấn dòng/Enter đọc đầy đủ; Thu hồi cần xác nhận. Sau xử lý giữ bộ lọc và về trang đầu. |
| Đóng góp `.../<id>/dong-gop` | Tìm tên/email, lọc trạng thái, thống kê server; điểm 0 là đã chấm. Lịch sử điều chỉnh điểm mở riêng; chấm và điều chỉnh theo điều kiện nghiệp vụ. |
| Phản hồi `.../<id>/phan-hoi` | Số phản hồi hợp lệ, điểm trung bình, số sao, trích nhận xét và thời gian; lọc sao/thứ tự thời gian. Không đưa phản hồi đã ẩn vào số hợp lệ. |

Thanh nghiệp vụ của hoạt động kết nối Tổng quan, Đăng ký tham gia, Bảng điểm danh, Đánh giá, Người phù hợp, Lời mời, Điểm đóng góp và Báo cáo kết quả. Các đuôi đường dẫn `.../<id>/...` ở bảng trên nằm dưới `/nha-to-chuc/hoat-dong`.

### Báo cáo

- `/bao-cao` có Tổng hợp/Theo hoạt động/Biểu đồ dùng chung bộ lọc; giữ xuất Excel và in toàn bộ dữ liệu đã lọc, không chỉ trang đang nhìn thấy.
- Kết quả từng hoạt động tách đăng ký, điểm danh, đóng góp và phản hồi. Chỉ số mở đúng danh sách theo hoạt động; tổng điểm lấy từ API đóng góp trên toàn phạm vi đủ điều kiện, không từ trang hiện tại. Phần lỗi điểm có thể thử lại riêng.
- Mẫu tổng kết giữ thông tin, kỹ năng và chương trình, dùng A4 dọc và ngày giờ đầy đủ khi in. Bản nháp AI là nội dung riêng, cần người dùng yêu cầu và kiểm tra; không tự công khai. Bố cục Nhà tổ chức giữ phần AI trước báo cáo gốc, còn bản in chỉ giữ báo cáo gốc.

## Không gian Quản trị viên

Bảy mục menu: Tổng quan, Bảng xếp hạng, Tài khoản hệ thống, Hoạt động toàn hệ thống, Kiểm duyệt phản hồi, Lịch sử thao tác, Báo cáo và thống kê. Thông báo/hồ sơ mở qua thanh tài khoản chung.

| Trang | Nội dung và giới hạn |
| --- | --- |
| Tổng quan `/quan-tri` | Bốn thẻ từ `/reports/overview/`: Tổng tài khoản, Tài khoản bị khóa, Hoạt động công khai, Lượt tham gia hoàn thành. Thẻ dẫn tới danh sách đúng bộ lọc; số liệu theo toàn hệ thống, giá trị 0 vẫn rõ. Trạng thái hoạt động và lối vào tài khoản/phản hồi/nhật ký hiển thị gọn. |
| Tài khoản `/quan-tri/tai-khoan` | Tìm họ tên/email/username, lọc vai trò/trạng thái, bỏ từng điều kiện và giữ URL. Tổng lấy từ `count` đã lọc. Nhấn dòng mở chi tiết; Khóa/Mở khóa riêng, bắt buộc lý do. Admin được bảo vệ, không có nút đổi trạng thái. Lỗi giữ lý do; thành công giữ bộ lọc, về trang đầu. |
| Hoạt động `/bao-cao/hoat-dong` | Tìm tên, lọc trạng thái, phân trang; dòng có hoạt động, nhà tổ chức, trạng thái, thời gian và sức chứa. Nhấn dòng mở kết quả. Không thêm quyền chỉnh sửa hoạt động của Nhà tổ chức. |
| Kết quả `/bao-cao/hoat-dong/<id>` | Hiển thị thời gian và địa điểm riêng biệt; số liệu đăng ký/điểm danh mở danh sách theo đúng hoạt động. Phản hồi hợp lệ/điểm trung bình loại bản đã ẩn; liên kết kiểm duyệt giữ hoạt động và trạng thái Chưa ẩn. Mở tổng kết theo trạng thái/thời gian và cấu hình hiện tại; liên kết công khai chỉ xuất hiện cho hoạt động Công khai. |
| Kiểm duyệt `/quan-tri/phan-hoi` | Lọc Tất cả/Chưa ẩn/Đã ẩn và hoạt động, giữ phạm vi qua phân trang/xử lý. Dòng có người gửi, điểm /5, nội dung, trạng thái và thời gian; mở để đọc đầy đủ. Ẩn cần lý do, không có mở lại khi API chưa hỗ trợ. AI phân tích theo phạm vi người dùng yêu cầu, không tự ẩn phản hồi; bộ lọc sai không ngầm mở rộng toàn hệ thống. |
| Báo cáo `/bao-cao`, `/bao-cao/mo-rong` | Tổng hợp/Theo hoạt động/Biểu đồ dùng chung analytics. Lọc tên, trạng thái, ngày bắt đầu từ/đến và nhà tổ chức; URL giữ cả chế độ/trang. Tổng trên toàn kết quả; Excel lấy dữ liệu mới theo cùng năm bộ lọc, không gửi chế độ/trang. Bản in chứa toàn bộ kết quả đang xem; API giới hạn mỗi báo cáo 2.000 hoạt động. |
| Chi tiết đăng ký `/bao-cao/dang-ky` | Đối chiếu từng chỉ số và hoạt động, giữ phạm vi khi đổi chỉ số hoặc trang. Dòng có tình nguyện viên, hoạt động, trạng thái đơn, ngày đăng ký và thời gian điểm danh; mở chi tiết chỉ đọc. Xóa bộ lọc bỏ cả chỉ số và hoạt động; có thể bỏ riêng hoạt động. Không có quyền duyệt đơn thay Nhà tổ chức. |
| Tổng kết `/bao-cao/hoat-dong/<id>/tong-ket` | Báo cáo gốc đứng trước, bản nháp AI ở phần riêng. AI do người dùng yêu cầu, chỉnh/sao chép riêng, không tự lưu/xuất bản. Nguồn thay đổi chặn sao chép bản cũ; lỗi tạo lại giữ phần đã sửa. Bản in chỉ chứa số liệu gốc với ngày giờ tuyệt đối. |
| Bảng xếp hạng `/bang-xep-hang` | Hạng, tên, tổng điểm và cấp bậc; giữ đồng hạng và tối đa 20 người. Không có tiến độ cá nhân của Tình nguyện viên, email, điện thoại hoặc hồ sơ riêng tư. |
| Nhật ký `/quan-tri/nhat-ky`, `/<id>` | Tìm theo người/hoạt động/loại thao tác/khoảng ngày/mã định danh; giữ bộ lọc khi mở chi tiết và quay lại. Dữ liệu trước–sau có kiểu theo ảnh chụp thực đã lưu; phân biệt không ghi nhận, null, false, 0 và giá trị rỗng. Không dựng lại lịch sử từ dữ liệu hiện tại. Nhật ký chỉ đọc. |

Các hành động thay đổi tài khoản hoặc ẩn phản hồi là quyền quản trị cụ thể, có lý do và nhật ký. Các màn hình báo cáo, đăng ký và hoạt động trong khung admin không tự cấp thêm quyền quản lý hoạt động. Backend tiếp tục kiểm tra quyền, phiên, CSRF và điều kiện nghiệp vụ.

## Hồ sơ và thông báo

### Hồ sơ `/ho-so`

- Ảnh đại diện dùng Chọn ảnh/Dán ảnh/Xóa ảnh, có ảnh thay thế khi chưa có hoặc tải lỗi. Ảnh được lưu riêng, không làm mất các thay đổi phần chữ; thanh tài khoản cập nhật theo hồ sơ mới.
- Tình nguyện viên có thông tin cơ bản, kỹ năng, sở thích và lịch rảnh; Nhà tổ chức có thêm thông tin tổ chức. Admin giữ username đăng nhập chỉ đọc, chỉ gửi các trường họ tên, điện thoại và giới thiệu khi lưu thông tin.
- Volunteer/Admin có trạng thái chưa lưu, Hoàn tác, Làm mới giữ phần đang sửa và cảnh báo rời trang; Organizer có trạng thái chưa lưu nhưng chưa có ba thao tác bảo vệ này. Dữ liệu nhập được giữ khi lưu lỗi. Bản nháp chỉ nằm trong state của trang, không lưu qua F5 hoặc đóng trang; hết phiên thật hoặc đổi tài khoản không được để lộ dữ liệu người trước. Lỗi mạng khi kiểm tra phiên không được tự coi là đăng xuất.
- Nhà tổ chức mở hồ sơ ứng viên qua ngữ cảnh hoạt động: cùng bố cục hồ sơ, chỉ đọc, vẫn có avatar; ẩn thuộc tính không có dữ liệu và kỹ năng chưa được chọn. Nút trở về danh sách đăng ký cùng hàng với tiêu đề khi đủ chỗ. Đây không phải chức năng đăng nhập thay ứng viên.

### Thông báo `/thong-bao`

- Mỗi vai trò có bộ lọc Tất cả/Chưa đọc/Đã đọc, phân trang và giữ URL cho chính tài khoản. Admin/Volunteer có thêm số đếm từng trạng thái và tự hồi phục trang 404; Admin/Organizer nhóm Hôm nay/Hôm qua/ngày đầy đủ theo Việt Nam.
- Nhấn dòng mở đích nội bộ hợp lệ. Với admin, thông báo chưa đọc chỉ điều hướng sau khi đánh dấu đọc thành công; mục đã đọc không gửi yêu cầu đọc lặp. Nút đánh dấu riêng không đồng thời mở dòng. Đánh dấu tất cả chỉ tác động hộp thư của người trong phiên.
- Tùy chọn email thu gọn, lưu lỗi trả lại lựa chọn trước đó; giải thích khi tài khoản chưa có email. Nội dung phù hợp vai trò. Thông báo hủy hoặc liên kết cũ tới hoạt động không còn công khai đưa Tình nguyện viên về dữ liệu tham gia phù hợp của mình.

## Mã nguồn và tài liệu liên quan

- `frontend/src/layouts/SiteLayout.jsx` chọn khung; `OrganizerLayout.jsx`, `VolunteerLayout.jsx`, `AdminLayout.jsx` giữ menu theo vai trò. `useWorkspaceMenu`, `WorkspaceMenuControls` và `ActionRow` quản lý tương tác chung.
- Các page/component tương ứng nằm trong `frontend/src/pages` và `frontend/src/components`; CSS trong `frontend/src/styles` được giới hạn theo không gian hoặc biến thể vai trò. Trang dùng chung phải giữ hành vi và bố cục phù hợp từng vai trò.
- Kiểm thử UI/nghiệp vụ nằm trong `frontend/e2e`; số liệu và phân quyền vẫn do API backend cung cấp. Cách chạy, trạng thái kiểm chứng và giới hạn nằm trong [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md), không ghi lại lịch sử các đợt vào tài liệu giao diện.

Xem [Mục lục tài liệu](README.md), [Hoạt động và tham gia](HOAT_DONG_VA_THAM_GIA.md), [Tài khoản và hồ sơ](TAI_KHOAN_VA_HO_SO.md), [Báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md), [AI ghép nối](AI_GHEP_NOI.md) và [AI phản hồi, báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md) để tra cứu nghiệp vụ và cấu hình.
