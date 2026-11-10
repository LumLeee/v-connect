# Trạng thái chức năng và cách kiểm thử

Tài liệu mô tả mã nguồn hiện tại và cách kiểm chứng, thay cho các bảng tiến độ theo giai đoạn. Việc gộp tài liệu không phải một lượt chạy kiểm thử mới; các kết quả đã chạy thuộc phiên bản và phạm vi tại thời điểm tương ứng. Xem hướng dẫn cài/chạy tại [README dự án](../README.md) và [mục lục tài liệu](README.md).

## Chức năng hiện có

| Nhóm | Phạm vi đã có | Tài liệu |
|---|---|---|
| Tài khoản | Đăng ký hai vai trò công khai, Admin username, session/CSRF, reset mật khẩu, hồ sơ và avatar; kỹ năng/sở thích/lịch rảnh; khóa/mở khóa có lý do | [Tài khoản và hồ sơ](TAI_KHOAN_VA_HO_SO.md) |
| Hoạt động và tham gia | Nháp/công khai/hoàn thành/hủy; ảnh bìa, timeline, bộ lọc; đăng ký/xét duyệt, lời mời, điểm danh thủ công/QR; phản hồi, điểm đóng góp và xếp hạng | [Hoạt động và tham gia](HOAT_DONG_VA_THAM_GIA.md) |
| Báo cáo và quản trị | Tổng quan theo quyền, số liệu đối chiếu, bộ lọc/biểu đồ, Excel, in/lưu PDF, báo cáo tổng kết, nhật ký trước–sau | [Báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md) |
| Thông báo | Chuông, danh sách/đã đọc, liên kết nghiệp vụ, tùy chọn email, hàng đợi và nhắc lịch | [Thông báo](THONG_BAO.md) |
| AI local | Ghép nối embedding đa ngôn ngữ kết hợp quy tắc; nhãn/chủ đề phản hồi tham khảo và bản nháp báo cáo từ số liệu thật | [AI ghép nối](AI_GHEP_NOI.md), [AI phản hồi và báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md) |
| Giao diện | Website responsive cho khách, Tình nguyện viên, Nhà tổ chức và Admin; menu đóng/mở, lọc danh sách, trạng thái tải/lỗi/rỗng và xác nhận thao tác | [Giao diện](GIAO_DIEN.md) |

Quy trình nghiệp vụ xuyên suốt là: tạo tài khoản → cập nhật hồ sơ → Nhà tổ chức tạo/công khai hoạt động → Tình nguyện viên đăng ký hoặc nhận lời mời → xét duyệt → điểm danh → hoàn thành → phản hồi/chấm điểm → đối chiếu báo cáo. Quyền, sức chứa, trạng thái và dữ liệu phải được kiểm tra ở backend tại mỗi bước.

## Bộ kiểm tra dự án

Chạy từ thư mục gốc sau khi chuẩn bị dependency, MySQL và `.env`:

```powershell
.\.venv\Scripts\python.exe scripts/check.py
```

Runner dừng khi một bước lỗi, gồm:

1. Django system check và `makemigrations --check --dry-run`.
2. Backend tests của tám app trên MySQL kiểm thử riêng.
3. Tests cho công cụ đánh giá AI và các chốt an toàn database/E2E; kiểm tra bảo vệ database chạy trước backend tests.
4. Frontend ESLint và Vite build.

Kiểm tra model/migration không tự áp dụng schema; thiếu migration cần được xử lý đúng quy trình. Build đạt xác minh quá trình đóng gói, không thay thế kiểm thử tương tác. Cảnh báo bundle lớn cần được đọc riêng với lỗi build.

File `test_*.py` nằm trong `backend/apps/<app>/tests/`. Chúng kiểm tra dữ liệu, API, quyền/CSRF, session, transaction, thao tác lặp và các yêu cầu đồng thời. Có thể chạy một nhóm khi thay đổi một nghiệp vụ, ví dụ:

