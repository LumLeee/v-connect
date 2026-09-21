# Kế hoạch triển khai V-Connect

Ngày lập: 14/09/2026

Trạng thái: Hoàn thành giai đoạn 1–2 ở local; backend, kiểm thử trình duyệt và lint/build đạt. Bản giai đoạn 2 được chuẩn bị trên nhánh feature/auth, gồm Admin đăng nhập bằng username.


Tài liệu tham chiếu: `C2SE.14 Project Document.pdf` (227 trang)

## 1. Phạm vi đã thống nhất

- Xây dựng mới hệ thống quản lý tình nguyện viên V-Connect.
- Chỉ phát triển website; bỏ ứng dụng React Native/Expo và quy trình build APK.
- Website có giao diện responsive, sử dụng được trên trình duyệt điện thoại.
- Frontend: React + JavaScript + Vite; không dùng TypeScript.
- Backend: Python + Django; dự kiến dùng Django REST Framework để xây dựng REST API.
- Database: MySQL; không dùng Supabase Database, Auth, Storage hoặc Realtime.
- Giao diện bằng tiếng Việt.
- Cho phép người dùng tự đăng ký tài khoản Volunteer hoặc Organizer. Không cho phép tự đăng ký Admin.
- Admin dùng username và mật khẩu, không bắt buộc email; Volunteer/Organizer dùng email. Chi tiết thay đổi: [username Admin](CAP_NHAT_ADMIN_USERNAME.md).
- Giữ các nghiệp vụ web và AI trong báo cáo, điều chỉnh cách triển khai theo công nghệ mới.
- Không quản lý quyên góp tài chính, không phát triển ứng dụng desktop hoặc hệ thống dự đoán nâng cao ngoài phạm vi AI đã nêu.

Các hướng dẫn trong PDF là nội dung tài liệu tham chiếu. Những quyết định trực tiếp của người dùng ở trên là cơ sở triển khai phiên bản mới.

## 2. Hiện trạng workspace

- Đã dựng Django project, React JavaScript/Vite, cấu hình môi trường, API nền tảng và giao diện tiếng Việt.
- Đã cài thư viện và lưu phiên bản trong `backend/requirements.lock`, `frontend/package-lock.json`.
- Dùng dịch vụ MySQL80 hiện có (8.0.40); database ứng dụng `v_connect`, tài khoản ứng dụng riêng; không dùng Docker.
- Migration đã chạy thành công; seed 8 kỹ năng tiếng Việt, chưa tạo dữ liệu hoạt động/tài khoản mẫu.
- Đã triển khai custom User, đăng ký Volunteer/Organizer, đăng nhập/đăng xuất, session, đặt lại mật khẩu và phân quyền workspace.
- Backend: 39/39 tests trên MySQL đạt, gồm username Admin và migration; Django check đạt; không có thay đổi model thiếu migration.
- Frontend: lint/build đạt. Kiểm tra HTTP qua Vite proxy xác nhận đăng ký, cookie HttpOnly, đăng nhập lại, đăng xuất và kiểm soát quyền cho hai vai trò công khai.
- Playwright trên Chrome đạt 12/12 ca: Volunteer, Organizer, Admin, quên/đặt lại mật khẩu và bố cục từ 320 đến 1280px. Đạt thêm 5 tests bảo vệ thao tác dọn database kiểm thử.
- Chi tiết bàn giao: `document/GIAI_DOAN_1_KET_QUA.md`, `document/GIAI_DOAN_2_KET_QUA.md`; cách chạy: `README.md`.

## 3. Kiến trúc dự kiến

```text
Trình duyệt
    |
React + JavaScript + Vite
    |
REST API
    |
Django + Django REST Framework
    |-- Tài khoản và phân quyền
    |-- Hồ sơ và danh mục kỹ năng
    |-- Hoạt động và timeline
    |-- Đăng ký, xét duyệt và điểm danh
    |-- Phản hồi, thông báo và báo cáo
    |-- Điều phối AI và phương án dự phòng
    |
    |-- MySQL
    |-- Nơi lưu ảnh/file
    |-- Dịch vụ email
    `-- Dịch vụ AI bên ngoài nếu được cấu hình
