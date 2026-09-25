# Kế hoạch triển khai V-Connect

Ngày lập: 14/09/2026. Điều chỉnh phạm vi: 22/09/2026. Cập nhật tiến độ: 25/09/2026.

## 1. Hướng thực hiện đã thống nhất

Hoàn thành các chức năng nghiệp vụ chính để chạy được một quy trình tình nguyện đầy đủ. Sau khi kiểm tra đạt quy trình này mới bổ sung chức năng phụ và AI.

Người dùng đã xác nhận ba chức năng AI — gợi ý ghép nối, phân loại phản hồi và tóm tắt hoạt động — thực hiện sau nghiệp vụ chính. Các chức năng chuyển sang đợt sau vẫn thuộc định hướng dự án, chưa bị loại bỏ.

- Website tiếng Việt, responsive; không xây ứng dụng điện thoại riêng.
- React JavaScript + Vite, Django REST Framework, MySQL80 hiện có; dùng một file cấu hình Django và `.env` cho thông tin bí mật.
- Volunteer/Organizer tự đăng ký bằng email. Admin dùng username và mật khẩu, email không bắt buộc; không đăng ký Admin qua form công khai.
- Làm dự án một mình, hoàn thành từng luồng trước khi chuyển sang luồng tiếp theo.
- Giữ nguyên chức năng đã hoàn thành, kể cả avatar và đặt lại mật khẩu; không xóa code để thu hẹp kế hoạch.
- Phân quyền, kiểm tra dữ liệu, chống thao tác trùng và kiểm thử đi cùng từng chức năng chính, không dời sang đợt phụ.
- Không quản lý quyên góp tài chính, không xây ứng dụng desktop hoặc mô hình dự đoán nâng cao ngoài phạm vi đã thống nhất.

Tham chiếu: `C2SE.14 Project Document.pdf`. Quyết định của người dùng là cơ sở xác định phạm vi. Giữ số giai đoạn 1–10 để đối chiếu lịch sử, nhưng sắp xếp lại nội dung tương lai theo hai đợt bên dưới.

## 2. Tiến độ hiện tại

| Phần | Trạng thái thực tế |
|---|---|
| Giai đoạn 1: nền tảng | Hoàn thành, đã có trên GitHub |
| Giai đoạn 2: tài khoản và phân quyền | Đã đẩy lên `feature/auth`, commit `0efe855`, ngày 21/09/2026; gồm Admin dùng username |
| Giai đoạn 3: hồ sơ cơ bản, avatar và hồ sơ Organizer | Hoàn thành theo phạm vi mới; bàn giao trên `feature/profile`, kế thừa giai đoạn 2 |
| Giai đoạn 4: quản lý và xem hoạt động | Đã đẩy lên `feature/activities`, commit `11cfc7c` |
| Giai đoạn 5: đăng ký và xét duyệt | Đã đẩy lên `feature/participations`, commit `eb623f5`, ngày 25/09/2026 |
| Giai đoạn 6: điểm danh cơ bản | Đã đẩy lên `feature/attendance`, commit `91c53e5`, ngày 25/09/2026 |
| Giai đoạn 7: phản hồi cơ bản | Hoàn thành; bàn giao trên `feature/feedback` ngày 25/09/2026 |
| Thống kê và quản trị nghiệp vụ | Chưa triển khai; Django Admin và trang workspace đã có chưa thay thế dashboard nghiệp vụ |
| Chức năng phụ và AI | Xếp sau đợt nghiệp vụ chính |

Bản giai đoạn 2 đạt 39 tests backend, 12 ca Playwright, 5 tests bảo vệ database và lint/build. Bản local gồm hồ sơ đạt 48 tests backend khi kiểm tra ngày 21/09/2026. Đây là kết quả các lượt trước, không phải kiểm chứng chức năng chưa triển khai.

Giữ nguyên tài liệu lịch sử: [giai đoạn 1](GIAI_DOAN_1_KET_QUA.md), [giai đoạn 2](GIAI_DOAN_2_KET_QUA.md), [hồ sơ cơ bản](GIAI_DOAN_3_CONG_VIEC_1_KET_QUA.md), [username Admin](CAP_NHAT_ADMIN_USERNAME.md).