```powershell
.\.venv\Scripts\python.exe backend/manage.py test apps.accounts.tests --noinput
.\.venv\Scripts\python.exe backend/manage.py test apps.participations.tests.test_attendance --noinput
```

`scripts/check.py` chủ động bật kiểm tra thời gian hoạt động. Quy tắc đầy đủ vẫn phải được kiểm chứng kể cả khi cấu hình local đang mở chế độ thử bỏ một số hạn thời gian. Các bài riêng cho chế độ thử xác minh phần nới lỏng được phép và những ràng buộc vẫn còn.

## Kiểm thử trình duyệt

```powershell
.\.venv\Scripts\python.exe scripts/test_e2e.py
```

Runner khởi chạy Django và Vite riêng ở cổng 8001/5174, tạo database MySQL kiểm thử mới, dữ liệu thử và media/email riêng dưới `tmp/e2e-*`. Nó không dùng lại dev server đang chạy. Trước khi kiểm tra, runner áp dụng migration trên database mới và xác minh `seed_data` chạy lặp không đổi danh mục. Playwright mặc định chạy Chrome headless ở desktop 1280 × 900 và màn hình hẹp 390 × 844.

Chạy nhóm phù hợp để kiểm tra một thay đổi, ví dụ:

```powershell
.\.venv\Scripts\python.exe scripts/test_e2e.py profile.spec.js notifications.spec.js
.\.venv\Scripts\python.exe scripts/test_e2e.py --demo-time
```

`--demo-time` chọn chế độ thử thời gian cho E2E, không đổi cấu hình `.env` của ứng dụng. Cơ chế mô phỏng giờ theo request của runner chỉ hoạt động khi đúng database test và khóa ngẫu nhiên, được cô lập giữa các luồng. Không thay đồng hồ Windows/MySQL hoặc thêm API điều khiển giờ vào website thật.

Bộ E2E có cả luồng React–Django–MySQL thật và các bài giao diện chủ động giả lập response để kiểm tra lỗi mạng, chờ tải, thao tác trùng, dữ liệu rỗng hoặc giá trị biên. Cần phân biệt hai loại khi báo kết quả: một bài mock API không chứng minh nghiệp vụ database đã chạy. Với thay đổi số đếm, quyền hoặc trạng thái, phải đối chiếu API/danh sách thật tương ứng.

Sau kiểm tra giao diện, xem ảnh desktop/màn hình hẹp và các độ rộng liên quan; lint hoặc ảnh chụp đơn lẻ không chứng minh mọi thao tác dùng được. Khi bài test lỗi do locator hoặc dữ liệu chuẩn bị, sửa bài test rồi chạy lại trường hợp bị ảnh hưởng; chỉ báo đạt những ca đã chạy thành công.

## Bảo vệ database kiểm thử

Đã từng có sự cố script hỗ trợ xóa nhầm database ứng dụng vì gọi `destroy_test_db` khi connection còn trỏ vào database thật. Database được khôi phục từ binary log. Bài học được giữ trong quy trình hiện tại:

