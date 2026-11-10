# Hoạt động và tham gia

Tài liệu mô tả quy tắc hiện tại của hoạt động, đăng ký, lời mời, điểm danh, phản hồi và điểm đóng góp. Xem [mục lục tài liệu](README.md), [tài khoản và hồ sơ](TAI_KHOAN_VA_HO_SO.md), [giao diện các vai trò](GIAO_DIEN.md), [báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md). Ghép nối và các chức năng AI được trình bày tại [AI ghép nối](AI_GHEP_NOI.md) và [AI phản hồi, báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md).

## 1. Quyền và dữ liệu chung

- Nhà tổ chức (`organizer`) tạo, sửa và vận hành hoạt động của mình; không quản lý hoạt động của Nhà tổ chức khác.
- Tình nguyện viên (`volunteer`) đăng ký, xử lý lời mời, tự check-in và gửi phản hồi cho chính mình. Các danh sách cá nhân chỉ trả dữ liệu của tài khoản trong phiên đăng nhập.
- Admin có các API đọc báo cáo, kiểm duyệt và nhật ký riêng; không dùng API Organizer để xét duyệt, điểm danh hoặc chấm điểm thay chủ hoạt động.
- API bên dưới có tiền tố `/api/v1/`. API riêng tư yêu cầu phiên đăng nhập đúng vai trò; yêu cầu ghi dùng CSRF. Thời điểm, người thực hiện và quyền sở hữu do backend xác định.
- Danh sách phân trang dùng `page`, `page_size` tối đa 100. Các số tổng hợp được tính trên tập hợp phù hợp trước phân trang, không cộng riêng các dòng đang hiển thị.
- Backend lưu datetime có múi giờ; biểu mẫu và bộ lọc ngày dùng múi giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7). API nhận thời gian ISO 8601 có múi giờ.

## 2. Hoạt động

### Trường dữ liệu và trạng thái

| Trường | Quy tắc |
| --- | --- |
| `title` | Bắt buộc, tối đa 200 ký tự |
| `description` | Bắt buộc, tối đa 10.000 ký tự |
| `address` | Bắt buộc, tối đa 500 ký tự; tách riêng với mô tả |
| `starts_at`, `ends_at` | Kết thúc phải sau bắt đầu |
| `capacity` | Số nguyên từ 1 đến 100.000, không thấp hơn số người đã được duyệt |
| `required_skills` | Tối đa 20 ID kỹ năng từ danh mục chung, không trùng; có thể để rỗng |
| `timeline` | Tối đa 50 mốc chương trình, xem bên dưới |
| Ảnh bìa | Một ảnh tùy chọn, lưu qua API ảnh riêng |

Kỹ năng yêu cầu dùng quan hệ nhiều–nhiều với `core.Skill`; API đọc trả cả `required_skills` và `skill_details`. Kỹ năng cung cấp thông tin, bộ lọc và dữ liệu ghép nối; người chưa có kỹ năng vẫn có thể đăng ký để Nhà tổ chức xét duyệt.

| Trạng thái hiện tại | Có thể chuyển sang | Điều kiện thời gian khi bật kiểm tra |
| --- | --- | --- |
| Nháp (`draft`) | Công khai (`published`) | Giờ bắt đầu còn ở tương lai |
| Nháp | Đã hủy (`cancelled`) | Không có điều kiện thời gian |
| Công khai | Hoàn thành (`completed`) | Đã đến hoặc qua giờ kết thúc |
| Công khai | Đã hủy | Không có điều kiện thời gian |
| Hoàn thành / Đã hủy | Không chuyển tiếp | Không chỉnh sửa nội dung hoặc ảnh bìa |

Tạo mới luôn là bản nháp. Chỉ chủ hoạt động được sửa khi còn Nháp/Công khai; trạng thái thay đổi qua endpoint riêng. Không có luồng chuyển Công khai về Nháp hoặc API xóa vật lý hoạt động.

**Hiện không có quy tắc phải tạo trước 24 giờ.** Tạo bản nháp và sửa lịch không yêu cầu giờ bắt đầu ở tương lai; khi công khai, backend kiểm tra lại giờ bắt đầu theo chính sách thời gian. Khi bật kiểm tra, hoạt động đã bắt đầu và đã có đơn đăng ký không được đổi giờ bắt đầu/kết thúc để mở lại đăng ký. Giữ nguyên lịch vẫn được sửa các nội dung còn cho phép.

