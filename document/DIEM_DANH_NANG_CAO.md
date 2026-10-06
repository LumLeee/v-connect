# Điểm danh nâng cao bằng QR và mã nhập

Ngày cập nhật: 04/10/2026.

## Phạm vi đã chọn

Nhà tổ chức hiển thị QR/mã nhập cho hoạt động của mình. Tình nguyện viên đã được duyệt dùng website để quét QR bằng camera, chọn ảnh QR hoặc nhập mã 8 chữ số rồi xác nhận check-in. Giữ điểm danh thủ công để Nhà tổ chức xử lý khi thiết bị người tham gia không dùng được.

Đợt này chỉ có **check-in**, chưa có check-out và chưa tính giờ đóng góp. Điều kiện phản hồi, thống kê lượt tham gia và báo cáo tiếp tục dùng cùng bản ghi điểm danh như trước.

## Cách sử dụng

1. Nhà tổ chức mở hoạt động → **Điểm danh người tham gia** → **Tạo mã mới** khi hoạt động đang diễn ra và còn Công khai.
2. Hiển thị QR hoặc mã 8 chữ số tại hoạt động. Người tham gia đăng nhập bằng tài khoản của mình, mở chi tiết hoạt động → **Check-in bằng QR hoặc mã**.
3. Tình nguyện viên chọn **Mở camera quét QR**, **Chọn ảnh QR** hoặc nhập mã; bấm **Xác nhận check-in** sau khi đọc mã.
4. Kết quả được lưu vào lịch sử tham gia, có thời gian, người thực hiện và hình thức Quét QR/Nhập mã. Nhà tổ chức dùng **Cập nhật danh sách điểm danh** để xem kết quả.
5. Nhà tổ chức có thể tạo mã mới, thu hồi mã hoặc tải lại mã hiện tại. Mã đang dùng được khôi phục khi tải lại trang nếu vẫn còn hiệu lực.

Ảnh QR được xử lý trong trình duyệt, không tải ảnh lên backend. Chấp nhận PNG/JPEG/WebP tối đa 5 MB. Camera chỉ mở sau thao tác của người dùng và được dừng khi đọc được mã, tắt camera hoặc rời trang. Trình duyệt cần quyền camera và môi trường HTTPS hoặc localhost; khi không mở được camera, dùng mã nhập hoặc ảnh QR.

QR dùng định dạng riêng `vconnect:checkin:<activity-id>:<token>` để đọc ngay trong trang check-in, không phải liên kết tự điều hướng. QR thuộc hoạt động khác hoặc nội dung không đúng định dạng bị từ chối.

## Quy tắc nghiệp vụ

- Mã có hạn tối đa **5 phút**, không vượt quá giờ kết thúc hoạt động. Đồng hồ đếm ngược dựa trên thời gian máy chủ lúc tải mã; backend quyết định hiệu lực cuối cùng.
- Mỗi hoạt động chỉ có một mã hiện hành. Tạo mã mới làm QR và mã nhập cũ mất hiệu lực; thu hồi chặn cả hai.
- Chỉ Nhà tổ chức sở hữu hoạt động được xem, tạo và thu hồi mã. API phản hồi mã có chỉ thị không lưu cache.
- Chỉ tài khoản Volunteer đang hoạt động, có đơn Được duyệt, được check-in cho chính mình. Không nhận ID người khác trong dữ liệu gửi lên.
- Hoạt động phải còn Công khai và đang diễn ra. Mã hết hạn tại đúng `expires_at`; trước giờ bắt đầu và sau giờ kết thúc không check-in được.
- Đổi lịch hoặc địa điểm thu hồi mã hiện hành. Hoạt động bị hủy hoặc hoàn thành thì mọi mã đều không còn dùng được.
- Quét lại, nhập lại hoặc điểm danh thủ công sau check-in trả về bản ghi đầu tiên khi yêu cầu vẫn đủ điều kiện. Không đổi thời điểm, hình thức hay người thực hiện của bản ghi cũ; không tạo thêm thông báo hoặc tăng số lượt tham gia.
- API check-in giới hạn 6 yêu cầu/phút/tài khoản. Khi vượt giới hạn, đợi hết thời gian giới hạn rồi thử lại. Việc giới hạn dùng cache giống cơ chế hiện tại của dự án; triển khai nhiều tiến trình cần cache chung để thống nhất giới hạn.

QR/mã được Nhà tổ chức cung cấp tại hiện trường. Chức năng này không sử dụng GPS hoặc xác minh khuôn mặt để chứng minh vị trí người quét.

## Dữ liệu và xử lý