- `DB_TEST_NAME` khác `DB_NAME` kể cả hoa/thường, bắt đầu bằng `test_`, chỉ có chữ ASCII/số/gạch dưới, tối đa 64 ký tự. Cả `manage.py test`, `scripts/check.py` và E2E dùng lớp tạo database MySQL được bảo vệ tại `backend/config/db/creation.py`.
- Lệnh `CREATE DATABASE` phải tạo mới thành công; schema có sẵn hoặc xuất hiện do lượt chạy đồng thời đều làm kiểm thử dừng, không hỏi xóa, tự xóa/tạo lại hoặc dùng lại dữ liệu. `--noinput` không bỏ qua chốt này. Không hỗ trợ `--keepdb` hoặc nhiều worker/bản sao database.
- Database mới có dấu sở hữu ngẫu nhiên của lượt chạy trong bảng kỹ thuật `vconnect_test_owner`. Trước dọn, tên phải khớp **cả connection và settings**, cấu hình máy chủ/tài khoản/OPTIONS phải giữ nguyên, dấu sở hữu cũng phải khớp. Connection khác hoặc schema đã bị thay thế không được xóa. Lỗi trong migration/setup chỉ dọn schema có thể xác minh thuộc lượt chạy đó; nếu không xác minh được thì giữ lại và báo lỗi.
- Runner đóng đúng tiến trình do mình tạo; khối `finally` lồng nhau bảo đảm lỗi dừng frontend không bỏ qua bước dọn backend/database.
- Các chốt bảo vệ được kiểm tra bằng `scripts/test_database_safety.py` và `scripts/test_e2e_safety.py`, gồm xung đột lúc tạo, từ chối tái sử dụng database và từ chối cleanup khi connection/cấu hình/dấu sở hữu không khớp.

Không chạy hai runner cùng chiếm các cổng/database test. Khi lượt chạy bị ngắt, xác định tiến trình và connection thực tế trước khi dọn; không dùng lệnh xóa rộng hoặc script dọn tùy tiện. Dump, email thử, ảnh người dùng, token và bằng chứng phục hồi chỉ lưu ở nơi riêng được Git bỏ qua. Xem [vận hành và sao lưu](VAN_HANH_VA_SAO_LUU.md).

## Nâng cấp schema và kiểm chứng dữ liệu

Trước migration có dữ liệu thật, tạo snapshot database và media, kiểm tra tính toàn vẹn, đọc migration mới và đối chiếu dữ liệu liên quan trước/sau. Thử cài schema từ database mới giúp phát hiện dependency sai; chỉ thử trên database riêng.

Không đổi tên migration đã áp dụng để sửa thứ tự số. Migration tài khoản có dependency `0001 → 0003 → 0002`; Django xử lý theo dependency. Không dùng `--fake`, rollback hoặc xóa bảng để né lỗi mà chưa hiểu trạng thái dữ liệu. Các điểm chuyển định danh và model lịch sử được giải thích tại [kiến trúc](KIEN_TRUC.md) và [tài khoản](TAI_KHOAN_VA_HO_SO.md).

Snapshot có hash hợp lệ chỉ chứng minh file chưa hỏng, chưa chứng minh có thể khôi phục ứng dụng. Diễn tập restore phải thực hiện trên database/media riêng rồi kiểm tra schema, dữ liệu và đăng nhập trước khi có quyết định thay môi trường đang dùng.

## Giới hạn cần giữ rõ

Ứng dụng đã có nghiệp vụ và AI hỗ trợ, nhưng kết quả kiểm thử local không phải chứng nhận production hoặc cam kết không còn lỗi. SMTP thật, hosting/HTTPS, lưu file bên ngoài, cache chung, tải lớn và diễn tập khôi phục cần được xác minh trong môi trường triển khai cụ thể. Chưa có số đo tải để khẳng định sức phục vụ số người dùng lớn.

Địa điểm hiện là địa chỉ văn bản; chưa có danh mục tọa độ/bản đồ/chỉ đường. Lịch rảnh chưa có ngoại lệ theo từng ngày; điểm danh chưa có check-out. Điểm đóng góp không phải số giờ, và hệ thống không quản lý quyên góp tài chính. Chứng nhận/chứng chỉ đã được loại khỏi phạm vi.

AI dùng model embedding local, có dự phòng; nhãn phản hồi và trích dẫn chỉ hỗ trợ người xem. Bản nháp báo cáo không dùng mô hình sinh văn bản, không tự phát hành. Bộ dữ liệu đánh giá tổng hợp và kết quả JSON được giữ để tái lập phép đo, không được gọi là độ chính xác vận hành. Đọc giới hạn và lệnh đánh giá ở hai tài liệu AI chuyên biệt trước khi diễn giải kết quả.