Đổi lịch hoặc địa điểm thông báo cho người tham gia qua cơ chế thông báo hiện có và thu hồi mã điểm danh hiện hành. Hủy hoạt động chuyển các đơn Chờ duyệt/Được duyệt sang Đã hủy với lý do `activity_cancelled`; giữ các đơn đã bị từ chối hoặc tự hủy, thông tin xét duyệt và bằng chứng điểm danh đã có.

### Phạm vi công khai và bộ lọc

Khách và Tình nguyện viên chỉ xem chi tiết/ảnh bìa của hoạt động đang **Công khai** và đã có `published_at`. Truy cập trực tiếp hoạt động Nháp, Hoàn thành hoặc Đã hủy trả 404. Chủ hoạt động vẫn xem được dữ liệu quản lý và ảnh ở mọi trạng thái.

Danh sách Khám phá còn loại hoạt động đã đủ số người Được duyệt; khi bật kiểm tra thời gian, loại cả hoạt động đã đến giờ bắt đầu. Điều kiện áp dụng ở backend trước bộ lọc và phân trang. Đơn Chờ duyệt không giữ chỗ. Hoạt động chưa bắt đầu có thể hiện lại khi người đã duyệt tự hủy hoặc chủ hoạt động tăng sức chứa. Chi tiết Công khai vẫn mở được dù hoạt động đã đủ chỗ/đã bắt đầu để phục vụ người tham gia.

Danh sách quản lý chỉ chứa hoạt động của chủ đang đăng nhập, không bị giới hạn như Khám phá. Các bộ lọc kết hợp theo AND:

| Tham số | Ý nghĩa |
| --- | --- |
| `search` | Tên chứa từ khóa, tối đa 200 ký tự |
| `status` | `published`, `completed`, `cancelled`; quản lý có thêm `draft` |
| `date_from`, `date_to` | Ngày bắt đầu hoạt động trong khoảng `YYYY-MM-DD`, bao gồm hai đầu theo UTC+7 |
| `location` | Địa chỉ chứa từ khóa, tối đa 200 ký tự |
| `skill` | ID một kỹ năng yêu cầu |

Có thể chỉ nhập một đầu khoảng ngày; khoảng hỗ trợ là `1000-01-02` đến `9999-12-30` để chuyển múi giờ an toàn với MySQL. Ngày ngoài khoảng, ngày từ sau ngày đến, trạng thái sai hoặc kỹ năng không tồn tại trả 400. Bộ lọc không mở rộng quyền: trạng thái Hoàn thành/Đã hủy không làm xuất hiện dữ liệu trong API công khai; `draft` bị từ chối tại API này. Khám phá dùng `no-store` để kiểm tra lại thời gian và số chỗ khi tải.

Lịch sử đăng ký, điểm danh và phản hồi cá nhân vẫn giữ thông tin hoạt động khi hoạt động không còn Công khai. Các trang đó dùng API cá nhân có quyền, không dựa vào việc gọi lại chi tiết công khai; không đặt liên kết chi tiết công khai cho hoạt động đã đóng.

### Mốc chương trình

Mỗi phần tử `timeline` gồm `{title, description, starts_at, ends_at}`:

- Tên bắt buộc, tối đa 200 ký tự; mô tả tùy chọn, tối đa 2.000 ký tự.
- Kết thúc mốc phải sau bắt đầu; cả hai nằm trong khoảng hoạt động, được trùng đúng hai biên.
- Cho phép các mốc chồng nhau để mô tả chương trình song song; không bắt buộc phủ kín hoạt động. Thứ tự đọc là bắt đầu, kết thúc rồi ID.
- Hỗ trợ hoạt động nhiều ngày. Khi đổi lịch tổng thể, phải sửa đồng thời những mốc nằm ngoài lịch mới; nếu lỗi, toàn bộ yêu cầu không được lưu.
- `PATCH` không gửi `timeline` giữ nguyên các mốc; gửi danh sách thay toàn bộ; gửi `[]` xóa hết. Mỗi mốc gửi lên phải có tên và đủ hai thời điểm; không nhận ID để chuyển mốc từ hoạt động khác.
- Hoạt động và mốc được ghi trong cùng transaction. Chỉ sửa timeline khi hoạt động còn Nháp/Công khai; sửa riêng nội dung chương trình không tự tạo một loại thông báo/email mới.

