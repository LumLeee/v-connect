# Tạm bỏ giới hạn thời gian hoạt động

Ngày cập nhật: 02/11/2026. Local đang bật chế độ thử theo yêu cầu.

Trong `backend/.env`:

```dotenv
ACTIVITY_TIME_CHECKS_ENABLED=false
```

Đặt lại `true` rồi khởi động lại backend để khôi phục các giới hạn thời gian. Không cần migration hoặc thay đổi ngày/giờ trong database. Frontend đọc chính sách từ `time_checks_disabled` của API, không có cấu hình riêng để lệch với backend.

Khi tạm tắt:

- Công khai được cả hoạt động có lịch đã qua; không chặn sửa lịch vì đã bắt đầu.
- Đăng ký, hủy, xét duyệt, gửi/chấp nhận lời mời không bị chặn bởi giờ bắt đầu.
- Điểm danh thủ công hoặc QR/mã không phải chờ khung giờ hoạt động. Mã không bị chặn bởi hạn sử dụng trong chế độ thử; tạo lại hoặc thu hồi vẫn vô hiệu hóa mã cũ.
- Hoàn thành được hoạt động Công khai trước giờ kết thúc. Sau đó có thể chấm điểm, phản hồi và xem mẫu tổng kết ngay; điểm cũng được tính vào bảng xếp hạng.
- Khám phá và gợi ý không loại hoạt động chỉ vì đã qua giờ bắt đầu; vẫn loại trạng thái không Công khai hoặc đã đủ chỗ. Gợi ý không chặn vì trùng lịch với hoạt động đã duyệt khác.

Vẫn giữ quyền truy cập, CSRF, trạng thái hợp lệ, số chỗ, người đã được duyệt, yêu cầu điểm danh, giới hạn điểm 0–10, phiên bản và lý do sửa điểm. Hoạt động vẫn cần giờ kết thúc sau giờ bắt đầu; mốc chương trình và lịch rảnh vẫn kiểm tra tính hợp lệ của dữ liệu. Mật khẩu, phiên đăng nhập, token đặt lại mật khẩu và lịch gửi/nhắc email không thuộc công tắc này.

Ngày giờ vẫn được hiển thị, ghi nhật ký và dùng cho bộ lọc/biểu đồ. Các nhóm “sắp diễn ra/đang diễn ra” trên tổng quan vẫn phản ánh lịch thực tế, không phải giới hạn quyền thao tác. Nếu đã chuyển hoạt động sang Hoàn thành trong chế độ thử, tắt công tắc không tự đảo ngược trạng thái hoặc điểm danh đã ghi.

Kiểm thử chuẩn dùng `scripts/check.py`, tự bật lại kiểm tra thời gian trong tiến trình kiểm thử; các ca chế độ thử dùng `override_settings` riêng. Trình duyệt chuẩn cũng giữ kiểm tra thời gian; chạy ca thử bằng `scripts/test_e2e.py --demo-time activity-time-demo.spec.js`. Cờ này chỉ đổi cấu hình trong server kiểm thử trên database tạm.

## Kết quả kiểm chứng ngày 02/11/2026

- 213 kiểm thử backend, 9 kiểm thử bảo vệ môi trường chạy, Django check, kiểm tra migration và frontend lint/build đều đạt.
- 4 ca trình duyệt chế độ thử trên desktop/narrow đã đạt: công khai, đăng ký, xét duyệt, check-in bằng mã, hoàn thành và chấm điểm cho cả lịch đã qua lẫn tương lai. Một ca được chạy lại sau khi bổ sung chờ lưu trạng thái Hoàn thành trước khi chuyển trang.
- 4 ca trình duyệt QR ở chế độ bình thường đạt, gồm tạo/thay thế/thu hồi, đọc QR, mã hết hạn và check-in một lần.
- Đã xác nhận API của backend development đang chạy trả `time_checks_disabled=true` trên hoạt động thật. Không tạo hoạt động mẫu hoặc thay đổi lịch/dữ liệu nghiệp vụ trong database local để thử; dữ liệu trình duyệt nằm trong database tạm và được dọn sau khi chạy.