## 3. Đợt 1 — Chức năng chính

Luồng cần hoàn thành:

**Đăng ký/đăng nhập → cập nhật hồ sơ → Organizer tạo và công khai hoạt động → Volunteer xem và đăng ký → Organizer xét duyệt → điểm danh → phản hồi → xem kết quả hoạt động.**

Admin quản lý tài khoản và giám sát dữ liệu theo quyền. Guest chỉ xem hoạt động công khai.

### Giai đoạn 1: Nền tảng — đã hoàn thành

- [x] Dựng frontend, backend và kết nối MySQL.
- [x] Chuẩn bị cấu hình, migration, danh mục kỹ năng ban đầu và hướng dẫn chạy.
- [x] Có API kiểm tra kết nối, cấu trúc lỗi và phân trang.

### Giai đoạn 2: Tài khoản và phân quyền — đã hoàn thành

- [x] Đăng ký Volunteer/Organizer; đăng nhập, đăng xuất và quản lý phiên.
- [x] Admin dùng username, không bắt buộc email.
- [x] Thông tin tài khoản hiện tại và khu vực đúng vai trò.
- [x] Quên/đặt lại mật khẩu cho tài khoản công khai; giữ chức năng đã làm.
- [x] Kiểm tra mật khẩu, CSRF, tài khoản bị khóa và truy cập trái quyền.

Email được kiểm thử cục bộ; chưa xác minh SMTP thật. Không coi việc đã có chức năng đặt lại mật khẩu là đã cấu hình gửi email thật.

### Giai đoạn 3: Hồ sơ tối thiểu — hoàn thành theo phạm vi mới

- [x] Xem/sửa họ tên, số điện thoại và giới thiệu của chính mình.
- [x] Organizer cập nhật tên tổ chức, mô tả, website và địa chỉ liên hệ.
- [x] Giữ chức năng tải lên, xem và xóa avatar đã làm.
- [x] Kiểm tra quyền sở hữu, dữ liệu đầu vào và lưu/tải lại qua API và giao diện.

**Tiêu chí:** tài khoản có thông tin liên hệ cần thiết và chỉ sửa được hồ sơ của mình.

Kỹ năng, sở thích, lịch rảnh, địa điểm và mở rộng lưu trữ chuyển sang đợt 2. Danh mục kỹ năng đã seed được giữ; chưa có liên kết kỹ năng với hồ sơ. Thu hẹp phạm vi không có nghĩa các công việc chuyển đi đã hoàn thành.

### Giai đoạn 4: Quản lý và xem hoạt động — đã đẩy GitHub

- [x] Organizer tạo/sửa hoạt động: tên, mô tả, thời gian bắt đầu/kết thúc, địa chỉ dạng văn bản và sức chứa.
- [x] Quản lý trạng thái nháp, công khai, hoàn thành, hủy; chỉ chuyển trạng thái hợp lệ.
- [x] Organizer xem danh sách và chi tiết hoạt động của mình.
- [x] Guest/Volunteer xem hoạt động công khai; tìm kiếm theo tên và phân trang.
- [x] Kiểm tra thời gian, sức chứa và quyền sở hữu; không lộ hoạt động nháp.

**Tiêu chí:** Organizer tạo và công khai được hoạt động; Volunteer tìm và xem được để đăng ký. Chưa phụ thuộc bản đồ, timeline, ảnh hoạt động hoặc ghép nối kỹ năng.

### Giai đoạn 5: Đăng ký và xét duyệt tham gia — hoàn thành

- [x] Volunteer đăng ký/hủy đăng ký theo trạng thái và thời hạn cho phép.
- [x] Organizer xem và duyệt/từ chối đơn thuộc hoạt động của mình.
- [x] Quản lý trạng thái chờ duyệt, được duyệt, bị từ chối, đã hủy và quy tắc chuyển trạng thái.
- [x] Chống đăng ký trùng và duyệt vượt sức chứa, kể cả thao tác đồng thời.
- [x] Volunteer xem hoạt động đã đăng ký và kết quả xét duyệt.
- [x] Xử lý nhất quán khi hoạt động bị hủy hoặc thay đổi thông tin ảnh hưởng người đã đăng ký.