### Ảnh bìa

Ảnh chỉ được lưu sau khi hoạt động đã có ID. Chọn file hoặc dán ảnh đều dùng cùng API tải ảnh và lưu ngay, độc lập với nút lưu nội dung hoạt động.

- Nhận JPEG, PNG hoặc WebP hợp lệ, tối đa 5 MB và 16 triệu điểm ảnh; backend kiểm tra nội dung file.
- Sửa chiều theo EXIF, thu cạnh dài về tối đa 1.920 px, mã hóa lại JPEG và bỏ metadata gốc. Tên file ngẫu nhiên; file lưu tại `backend/media/activities/covers/`, database giữ đường dẫn.
- Không công khai trực tiếp thư mục media. API ảnh kiểm tra trạng thái/quyền sở hữu, trả 404 nếu không có ảnh hoặc không được xem và dùng `no-store`.
- Tải lên chỉ nhận một file `cover`; chủ hoạt động chỉ thay/xóa ảnh khi còn Nháp/Công khai. `cover_url` chứa phiên bản theo tên file để cập nhật ảnh sau khi thay.
- Chỉ xóa file cũ sau khi transaction thành công; nếu ghi database lỗi, dọn file mới và giữ ảnh cũ. Không có ảnh hoặc tải lỗi dùng hình thay thế.

### API hoạt động

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `activities/` | Khám phá trong phạm vi công khai/còn chỗ |
| GET | `activities/<id>/` | Chi tiết Công khai |
| GET / POST | `organizer/activities/` | Danh sách riêng / tạo bản nháp |
| GET / PATCH | `organizer/activities/<id>/` | Xem / sửa hoạt động sở hữu |
| POST | `organizer/activities/<id>/status/` | `{"status":"published"}`, `completed` hoặc `cancelled` |
| GET / POST / DELETE | `activities/<id>/cover/` | Xem / tải multipart `cover` / xóa ảnh |

## 3. Đăng ký và xét duyệt

- Chỉ tài khoản Volunteer đăng ký cho chính mình khi hoạt động Công khai và còn chỗ. Khi bật kiểm tra thời gian, giờ bắt đầu là hạn đăng ký, tự hủy và xét duyệt; tại đúng giờ bắt đầu, các thao tác này đóng.
- Mỗi người có tối đa một `Participation` cho mỗi hoạt động. Lần đầu là Chờ duyệt (`pending`). Tự hủy (`cancelled`, lý do `volunteer`) có thể đăng ký lại khi còn mở, dùng lại bản ghi và trở về Chờ duyệt. Đã bị từ chối (`rejected`) hoặc bị hủy cùng hoạt động không được đăng ký lại.
- Chỉ chủ hoạt động duyệt/từ chối đơn đang Chờ duyệt; lưu người và thời điểm xét duyệt. Không duyệt tài khoản đã khóa hoặc không còn vai trò Volunteer.
- Sức chứa tính số Được duyệt (`approved`), không tính đơn chờ. Đủ chỗ thì chặn cả đăng ký mới và duyệt thêm; tự hủy đơn đã duyệt giải phóng chỗ. Đơn chưa được duyệt khi quá hạn vẫn Chờ duyệt, không tự đổi quyết định.
- Bản đăng ký lưu lịch và địa chỉ tại lúc đăng ký, đối chiếu với dữ liệu hiện tại để trả `activity_changed`. Đăng ký lại cập nhật bản chụp này.
- Đăng ký, hủy, xét duyệt, đổi sức chứa và hủy hoạt động cùng khóa dòng hoạt động trong transaction; unique tại database chống trùng người/hoạt động và việc tranh chỗ cuối không vượt sức chứa.

Nhà tổ chức xem họ tên, email, điện thoại và hồ sơ ứng viên trong hoạt động sở hữu. Danh sách ứng viên và avatar không công khai. Chi tiết hồ sơ ứng viên dùng API có quyền này, không đổi sang phiên đăng nhập của ứng viên.

