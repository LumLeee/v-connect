# Giai đoạn 5 — Đăng ký và xét duyệt tham gia

Ngày thực hiện: 24/09/2026. Bàn giao ngày 25/09/2026 trên nhánh `feature/participations`, kế thừa giai đoạn 4 tại `11cfc7c`.

## Chức năng

- Volunteer đăng ký, xác nhận hủy và theo dõi đơn của mình qua giao diện.
- Organizer xem họ tên, email, số điện thoại của người đăng ký hoạt động mình quản lý; duyệt/từ chối đơn chờ duyệt qua bước xác nhận.
- Danh sách có phân trang, trạng thái rỗng, lỗi và nút cập nhật. Trạng thái tham gia hiển thị ngay tại chi tiết hoạt động.
- API kiểm tra vai trò, quyền sở hữu và CSRF; không công khai danh sách ứng viên.

## Quy tắc đã thống nhất

1. Chỉ nhận đơn khi hoạt động công khai và chưa đến giờ bắt đầu. Giờ bắt đầu là hạn đăng ký, tự hủy và xét duyệt, tính theo đồng hồ backend.
2. Mỗi người có tối đa một bản ghi cho mỗi hoạt động. Đăng ký lần đầu ở trạng thái chờ duyệt. Tự hủy đơn chờ/đã duyệt được gửi lại trước hạn, dùng lại bản ghi và trở về chờ duyệt; bị từ chối không được gửi lại.
3. Chỉ xét duyệt đơn chờ. Lưu người xét duyệt và thời điểm. Không duyệt tài khoản đã bị khóa hoặc không còn vai trò Volunteer.
4. Sức chứa tính theo số người được duyệt. Khi đủ chỗ, không nhận đăng ký mới hoặc duyệt thêm; đơn chờ hiện có vẫn chờ. Tự hủy đơn đã duyệt giải phóng chỗ. Không giảm sức chứa dưới số người đã duyệt.
5. Dùng transaction và khóa cùng bản ghi hoạt động cho đăng ký, hủy, xét duyệt, sửa sức chứa và hủy hoạt động. Ràng buộc unique tại MySQL chống trùng người/hoạt động.
6. Hủy hoạt động chuyển các đơn chờ/đã duyệt sang đã hủy, có lý do hoạt động bị hủy. Giữ đơn đã từ chối/tự hủy và thông tin xét duyệt cũ. Đây là xử lý hủy toàn bộ hoạt động, kể cả sau giờ bắt đầu theo quy tắc giai đoạn 4.
7. Lưu thời gian và địa chỉ lúc đăng ký để báo thay đổi trên trang người tham gia. Sau giờ bắt đầu, hoạt động đã có đơn không được đổi lịch để mở lại xét duyệt. Đơn chưa được duyệt khi hết hạn vẫn giữ trạng thái chờ, kèm thông báo hết hạn; không tự duyệt.

## Cách sử dụng

- Volunteer: mở `/hoat-dong`, chọn hoạt động, bấm **Đăng ký tham gia**. Xem danh sách ở `/tinh-nguyen-vien/dang-ky`; mở lại hoạt động để hủy nếu còn hạn.
- Organizer: mở `/nha-to-chuc/hoat-dong`, chọn hoạt động, bấm **Xem danh sách đăng ký**, chọn **Duyệt** hoặc **Từ chối** rồi xác nhận.
- Kết quả và thay đổi lịch/địa điểm được xem trực tiếp trên website; chưa gửi thông báo/email nghiệp vụ.

## Dữ liệu và kiểm tra

Migration `participations.0001_initial` chỉ thêm bảng đơn đăng ký và ràng buộc. Sao lưu SQL trước khi áp dụng vào MySQL80; đối chiếu tài khoản, hồ sơ tổ chức và hoạt động trước/sau migration.

- Backend: 68 tests trên MySQL, gồm 11 tests đăng ký/xét duyệt. Có hai tình huống chạy đồng thời: trùng đăng ký và tranh chỗ duyệt cuối.
- Kiểm tra Django, migration không thiếu thay đổi, 5 tests bảo vệ database kiểm thử, frontend lint/build: đạt.
- Playwright: 26 ca đạt trên Chrome ở hai kích thước màn hình. Có luồng đăng ký → duyệt → tự hủy → đăng ký lại → từ chối; đổi địa điểm và hủy hoạt động, cùng các luồng hồi quy. Trang đăng ký/danh sách ứng viên được kiểm tra không tràn ngang ở độ rộng 320, 390, 768 và 1280 px.

Migration đã áp dụng thành công; dữ liệu tài khoản, hồ sơ và hoạt động trước/sau không đổi. Bản sao lưu: `tmp/backups/before-participations-20260924-113952.sql` (chỉ lưu local).

Log kiểm thử local nằm trong `tmp/phase5-check.log` và `tmp/phase5-e2e.log`. Database kiểm thử tách khỏi database ứng dụng, dữ liệu tài khoản dùng thử không được thêm vào database thật.

## Phạm vi tiếp theo

Giai đoạn 6: điểm danh thủ công cho người được duyệt. Chưa triển khai điểm danh, phản hồi, thống kê nghiệp vụ, thông báo, đối chiếu lịch tự động hoặc AI.