Quy tắc đã chốt: dùng giờ bắt đầu làm hạn đăng ký, tự hủy và xét duyệt; tự hủy được gửi lại về chờ duyệt, bị từ chối không được gửi lại. Đã đạt 68 tests backend trên MySQL, 26 ca Playwright, 5 tests bảo vệ database kiểm thử và lint/build. Chi tiết: [kết quả giai đoạn 5](GIAI_DOAN_5_KET_QUA.md).

**Tiêu chí:** chạy được đăng ký → xét duyệt → xem kết quả; không thao tác trên đơn ngoài quyền. Xem trạng thái trực tiếp trên trang tài khoản/hoạt động; trung tâm thông báo và tự động đối chiếu lịch làm sau.

### Giai đoạn 6: Điểm danh cơ bản — hoàn thành

Quy tắc người dùng đã chọn ngày 25/09/2026: chỉ điểm danh từ giờ bắt đầu đến giờ kết thúc, khi hoạt động còn Công khai. Gửi lại yêu cầu hợp lệ trả bản ghi cũ. Giữ lịch sử có mặt nếu hoạt động bị hủy sau khi điểm danh và hiển thị rõ tình trạng hủy. Chi tiết: [kết quả giai đoạn 6](GIAI_DOAN_6_KET_QUA.md).

- [x] Organizer xem danh sách người đã được duyệt của hoạt động.
- [x] Xác nhận có mặt thủ công trên website, đúng hoạt động và khoảng thời gian cho phép.
- [x] Lưu người xác nhận và thời điểm; chống điểm danh trùng.
- [x] Từ chối điểm danh người chưa được duyệt, đã hủy hoặc thuộc hoạt động ngoài quyền quản lý.
- [x] Volunteer xem trạng thái điểm danh và lịch sử tham gia.

Kiểm tra ngày 25/09/2026: 77 tests backend trên MySQL, 30 ca Playwright, 5 tests bảo vệ database và lint/build đạt. Migration điểm danh đã áp dụng sau khi sao lưu, giữ nguyên dữ liệu hiện có.

**Tiêu chí:** ghi nhận được người thực sự tham gia và truy vết thao tác; thao tác lặp không tăng lượt tham gia. QR, mã có thời hạn và check-out làm sau. Đợt 1 thống kê lượt tham gia, chưa tự suy ra số giờ.

### Giai đoạn 7: Đánh giá và phản hồi cơ bản — hoàn thành

Quy tắc đã chốt: điểm 1–5, nội dung bắt buộc tối đa 2.000 ký tự, gửi một lần và chưa sửa/xóa. Admin ẩn cần lý do; phản hồi bị ẩn không hiển thị cho Organizer hoặc tính vào điểm trung bình. Chi tiết: [kết quả giai đoạn 7](GIAI_DOAN_7_KET_QUA.md).

- [x] Người đã được xác nhận tham gia gửi điểm đánh giá và nội dung sau khi hoạt động hoàn thành.
- [x] Ràng buộc với lượt tham gia; tối đa một phản hồi/người/hoạt động.
- [x] Organizer xem phản hồi thuộc hoạt động mình quản lý.
- [x] Admin xem và ẩn phản hồi không phù hợp; lưu người thực hiện và lý do.
- [x] Thống kê chỉ tính phản hồi hợp lệ, không tính phản hồi đã bị ẩn.

Kiểm tra ngày 25/09/2026: 87 tests backend trên MySQL, 34 ca Playwright, 5 tests bảo vệ database và lint/build đạt. Migration phản hồi đã áp dụng sau sao lưu, giữ nguyên dữ liệu hiện có.

**Tiêu chí:** người tham gia thực tế gửi được phản hồi, không đánh giá trùng hoặc truy cập ngoài quyền. Chưa phân loại cảm xúc, phát hiện spam/sự cố hoặc tóm tắt bằng AI.

### Giai đoạn 8: Thống kê và quản trị cơ bản