| Phương thức | Đường dẫn | Dữ liệu / phạm vi |
| --- | --- | --- |
| GET | `participations/` | Đơn của mình; `search` theo tên hoạt động, `status=all/pending/approved/rejected/cancelled` |
| GET / POST | `activities/<id>/participation/` | Xem đơn của mình / đăng ký với `{}` |
| POST | `activities/<id>/participation/cancel/` | Tự hủy với `{}` |
| GET | `organizer/activities/<id>/applicants/` | Đơn thuộc hoạt động sở hữu; tìm tên/email, lọc trạng thái |
| GET | `organizer/activities/<id>/applicants/<entry_id>/` | Hồ sơ ứng viên trong đơn |
| GET | `organizer/activities/<id>/applicants/<entry_id>/avatar/` | Avatar có kiểm tra quyền |
| POST | `organizer/activities/<id>/applicants/<entry_id>/review/` | `{"status":"approved"}` hoặc `rejected` |

## 4. Lời mời

Chủ hoạt động gửi lời mời cho Volunteer đang hoạt động đã bật `matching_visible`. Chỉ gửi khi hoạt động Công khai, đã công bố, còn chỗ và còn mở đăng ký. Lời nhắn tùy chọn tối đa 1.000 ký tự. Admin không gửi hoặc trả lời thay các chủ thể này.

- Lời mời Chờ phản hồi (`pending`) không tạo đơn và không giữ chỗ. Khi chấp nhận, backend kiểm tra lại trạng thái hoạt động, tài khoản, hạn đăng ký và sức chứa. Nếu hết chỗ, lời mời vẫn chờ để người nhận thử lại khi có chỗ.
- Chấp nhận hợp lệ (`accepted`) tạo ngay đơn Được duyệt, hoặc cập nhật đơn Chờ duyệt/đơn tự hủy. Người duyệt là người gửi lời mời; nhật ký ghi người nhận thực sự xác nhận và nguồn `invitation`.
- Không dùng lời mời để vượt đơn đã được duyệt, bị từ chối hoặc bị hủy cùng hoạt động. Chấp nhận lặp không tạo đơn/thông báo mới và không duyệt lại đơn đã tự hủy sau lần chấp nhận trước.
- Mỗi người/hoạt động chỉ có một lời mời. Gửi lặp trả bản ghi cũ, không gửi lại thông báo. Đã chấp nhận/từ chối (`declined`)/thu hồi (`withdrawn`) không đổi phản hồi hoặc gửi lại cùng lời mời.
- Chủ hoạt động chỉ thu hồi lời mời đang chờ. Người nhận có thể từ chối; chấp nhận bị chặn nếu hoạt động đã đóng, quá hạn, tài khoản không khả dụng hoặc hết chỗ.
- Khi lịch/địa điểm đổi, API trả cảnh báo `activity_changed`; chấp nhận dùng lịch hiện tại và lưu vào đơn. Lời mời hết hạn vẫn ở lịch sử với lý do không thể chấp nhận.
- Tắt quyền được gợi ý chặn lời mời mới, không tước quyền chủ động xử lý lời mời đã nhận. Danh sách lời mời không công khai thông tin liên hệ hay toàn bộ hồ sơ/lịch rảnh.

Gửi, thu hồi và phản hồi tạo nhật ký, thông báo website và hàng đợi email theo tùy chọn người nhận; chấp nhận còn thông báo tự động duyệt. Ghi lời mời/đơn/thông báo/nhật ký trong cùng transaction, khóa hoạt động cùng thứ tự với xét duyệt để không vượt chỗ.

| Phương thức | Đường dẫn | Dữ liệu / phạm vi |
| --- | --- | --- |
| GET | `invitations/` | Lời mời của mình; `status=all/pending/accepted/declined/withdrawn`, `search` theo hoạt động/người gửi |
| POST | `invitations/<id>/respond/` | `{"status":"accepted"}` hoặc `declined` |
| GET / POST | `organizer/activities/<id>/invitations/` | Xem / gửi `{"volunteer":"UUID","message":"..."}` |
| POST | `organizer/activities/<id>/invitations/<invitation_id>/withdraw/` | Thu hồi với `{}` |

## 5. Điểm danh và lịch sử tham gia

### Điểm danh thủ công

Chủ hoạt động xác nhận có mặt cho người Được duyệt. Hoạt động luôn phải Công khai; khi bật kiểm tra thời gian, thời điểm phải thuộc khoảng bắt đầu–kết thúc, bao gồm hai biên. Backend lấy người xác nhận và thời điểm; không nhận các trường này từ client.