`Attendance.method` phân biệt `manual`, `qr`, `code`; bản ghi cũ mặc định là `manual`. Với check-in tự thực hiện, `confirmed_by` ghi chính người check-in và giao diện hiển thị “Người check-in”. Bản ghi thủ công vẫn ghi Nhà tổ chức như trước.

`AttendanceCode` lưu hoạt động, nonce, người cấp, thời điểm cấp/hết hạn và thu hồi. Token QR và mã nhập được dẫn xuất bằng HMAC với khóa bí mật phía server và hai miền riêng; không lưu trực tiếp mã có thể sử dụng trong database. Token không đặt trong URL, nhật ký yêu cầu hoặc dữ liệu trình duyệt lưu lâu dài.

Các thao tác tạo/thu hồi mã và check-in đều khóa dòng hoạt động trong giao dịch, cùng thứ tự với đăng ký, xét duyệt, hủy hoạt động và điểm danh thủ công. Hai thao tác cùng lúc vẫn chỉ tạo một `Attendance`. Bản ghi điểm danh, nhật ký và thông báo được lưu cùng giao dịch.

Nhật ký có thêm **Tạo mã điểm danh** và **Thu hồi mã điểm danh**. Check-in dùng sự kiện **Xác nhận có mặt**, ghi người thực hiện là tình nguyện viên; hình thức cụ thể nằm trong bản ghi điểm danh. Thông báo và email xác nhận dùng hàng đợi thông báo hiện có.

## API

Các đường dẫn có tiền tố `/api/v1/`, yêu cầu phiên đăng nhập; POST cần CSRF.

| Phương thức | Đường dẫn | Dữ liệu / quyền |
|---|---|---|
| GET | `organizer/activities/<id>/attendance-code/` | Chủ hoạt động xem mã hiện hành và thời hạn |
| POST | `organizer/activities/<id>/attendance-code/` | `{}`; chủ hoạt động cấp/thay mã |
| POST | `organizer/activities/<id>/attendance-code/revoke/` | `{}`; chủ hoạt động thu hồi |
| POST | `activities/<id>/check-in/` | `{"code":"12345678"}` hoặc `{"token":"..."}`; Volunteer check-in cho mình |

Lần tạo điểm danh trả 201, thao tác lặp còn hợp lệ trả 200 với bản ghi gốc. Không có API công khai trả mã cho Volunteer; người tham gia nhận mã từ Nhà tổ chức tại hoạt động.

## Cài đặt và migration

Chạy `npm ci` trong `frontend` để cài đúng lockfile. Thêm `qrcode` 1.5.4 và `qr-scanner` 1.4.2; phần tạo/quét QR được tải theo nhu cầu. Thư viện quét và worker nằm trong bundle, không dùng dịch vụ QR bên ngoài.

Sao lưu rồi chạy `.venv/Scripts/python.exe backend/manage.py migrate --noinput`. Migration mới:

- `participations.0003_attendance_method_attendancecode`.
- `reports.0002_alter_auditevent_action`.

MySQL80 local đã được sao lưu tại `tmp/backups/snapshot-20261004-201031`, xác minh checksum và đối chiếu dữ liệu cũ không đổi sau migration. Các bản ghi điểm danh cũ giữ hình thức thủ công. Không tạo dữ liệu điểm danh mẫu trong database thật.

## Kiểm thử

Kiểm thử backend bổ sung quyền sở hữu, CSRF, payload sai, mã bị thay thế/thu hồi, thời hạn, điều kiện xét duyệt, giới hạn tần suất, sai hoạt động, rollback và cuộc đua giữa điểm danh thủ công với tự check-in.

Playwright kiểm tra đọc QR thật từ ảnh và từ video canvas mô phỏng camera, dừng luồng camera sau khi đọc mã, lỗi quyền camera, nhập mã dự phòng, mã hết hạn và giữ bản ghi đầu tiên. Chưa thử camera vật lý trên thiết bị người dùng. Có kiểm tra giao diện ở 320/390/768/1280px.

Kết quả cuối: **152 tests backend, 8 tests bảo vệ runner, 62/62 ca Playwright, lint và build đều đạt**. Database MySQL kiểm thử mới áp dụng đủ 33 migration. Kiểm tra npm sau cập nhật phụ thuộc trả về 0 cảnh báo lỗ hổng tại thời điểm thực hiện.

Minh chứng cục bộ: `tmp/checkin-check.log`, `tmp/checkin-e2e.log`, ảnh tại `tmp/e2e-3dde3768e80f/screenshots/`. Database kiểm thử riêng đã được dọn sau khi chạy.

Tài liệu kỹ thuật thư viện: [node-qrcode](https://github.com/soldair/node-qrcode), [qr-scanner](https://github.com/nimiq/qr-scanner).