- [ ] Volunteer xem số hoạt động đăng ký, được duyệt và đã tham gia.
- [ ] Organizer xem số đơn, người được duyệt, đã điểm danh và phản hồi theo hoạt động.
- [ ] Hiển thị kết quả hoạt động gồm số liệu tham gia và đánh giá từ dữ liệu thật.
- [ ] Admin quản lý trạng thái tài khoản, khóa/mở khóa và giám sát hoạt động, đăng ký, phản hồi.
- [ ] Tận dụng Django Admin cho thao tác đã đáp ứng được; bổ sung màn hình cần thiết cho luồng sử dụng.
- [ ] Ghi nhận thao tác nhạy cảm: khóa tài khoản, xét duyệt, điểm danh và ẩn phản hồi.

**Tiêu chí:** số liệu khớp danh sách chi tiết; kiểm tra quyền tại backend. Biểu đồ nâng cao, xuất PDF/Excel, mẫu báo cáo và chứng nhận làm sau.

### Giai đoạn 9: Kiểm tra hoàn chỉnh đợt 1

- [ ] Chạy xuyên suốt luồng chính với bốn nhóm người dùng trên React, Django và MySQL.
- [ ] Kiểm tra tài khoản bị khóa, truy cập trái quyền, dữ liệu sai, đăng ký trùng, sức chứa và điểm danh lặp.
- [ ] Kiểm tra hoạt động bị hủy, phản hồi không đủ điều kiện, trạng thái rỗng và lỗi kết nối.
- [ ] Chạy backend tests, frontend lint/build và các luồng trình duyệt phù hợp.
- [ ] Kiểm tra migration từ database mới; cập nhật hướng dẫn chạy và sao lưu dữ liệu.
- [ ] Sửa lỗi chặn luồng chính và cập nhật tài liệu theo chức năng thực tế.

**Điều kiện chuyển sang đợt 2:** toàn bộ luồng chính dùng được qua giao diện với dữ liệu thật; kiểm tra bắt buộc đạt; không còn lỗi làm sai quyền, sai dữ liệu hoặc chặn thao tác chính. Chỉ có model/API chưa được tính là hoàn thành chức năng.

Chưa cần chọn hosting để hoàn thành bản local. Nếu đưa lên Internet, phải cấu hình HTTPS, cookie an toàn, email/static/media và backup trước khi mở cho người dùng thật.

## 4. Đợt 2 — Chức năng phụ và AI

### Giai đoạn 10: Bổ sung sau khi đợt 1 đạt

Danh sách chờ dưới đây chưa triển khai đồng thời với đợt 1. Chọn từng nhóm theo nhu cầu; không cần làm hết mọi tiện ích trước AI, nhưng phải có dữ liệu đầu vào và cách đánh giá tương ứng.

| Nhóm | Công việc chờ | Phụ thuộc |
|---|---|---|
| Hồ sơ mở rộng | Kỹ năng, sở thích, lịch rảnh và liên kết tình nguyện viên | Hồ sơ cơ bản |
| Hoạt động mở rộng | Kỹ năng yêu cầu, lọc nâng cao, timeline và ảnh | Quản lý hoạt động; danh mục kỹ năng khi sử dụng |
| Địa điểm | Danh mục địa điểm, tọa độ, bản đồ, chỉ đường, dự phòng khi dịch vụ lỗi | Địa chỉ hoạt động |
| Điểm danh nâng cao | QR, mã có thời hạn, nhập mã dự phòng, check-out | Điểm danh cơ bản; chốt hướng quét |
| Đóng góp | Tính giờ và lịch sử đóng góp chi tiết | Quy tắc tính giờ và dữ liệu xác nhận phù hợp |
| Thông báo | Danh sách, đã đọc, liên kết nội dung, nhắc lịch và email nghiệp vụ | Trạng thái hoạt động/đăng ký; SMTP nếu gửi email |
| Ghép nối | Lọc điều kiện, đối chiếu lịch, baseline và đề xuất hai chiều có lý do | Kỹ năng, sở thích, lịch rảnh và hoạt động |
| AI ghép nối | Embedding hoặc mô hình phù hợp, đo chất lượng | Baseline và dữ liệu đánh giá |
| AI phản hồi | Chuẩn hóa nhãn, phân loại cảm xúc, hỗ trợ phát hiện spam/sự cố và rà soát | Phản hồi và dữ liệu đánh giá |
| AI báo cáo | Tóm tắt từ số liệu, phản hồi hợp lệ; cho phép kiểm tra lại | Báo cáo cơ bản, không tự bịa kết quả |
| Báo cáo mở rộng | Biểu đồ, lọc thống kê, xuất/in PDF/Excel | Thống kê và quyền xuất dữ liệu |
| Quản trị mở rộng | Quyền chi tiết, giao diện audit log, mẫu báo cáo/chứng nhận, câu chuyện tác động | Nghiệp vụ chính; chốt yêu cầu từng mục |
| Lưu trữ/vận hành | Lưu file bên ngoài, hosting/domain, cache chung và tối ưu theo tải | Nhu cầu triển khai thực tế |