Mỗi đơn có tối đa một `Attendance`. Yêu cầu lặp còn hợp lệ trả bản ghi đầu tiên, không đổi người, thời điểm hoặc hình thức và không tạo thông báo/lượt tham gia mới. Không có API sửa/xóa điểm danh. Hoạt động bị hủy sau khi điểm danh vẫn giữ bằng chứng; chưa có điểm danh chỉ có nghĩa chưa ghi nhận có mặt, không tự kết luận vắng mặt.

### QR và mã nhập

Volunteer đã được duyệt tự check-in qua QR bằng camera, ảnh QR hoặc mã 8 chữ số. Chỉ check-in, chưa có check-out; không suy ra thời lượng đóng góp từ thời điểm vào.

- Chỉ chủ hoạt động xem/cấp/thu hồi mã, mỗi hoạt động một mã hiện hành. Khi bật kiểm tra thời gian, mã có hạn tối đa 5 phút và không quá giờ kết thúc, không cấp mã mới tại đúng giờ kết thúc và mã hết hiệu lực tại đúng `expires_at`. Chế độ thử bên dưới bỏ kiểm tra hết hạn.
- Tạo mã mới hoặc thu hồi vô hiệu cả QR và mã nhập cũ. Đổi lịch/địa điểm thu hồi mã; hoạt động Đã hủy/Hoàn thành không check-in được.
- QR có dạng `vconnect:checkin:<activity-id>:<token>`, không phải URL tự điều hướng. Backend nhận đúng một `code` gồm 8 chữ số hoặc `token` gồm 64 ký tự hex; không nhận ID người khác.
- Token/mã dẫn xuất bằng HMAC với bí mật server và hai miền riêng, không lưu mã dùng được trực tiếp trong database. Không đặt token trong URL hoặc lưu lâu dài tại trình duyệt.
- API check-in giới hạn 6 yêu cầu/phút/tài khoản. Triển khai nhiều tiến trình cần cache chung để giới hạn có hiệu lực thống nhất.
- Camera chỉ mở sau thao tác người dùng, dừng khi đọc mã/tắt/rời trang; cần HTTPS hoặc localhost và quyền camera. Có ảnh QR/mã nhập dự phòng. Ảnh PNG/JPEG/WebP tối đa 5 MB được xử lý trong trình duyệt, không tải lên server.
- QR/mã không xác minh GPS hoặc khuôn mặt. Dùng chung transaction và khóa hoạt động với điểm danh thủ công; yêu cầu đồng thời vẫn chỉ có một bản ghi.

`Attendance.method` phân biệt `manual`, `qr`, `code`; bản ghi cũ mặc định `manual`. Tự check-in ghi `confirmed_by` là chính Volunteer. Tạo mới trả 201; lặp hợp lệ trả 200 với bằng chứng gốc. Thông báo và nhật ký chỉ tạo khi thực sự ghi mới.

### Ba danh sách cá nhân

| API | Dữ liệu và bộ lọc |
| --- | --- |
| `GET participations/` | Toàn bộ đơn của mình, phục vụ theo dõi quyết định và hủy đơn |
| `GET participations/check-in/` | Chỉ đơn Được duyệt của hoạt động Công khai; `status=all/open/upcoming/attended/closed`, ưu tiên đang mở rồi sắp tới |
| `GET participations/history/` | Chỉ lượt đã có điểm danh, mới nhất trước; `feedback=all/pending/submitted`, `date_from/date_to` theo ngày điểm danh UTC+7 |

Cả ba hỗ trợ `search` tên hoạt động tối đa 200 ký tự. API trả các quyền thao tác hiện tại (`can_cancel`, `can_check_in`, `can_submit_feedback`) và dữ liệu điểm/phản hồi cá nhân phù hợp; không suy ra quyền chỉ từ nhãn giao diện. Trang điểm danh dùng `next_transition_at` để tải lại khi đến mốc giờ; chế độ thử không có mốc chuyển trạng thái thời gian này.

| Phương thức | Đường dẫn | Dữ liệu / phạm vi |
| --- | --- | --- |
| GET | `organizer/activities/<id>/attendance/` | Người đang Được duyệt hoặc đã có bằng chứng cần giữ; tìm tên/email, `status=all/pending/attended` |
| POST | `organizer/activities/<id>/attendance/<entry_id>/` | Điểm danh thủ công với `{}`; `entry_id` là ID đơn đăng ký |
| GET / POST | `organizer/activities/<id>/attendance-code/` | Xem / cấp hoặc thay mã với `{}` |
| POST | `organizer/activities/<id>/attendance-code/revoke/` | Thu hồi với `{}` |
| POST | `activities/<id>/check-in/` | `{"code":"12345678"}` hoặc `{"token":"..."}` |