```

Backend được tổ chức thành các Django app theo nghiệp vụ, triển khai chung trong một ứng dụng trước. Frontend chỉ truy cập dữ liệu qua API; không kết nối trực tiếp MySQL. Bắt đầu với thông báo lấy qua API, chỉ bổ sung cập nhật trực tiếp khi có nhu cầu cụ thể.

### Cấu trúc thư mục mục tiêu

```text
V-connect/
|-- backend/
|   |-- config/
|   |-- apps/
|   |   |-- accounts/
|   |   |-- activities/
|   |   |-- participations/
|   |   |-- feedback/
|   |   |-- notifications/
|   |   |-- reports/
|   |   `-- recommendations/
|   |-- manage.py
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- api/
|   |   |-- components/
|   |   |-- layouts/
|   |   |-- pages/
|   |   |-- hooks/
|   |   `-- styles/
|   `-- package.json
|-- document/
`-- README.md
```

## 4. Các giai đoạn thực hiện

Thực hiện theo thứ tự dưới đây. Chỉ đánh dấu hoàn thành khi có sản phẩm chạy được và kết quả kiểm tra tương ứng. Chưa chốt lịch theo ngày vì chưa có thời hạn bàn giao hoặc số người triển khai.

### Giai đoạn 1: Nền tảng dự án và môi trường

- [x] Kiểm tra lại thư viện đã cài và tạo lockfile để tái lập môi trường.
- [x] Khởi tạo Django project và các app nền tảng.
- [x] Khởi tạo React JavaScript với Vite, routing, bố cục và stylesheet chung.
- [x] Chuẩn bị `.env.example`, cấu hình chung `backend/config/settings.py` và tách thông tin bí mật khỏi mã nguồn.
- [x] Xác nhận cách chạy MySQL: dịch vụ MySQL80 hiện có, theo lựa chọn người dùng.
- [x] Tạo database, tài khoản ứng dụng và cấu hình kết nối; dùng UTF-8 phù hợp cho tiếng Việt.
- [x] Thiết lập migration, dữ liệu mẫu (danh mục kỹ năng) và lệnh khởi động.
- [x] Thiết lập API health check, cấu trúc lỗi, phân trang, proxy development và logging cơ bản.
- [x] Viết README hướng dẫn cài đặt và chạy trên Windows.

**Tiêu chí hoàn thành:** frontend gọi được API backend; backend kết nối MySQL; migration chạy thành công trên database mới; không có dependency Supabase hoặc TypeScript trong ứng dụng.

### Giai đoạn 2: Tài khoản, xác thực và phân quyền

- [x] Tạo custom User model; Volunteer/Organizer dùng email, Admin dùng username và không bắt buộc email.
- [x] Cho phép đăng ký Volunteer/Organizer; backend chỉ chấp nhận hai vai trò này từ luồng đăng ký công khai.
- [x] Xây dựng đăng nhập, đăng xuất, thông tin người dùng hiện tại và quản lý phiên.
- [x] Dùng cơ chế hash mật khẩu và kiểm tra độ mạnh mật khẩu của Django.
- [x] Xây dựng quên/đặt lại mật khẩu qua liên kết có thời hạn.
- [x] Cấu hình gửi email; dùng console email khi chưa có SMTP; kiểm thử gửi email trong bộ nhớ.
- [x] Hỗ trợ và kiểm thử lệnh tạo Admin; không tạo tài khoản/mật khẩu mặc định và không cấp quyền quản trị từ đăng ký công khai.
- [x] Kiểm tra quyền tại API: vai trò, trạng thái tài khoản và `/me` chỉ trả dữ liệu của phiên hiện tại. Quyền sở hữu hoạt động/hồ sơ chi tiết sẽ triển khai cùng các tài nguyên đó.
- [x] Xây dựng màn hình xác thực tiếng Việt và điều hướng theo vai trò; lint/build đạt.
- [x] Kiểm thử đăng nhập sai, email trùng, phiên hết hạn, tài khoản bị khóa và truy cập trái quyền.
- [x] Hoàn tất kiểm tra trình duyệt và ảnh giao diện: đăng ký/đăng xuất/đăng nhập Volunteer, Organizer, Admin, quên/đặt lại mật khẩu và bố cục hẹp.

**Tiêu chí hoàn thành:** người dùng tự đăng ký hai vai trò đã chốt và vào đúng khu vực; sửa request hoặc URL không vượt được quyền truy cập.

**Lựa chọn kỹ thuật đã thực hiện:** phiên Django qua cookie HttpOnly, kiểm tra CSRF cả trước đăng nhập; frontend gọi cùng origin thông qua Vite proxy. Không tách file cấu hình theo môi trường.

### Giai đoạn 3: Hồ sơ và dữ liệu nền

- [ ] Quản lý thông tin cơ bản, avatar và hồ sơ Organizer.
- [ ] Xây dựng danh mục kỹ năng, sở thích và quan hệ với tình nguyện viên.
- [ ] Quản lý lịch rảnh và dữ liệu cần thiết cho ghép nối.
- [ ] Upload ảnh với giới hạn kích thước, kiểm tra định dạng và phân quyền.
- [ ] Xác định nơi lưu file development/production; database lưu đường dẫn và metadata.
- [ ] Chuẩn bị danh mục địa điểm và dữ liệu mẫu có nguồn gốc rõ ràng.
- [ ] Tạo API và giao diện chỉnh sửa hồ sơ.


**Tiêu chí hoàn thành:** hồ sơ lưu và tải lại đúng; người dùng không sửa được hồ sơ người khác; kỹ năng và lịch rảnh sẵn sàng cho đề xuất.



### Giai đoạn 4: Hoạt động, trang công khai và timeline

- [ ] Tạo trang chủ, giới thiệu, danh sách và chi tiết hoạt động công khai.
- [ ] Tìm kiếm, lọc và phân trang hoạt động.
- [ ] Organizer tạo/sửa hoạt động với tên, mô tả, thời gian, địa điểm, sức chứa và kỹ năng yêu cầu.
- [ ] Quản lý vòng đời nháp, công khai, hoàn thành, hủy; quy định rõ chuyển trạng thái hợp lệ.
- [ ] Quản lý các mốc timeline và hiển thị timeline cho người tham gia.
- [ ] Lưu địa chỉ, tọa độ, hiển thị bản đồ và liên kết chỉ đường; xử lý khi dịch vụ địa lý không hoạt động.
- [ ] Guest chỉ xem nội dung công khai; yêu cầu đăng nhập khi thực hiện hành động riêng tư.
- [ ] Kiểm tra ngày kết thúc sau ngày bắt đầu, sức chứa hợp lệ và quyền sở hữu hoạt động.

**Tiêu chí hoàn thành:** Organizer tạo và công khai được hoạt động; Guest/Volunteer tìm và xem được; hoạt động nháp không lộ qua API công khai.

### Giai đoạn 5: Đăng ký, xét duyệt và lịch sử tham gia

- [ ] Volunteer đăng ký/hủy đăng ký theo điều kiện của hoạt động.
- [ ] Organizer xem danh sách đăng ký và duyệt/từ chối người tham gia.
- [ ] Xác định và thực thi sơ đồ chuyển trạng thái đăng ký.
- [ ] Chống đăng ký trùng và vượt sức chứa, kể cả khi có yêu cầu đồng thời.
- [ ] Kiểm tra lịch trùng và điều kiện tham gia theo quy tắc đã chốt.
- [ ] Hiển thị hoạt động của tôi, trạng thái xét duyệt và lịch sử đóng góp.
- [ ] Tạo thông báo khi trạng thái đăng ký hoặc hoạt động thay đổi.

**Tiêu chí hoàn thành:** chạy được luồng đăng ký → xét duyệt → xem trạng thái; Organizer không duyệt được đơn thuộc hoạt động của người khác.

### Giai đoạn 6: Điểm danh trên web

- [ ] Chốt hướng quét QR: Organizer quét mã của Volunteer hoặc Volunteer quét mã hoạt động.
- [ ] Xây dựng mã điểm danh có thời hạn và luồng nhập mã dự phòng.
- [ ] Kiểm tra người tham gia đã được duyệt, đúng hoạt động và đúng khoảng thời gian.
- [ ] Chống điểm danh trùng và xử lý mã hết hạn/không hợp lệ.
- [ ] Lưu thời điểm điểm danh; bổ sung check-out nếu được chọn làm cơ sở tính giờ tham gia.
- [ ] Cho phép Organizer xác nhận thủ công theo quyền và ghi nhận người thực hiện.
- [ ] Hiển thị trạng thái điểm danh và cập nhật lịch sử tham gia.

**Tiêu chí hoàn thành:** điểm danh thực hiện được qua website; mã sai/hết hạn và người chưa đủ điều kiện bị từ chối; thao tác lặp không tạo thêm lượt tham gia.

### Giai đoạn 7: Phản hồi và thông báo

- [ ] Volunteer gửi đánh giá và phản hồi khi đủ điều kiện sau hoạt động.
- [ ] Ràng buộc phản hồi với bản ghi tham gia, hạn chế phản hồi trùng.
- [ ] Organizer xem phản hồi của hoạt động mình quản lý; Admin kiểm duyệt trên toàn hệ thống.
- [ ] Chuẩn hóa bộ nhãn cảm xúc và cách ghi nhận sự cố, tránh mâu thuẫn giữa các phần báo cáo cũ.
- [ ] Cho phép đánh dấu spam, loại spam khỏi thống kê và ghi nhận chỉnh sửa của người kiểm duyệt.
- [ ] Xây dựng danh sách thông báo, trạng thái đã đọc và liên kết đến đối tượng liên quan.
- [ ] Không cho phép đọc/xóa thông báo của người khác.

**Tiêu chí hoàn thành:** phản hồi hợp lệ được lưu; thống kê bỏ qua spam; thông báo đúng người và điều hướng đúng nội dung.

### Giai đoạn 8: Đề xuất và xử lý AI

- [ ] Xây dựng bộ lọc điều kiện tham gia trước khi xếp hạng.
- [ ] Làm baseline đề xuất theo kỹ năng, lịch rảnh, sở thích và lịch sử; trả điểm và lý do đề xuất.
- [ ] Hỗ trợ hai chiều: đề xuất hoạt động cho Volunteer và tình nguyện viên cho Organizer.
- [ ] Lưu lần hiển thị đề xuất, dữ liệu đặc trưng và sự kiện tương tác phục vụ đánh giá.
- [ ] Bổ sung embedding hoặc mô hình ML sau khi có dữ liệu đánh giá phù hợp.
- [ ] Phân loại phản hồi và hỗ trợ phát hiện sự cố/spam theo bộ nhãn đã thống nhất.
- [ ] Tóm tắt hoạt động dựa trên dữ liệu tham gia và phản hồi hợp lệ.
- [ ] Tách điều phối AI khỏi nghiệp vụ; bổ sung dịch vụ AI bên ngoài khi đã có cấu hình.
- [ ] Thiết lập timeout, giới hạn gọi, cache và xử lý dự phòng khi AI bên ngoài lỗi.
- [ ] Ghi rõ nguồn kết quả: quy tắc, mô hình nội bộ hoặc dịch vụ bên ngoài; không gọi baseline quy tắc là mô hình đã huấn luyện.
- [ ] Tạo bộ dữ liệu đánh giá và đo chất lượng, thời gian đáp ứng; không ghi mục tiêu thành kết quả thực nghiệm.

**Tiêu chí hoàn thành:** đề xuất có giải thích và tuân thủ điều kiện tham gia; dữ liệu ít hoặc dịch vụ AI lỗi không làm hỏng nghiệp vụ; có kết quả đánh giá thực tế.

### Giai đoạn 9: Dashboard, báo cáo và quản trị

- [ ] Dashboard riêng cho Volunteer, Organizer và Admin.
- [ ] Tổng hợp số hoạt động, đăng ký, người đã điểm danh và phản hồi từ database.
- [ ] Báo cáo sau hoạt động gồm thống kê và nội dung tổng hợp AI có thể rà soát.
- [ ] Xuất/in báo cáo và xuất dữ liệu theo quyền truy cập.
- [ ] Admin quản lý người dùng, vai trò, trạng thái tài khoản và giám sát hoạt động/đăng ký/phản hồi.
- [ ] Ghi lịch sử các thao tác nhạy cảm: thay vai trò, khóa tài khoản, xét duyệt và điểm danh thủ công.
- [ ] Đối chiếu các yêu cầu phụ trong User Story như quyền chi tiết, mẫu báo cáo/chứng nhận và câu chuyện tác động để xác định phần cần triển khai tiếp.

**Tiêu chí hoàn thành:** dashboard dùng dữ liệu thật, số liệu thống nhất với danh sách chi tiết; dữ liệu xuất đúng phạm vi quyền của người dùng.

### Giai đoạn 10: Kiểm thử, triển khai và đồng bộ tài liệu

- [ ] Chạy kiểm thử backend trên MySQL, bao gồm transaction và ràng buộc dữ liệu.
- [ ] Kiểm thử các luồng xuyên suốt Guest, Volunteer, Organizer và Admin.
- [ ] Kiểm thử phân quyền, CSRF/session, upload, mật khẩu và khả năng truy cập dữ liệu qua ID đoán được.
- [ ] Kiểm tra các trường hợp cạnh tranh như duyệt chỗ cuối và điểm danh lặp.
- [ ] Chạy frontend lint/build và kiểm tra giao diện trên desktop/trình duyệt điện thoại.
- [ ] Kiểm tra lỗi mạng, database hoặc AI; bổ sung thông báo lỗi và trạng thái rỗng/loading rõ ràng.
- [ ] Cấu hình production: HTTPS, cookie, static/media, email, logging và biến môi trường.
- [ ] Chuẩn bị backup/restore MySQL và hướng dẫn vận hành.
- [ ] Chạy migration từ database rỗng và kiểm tra khả năng tái lập dự án theo README.
- [ ] Ghi kết quả kiểm thử mới, các lỗi còn lại và giới hạn thực tế.
- [ ] Cập nhật báo cáo theo stack mới và phạm vi web-only.

**Tiêu chí hoàn thành:** người khác có thể dựng hệ thống theo tài liệu; các luồng chính chạy được; kết quả kiểm thử phản ánh đúng phiên bản mới.

## 5. Thiết kế dữ liệu cần thực hiện

| Nhóm dữ liệu | Hướng triển khai |
|---|---|
| Tài khoản | Custom Django User, email duy nhất, vai trò và trạng thái tài khoản |
| Hồ sơ | Thông tin tình nguyện viên/Organizer, avatar, kỹ năng, sở thích và lịch rảnh |
| Kỹ năng/sở thích | Bảng danh mục và bảng liên kết thay cho `TEXT[]` trong PostgreSQL |
| Hoạt động | Organizer, nội dung, thời gian, địa điểm, sức chứa và trạng thái |
| Timeline | Các mốc thuộc hoạt động, thời gian và mô tả |
| Tham gia | Cặp hoạt động/tình nguyện viên duy nhất, trạng thái xét duyệt và điểm danh |
| Phản hồi | Liên kết tham gia, điểm đánh giá, nội dung và trạng thái kiểm duyệt |
| Báo cáo | Số liệu và bản tổng hợp theo hoạt động, thời điểm tạo/cập nhật |
| Thông báo | Người nhận, nội dung, đối tượng liên quan và thời điểm đọc |
| Đề xuất AI | Kết quả xếp hạng, lý do, phiên bản thuật toán và lịch sử tương tác |
| Audit log | Người thực hiện, hành động, đối tượng và thời điểm |

Các trường `JSONB` cũ được đánh giá để chuyển thành `JSONField` hoặc bảng quan hệ; không sao chép nguyên schema PostgreSQL. Dùng Django migrations để quản lý schema. Chuẩn hóa lưu thời gian và hiển thị theo `Asia/Ho_Chi_Minh`. Vì xây mới từ đầu, chưa có yêu cầu chuyển dữ liệu hoặc tài khoản từ Supabase.

## 6. Các mốc bàn giao

| Mốc | Nội dung | Phụ thuộc |
|---|---|---|
| M1 | Dự án chạy được với MySQL; đăng ký/đăng nhập và phân quyền | Giai đoạn 1–2 |
| M2 | Hồ sơ, hoạt động công khai và quản lý hoạt động | M1, giai đoạn 3–4 |
| M3 | Đăng ký, xét duyệt, điểm danh, phản hồi và thông báo | M2, giai đoạn 5–7 |
| M4 | Đề xuất, phân tích phản hồi, dashboard và báo cáo | M3, giai đoạn 8–9 |
| M5 | Bản kiểm thử, cấu hình triển khai và tài liệu bàn giao | M4, giai đoạn 10 |

## 7. Các điểm cần hỏi trước khi triển khai phần phụ thuộc

Không cần hỏi lại các quyết định đã chốt ở mục 1. Những điểm dưới đây chỉ cần làm rõ khi đến chức năng tương ứng; vẫn tiếp tục công việc độc lập trong lúc chờ.

| Điểm chưa chốt | Đề xuất ban đầu | Khi cần xác nhận |
|---|---|---|
| Kết nối MySQL (đã chốt) | Dùng MySQL80 hiện có; đã provision `v_connect` và xác minh kết nối | Hoàn tất ở giai đoạn 1 |
| Điểm danh QR | Có nhập mã dự phòng; cần chọn hướng quét phù hợp vận hành | Trước giai đoạn 6 |
| Cách tính giờ đóng góp | Chọn tính theo check-in/out hoặc thời lượng được Organizer xác nhận | Trước khi xây thống kê giờ |
| Nhãn phản hồi | Cảm xúc: tích cực/trung tính/tiêu cực; spam và sự cố là thuộc tính riêng | Trước giai đoạn 7–8 |
| Dịch vụ email và AI | Chạy local với console email và baseline nội bộ trước | Khi cần gửi email thật hoặc gọi AI bên ngoài |
| Yêu cầu quản trị nâng cao | Làm rõ quyền chi tiết, mẫu chứng nhận/báo cáo và nội dung tác động trong User Story | Trước khi chốt phạm vi M4 |
| Hosting, domain, hạn bàn giao | Chưa giả định nhà cung cấp hoặc ngày hoàn thành | Trước triển khai production/lập lịch cụ thể |

Không đưa mật khẩu database hoặc API key vào file kế hoạch; dùng biến môi trường cục bộ.

## 8. Đồng bộ với báo cáo gốc

- [ ] Proposal/phạm vi: thay web + mobile bằng website responsive.
- [ ] Technology stack: React JavaScript + Vite, Django và MySQL.
- [ ] Kiến trúc: bỏ Mobile App và Supabase; thể hiện auth, file, email và AI trong hệ thống mới.
- [ ] Database Design: cập nhật bảng, kiểu dữ liệu, khóa và quan hệ.
- [ ] User Story/Product Backlog/Sprint Backlog: chuyển nghiệp vụ mobile cần giữ sang web, bỏ công việc Expo/APK.
- [ ] UI Design: chỉ giữ màn hình web và bổ sung bố cục responsive.
- [ ] Code Standard: JavaScript/React và Python/Django.
- [ ] Test Plan/Test Report: lập và chạy lại cho hệ thống mới; không sử dụng tỷ lệ 98,55% cũ làm kết quả mới.
- [ ] Tài liệu AI: phân biệt mục tiêu, baseline và kết quả đo; thống nhất bộ nhãn phản hồi.
- [ ] Reflection/biên bản cũ: giữ đúng lịch sử; ghi thay đổi mới riêng, không sửa lịch sử thành công việc chưa thực hiện.

## 9. Việc ưu tiên ở lượt viết code tiếp theo

1. Xây dựng hồ sơ cơ bản, avatar và hồ sơ Nhà tổ chức.
2. Bổ sung kỹ năng, sở thích, lịch rảnh và kiểm thử quyền sở hữu dữ liệu.

## 10. Quy tắc cập nhật tiến độ

- Đánh dấu `[x]` khi đã triển khai và xác minh; không đánh dấu chỉ vì đã tạo file hoặc mô tả thiết kế.
- Mỗi mốc bàn giao ghi ngắn gọn: chức năng chạy được, kiểm thử đã chạy, lỗi/giới hạn và việc còn lại.
- Khi có thay đổi phạm vi, cập nhật mục 1 và các checklist bị ảnh hưởng.
- Nếu thiếu thông tin nghiệp vụ hoặc lựa chọn ảnh hưởng lớn, hỏi người dùng trước khi thực hiện phần phụ thuộc.