AI phải phân biệt kết quả quy tắc với mô hình, có timeout và dự phòng khi dịch vụ lỗi, ghi rõ nguồn kết quả và chất lượng đã đo. Không dùng kết quả kiểm thử của báo cáo cũ làm kết quả hệ thống mới.

## 5. Đối chiếu kế hoạch cũ và mới

| Nội dung cũ | Thứ tự mới |
|---|---|
| Giai đoạn 3: hồ sơ, kỹ năng, lịch rảnh, upload, địa điểm | Đợt 1 giữ hồ sơ đã làm; mở rộng sang đợt 2 |
| Giai đoạn 4: hoạt động, timeline, bản đồ | Đợt 1 quản lý/xem hoạt động; timeline/bản đồ làm sau |
| Giai đoạn 5 kèm thông báo và đối chiếu lịch | Đợt 1 đăng ký/xét duyệt; phần hỗ trợ làm sau |
| Giai đoạn 6 triển khai QR | Đợt 1 điểm danh thủ công có kiểm soát; QR làm sau |
| Giai đoạn 7: phản hồi và thông báo | Đợt 1 phản hồi cơ bản; thông báo/AI làm sau |
| Giai đoạn 8: AI | AI sang đợt 2; giai đoạn 8 mới là thống kê/quản trị cơ bản |
| Giai đoạn 9: dashboard và quản trị mở rộng | Phần cơ bản sang giai đoạn 8; nâng cao sang đợt 2 |
| Giai đoạn 10: kiểm thử cuối dự án | Kiểm thử từng chức năng và tổng thể ở giai đoạn 9; giai đoạn 10 mới là phụ/AI |

Không sửa báo cáo kết quả cũ thành công việc chưa thực hiện. Kế hoạch mới thay đổi ưu tiên, không thay đổi lịch sử.

## 6. Việc tiếp theo

1. Bắt đầu giai đoạn 8: thống kê cơ bản theo vai trò Volunteer, Organizer và Admin.
2. Đối chiếu số đăng ký, được duyệt, tham gia và phản hồi với danh sách chi tiết; phân biệt hoạt động bị hủy.
3. Hoàn thiện quản trị tài khoản, khóa/mở khóa và giám sát nghiệp vụ; tận dụng Django Admin khi phù hợp.
4. Kiểm tra quyền, tính chính xác của số liệu và truy vết thao tác. Bản bàn giao giai đoạn 7 nằm trên nhánh `feature/feedback`.

Không tiếp tục chức năng phụ hoặc AI trước khi hoàn thành đợt 1, trừ khi người dùng đổi ưu tiên.

## 7. Quy tắc cập nhật

- Chỉ đánh dấu hoàn thành khi đã triển khai và kiểm tra; mỗi chức năng gồm dữ liệu, API, giao diện, phân quyền và kiểm thử cần thiết.
- Hỏi khi thiếu quy tắc nghiệp vụ ảnh hưởng phần đang làm; không hỏi lại công nghệ/vai trò đã chốt.
- Chốt hướng QR, cách tính giờ, nhãn AI, dịch vụ ngoài và chứng nhận khi đến nhóm tương ứng ở đợt 2.
- Ghi rõ phần ở local và phần đã commit/push. Sửa kế hoạch không đồng nghĩa triển khai code hoặc đẩy GitHub.
- Đồng bộ kế hoạch, README và thiết kế khi đổi phạm vi; giữ nguyên báo cáo kết quả lịch sử.