## 6. Phản hồi sau hoạt động

- Volunteer chỉ gửi khi có điểm danh, đơn vẫn Được duyệt, hoạt động Hoàn thành và đã kết thúc theo chính sách thời gian. Chỉ hết giờ mà chưa Hoàn thành hoặc hoạt động bị hủy không đủ điều kiện.
- Điểm đánh giá nguyên 1–5, nội dung bắt buộc sau khi bỏ khoảng trắng đầu/cuối, tối đa 2.000 ký tự. Mỗi `Attendance` có tối đa một phản hồi; không có API sửa/xóa hoặc gửi lại sau khi bị ẩn.
- Backend tìm điểm danh của tài khoản trong phiên, không nhận người gửi/điểm danh do client gán. Nội dung được hiển thị như văn bản.
- Người gửi xem nội dung của mình, trạng thái ẩn và lý do. Organizer chỉ xem phản hồi chưa ẩn, đơn Được duyệt và hoạt động Hoàn thành thuộc mình; Volunteer khác/khách không có danh sách phản hồi công khai.
- Thống kê Organizer dùng cùng tập phản hồi hợp lệ, `summary.count` và điểm trung bình làm tròn hai số thập phân. Bộ lọc sao/phân trang không đổi tổng hoạt động; chưa có phản hồi thì trung bình `null`.
- Admin xem/lọc tất cả, chưa ẩn hoặc đã ẩn; ẩn phải nhập lý do tối đa 1.000 ký tự. Giữ bản gốc, Admin xử lý và thời điểm; yêu cầu lặp giữ quyết định đầu tiên. Chưa có API khôi phục.
- Gửi dùng transaction/khóa hoạt động; kiểm duyệt khóa phản hồi. Ràng buộc một–một chống gửi trùng. Gửi và ẩn tạo thông báo theo cơ chế hiện có.

| Phương thức | Đường dẫn | Dữ liệu / phạm vi |
| --- | --- | --- |
| GET / POST | `activities/<id>/feedback/` | Phản hồi của mình, `can_submit` / gửi `{"rating":5,"content":"..."}` |
| GET | `organizer/activities/<id>/feedback/` | Phản hồi hợp lệ và `summary`; `rating=all/1/2/3/4/5`, `ordering=newest/oldest` |
| GET | `admin/feedback/` | `status=all/visible/hidden`, `activity=UUID` tùy chọn |
| POST | `admin/feedback/<feedback_id>/hide/` | `{"reason":"..."}` |

API phản hồi cá nhân trả thông tin ngữ cảnh hoạt động khi đã có điểm danh/phản hồi, nên người dùng vẫn đánh giá và xem lại sau khi chi tiết công khai đã đóng. AI chỉ hỗ trợ đọc/tổng hợp, không tự ẩn phản hồi; xem [AI phản hồi và báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md).

## 7. Điểm đóng góp và bảng xếp hạng

### Chấm và sửa điểm

- Chủ hoạt động chấm cho đơn Được duyệt đã có điểm danh, sau khi hoạt động Hoàn thành và đã kết thúc theo chính sách thời gian.
- Điểm nguyên 0–10, độc lập thời lượng. Điểm 0 là đã chấm, khác chưa chấm; không tự tính điểm từ check-in. Tổng nhiều hoạt động có thể lớn hơn 10. Điểm này khác điểm phản hồi /5 và điểm ghép nối /100.
- `Contribution` giữ điểm hiện tại, người chấm và phiên bản. `ContributionChange` giữ điểm cũ/mới, lý do, người thực hiện và thời điểm; lịch sử không được sửa/xóa qua API.
- Lần đầu gửi `revision=0`. Cập nhật phải dùng phiên bản hiện tại; phiên bản cũ bị từ chối và phải tải lại. Sửa điểm phải có lý do tối đa 1.000 ký tự. Gửi cùng điểm ở đúng phiên bản không thêm lịch sử/thông báo.
- Ghi điểm và lịch sử cùng transaction, khóa hoạt động để tránh ghi đè. Database giới hạn điểm hiện tại/lịch sử trong 0–10.
- Volunteer chỉ đọc điểm/lịch sử của mình; Organizer chỉ chấm/đọc hoạt động sở hữu; Admin có quyền đọc lịch sử, không chấm thay.
- Xác nhận/điều chỉnh tạo nhật ký, thông báo website và hàng đợi email theo tùy chọn. Không có chức năng chứng nhận/chứng chỉ hiện hành.

| Phương thức | Đường dẫn | Dữ liệu / phạm vi |
| --- | --- | --- |
| GET | `contributions/` | Điểm cá nhân; `summary.score/confirmed/pending`, `search` tên hoạt động, `status=all/pending/confirmed` |
| GET | `contributions/<attendance_id>/history/` | Lịch sử phân trang có kiểm tra quyền |
| GET | `organizer/activities/<id>/contributions/` | Lượt đủ điều kiện của hoạt động sở hữu; tìm tên/email, lọc trạng thái chấm |
| POST | `organizer/activities/<id>/contributions/<attendance_id>/` | `{"score":8,"revision":0,"reason":""}` lần đầu; sửa gửi phiên bản/lý do phù hợp |

`attendance_id` là ID **điểm danh**, khác `entry_id` của đơn đăng ký. Payload `minutes` cũ bị từ chối. Tổng đóng góp cộng trên toàn bộ dữ liệu đủ điều kiện trước bộ lọc trạng thái và phân trang.

### Xếp hạng và cấp bậc

Bảng tự cộng điểm đã được chủ hoạt động chấm trên các đơn Được duyệt, có điểm danh, hoạt động Hoàn thành và đã kết thúc theo chính sách thời gian. Không tính Nháp/Công khai/Đã hủy hoặc đơn đã hủy/bị từ chối; điểm chưa chấm không được tự gán.

- Top 20 chỉ gồm Volunteer đang hoạt động có tổng điểm lớn hơn 0, giảm dần theo tổng. Bằng điểm cùng hạng kiểu `1, 1, 3`.
- Khi bằng điểm, thứ tự hiển thị dùng ngày tham gia tăng dần rồi mã tài khoản. Ngay cả đồng điểm ở vị trí 20 vẫn giới hạn đúng 20 người; tiêu chí phụ không đổi hạng/cấp bậc.
- Volunteer xem tổng/hạng/cấp bậc của mình cả khi ngoài Top 20; 0 điểm chưa xếp hạng. Organizer/Admin không có hạng cá nhân.
- Tổng và cấp bậc tính từ dữ liệu hiện tại mỗi lần tải, có thể tăng/giảm sau khi sửa điểm hoặc dữ liệu đủ điều kiện. Không lưu bản cộng riêng, không có tiến trình cộng điểm hoặc cập nhật đẩy trực tiếp.

| Tổng điểm | Cấp bậc |
| --- | --- |
| 0–19 | Khởi đầu |
| 20–49 | Đồng hành |
| 50–99 | Tích cực |
| 100–199 | Tiên phong |
| Từ 200 | Truyền cảm hứng |

`GET leaderboard/` yêu cầu đăng nhập, trả `results` tối đa 20, `me` chỉ dành cho Volunteer, `levels`, `limit=20`, `updated_at`, `time_checks_disabled`. Mỗi người chỉ có hạng, họ tên, `avatar_url`, tổng điểm, cấp bậc và `is_me`; không trả ID riêng hoặc thông tin liên hệ. Cấp bậc có mốc tiếp theo và phần trăm tiến độ; cấp cao nhất đạt 100% và không có mốc tiếp theo.

`GET leaderboard/avatars/<id>/` chỉ trả avatar của người đang trong Top 20 hoặc chính Volunteer đó; tài khoản bị khóa/không còn phạm vi hoặc không có ảnh trả 404. API dùng `no-store`, không mở file media công khai. `matching_visible` là quyền gợi ý ghép nối, không phải điều kiện xếp hạng.

## 8. Chính sách thời gian và chế độ thử

`ACTIVITY_TIME_CHECKS_ENABLED` tại backend điều khiển các cổng thời gian nghiệp vụ. Mặc định trong settings và `.env.example` là `true`. Để thử luồng không chờ lịch, đặt trong `backend/.env` rồi khởi động lại backend:

```dotenv
ACTIVITY_TIME_CHECKS_ENABLED=false
```

Frontend đọc `time_checks_disabled` từ API, không có công tắc riêng. Đặt lại `true` và khởi động lại để khôi phục kiểm tra; không cần migration hay đổi ngày giờ trong database.

| Khi `true` | Khi `false` |
| --- | --- |
| Công khai phải trước giờ bắt đầu; chặn đổi lịch sau khi bắt đầu nếu đã có đơn | Có thể công khai lịch đã qua và sửa lịch theo các điều kiện còn lại |
| Đăng ký/hủy/xét duyệt/gửi và chấp nhận lời mời trước giờ bắt đầu | Không chặn các thao tác đó chỉ vì giờ bắt đầu |
| Điểm danh trong khoảng hoạt động; QR/mã còn hạn | Không chờ khung giờ và không chặn vì `expires_at`; thay/thu hồi mã vẫn vô hiệu mã cũ |
| Chỉ hoàn thành, chấm điểm, phản hồi và dùng tổng kết khi đã kết thúc theo từng quy tắc | Có thể chuyển Công khai sang Hoàn thành trước giờ kết thúc, rồi chấm/phản hồi/tổng kết nếu đủ điều kiện khác |
| Khám phá/gợi ý loại hoạt động đã bắt đầu; ghép nối xét xung đột lịch đã duyệt | Không loại chỉ vì đã bắt đầu hoặc xung đột lịch đã duyệt |

Chế độ thử **vẫn giữ** xác thực, vai trò/quyền sở hữu, CSRF, trạng thái, sức chứa, tài khoản hợp lệ, đơn Được duyệt, yêu cầu điểm danh, giới hạn điểm, phiên bản và lý do sửa điểm. Hoạt động/mốc chương trình vẫn cần lịch hợp lệ; kết thúc sau bắt đầu, mốc nằm trong hoạt động. Lịch rảnh vẫn kiểm tra dữ liệu.

Ngày giờ vẫn được lưu, hiển thị, lọc và vẽ biểu đồ; nhóm sắp diễn ra/đang diễn ra trên tổng quan vẫn phản ánh lịch thật. Tắt chế độ thử không tự đảo ngược trạng thái Hoàn thành, điểm danh hay điểm đã ghi. Công tắc không thay đổi hạn phiên, token mật khẩu hoặc lịch gửi/nhắc email.

Kiểm thử chuẩn qua `scripts/check.py` tự bật lại chính sách thời gian trong tiến trình kiểm thử. Trình duyệt chuẩn cũng bật kiểm tra; `scripts/test_e2e.py --demo-time activity-time-demo.spec.js` chỉ đổi server kiểm thử trên database tạm. Hướng dẫn chạy và bảo vệ dữ liệu xem [vận hành và sao lưu](VAN_HANH_VA_SAO_LUU.md).

## 9. Migration và triển khai

Không xóa, đổi thứ tự hoặc gộp thủ công migration đã có để dọn tài liệu. Cài frontend theo lockfile (`npm ci`), sao lưu MySQL và media rồi chạy các migration bằng quy trình [vận hành](VAN_HANH_VA_SAO_LUU.md). QR được tạo/quét trong bundle (`qrcode`, `qr-scanner`), không cần dịch vụ QR bên ngoài; hạn chế tần suất nhiều tiến trình cần cache chung.

Hai thay đổi cần đọc kỹ trước khi nâng cấp database cũ:

- `participations.0006_contribution_points` xóa dữ liệu đóng góp/lịch sử/chứng nhận theo giờ rồi chuyển sang điểm, **không quy đổi phút thành điểm** và không đảo ngược bước xóa bằng migration. Tài khoản, hoạt động, đơn, điểm danh, phản hồi và lời mời được giữ để Nhà tổ chức chấm lại. Muốn khôi phục giờ cũ phải dùng bản sao lưu cùng code phù hợp; nhật ký/thông báo cũ giữ đơn vị lúc phát sinh.
- `reports.0007_delete_certificate` gỡ bảng chứng nhận; không ảnh hưởng QR/mã điểm danh. Chi tiết tổng kết hiện tại xem [Báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md).

Tính bảng xếp hạng và đổi công tắc thời gian không cần migration hoặc tiến trình tính điểm riêng. Email nghiệp vụ đi qua hàng đợi và `process_notifications`, phụ thuộc cấu hình SMTP/tùy chọn nhận; không gửi đồng bộ trong yêu cầu web.
