# Chương trình hoạt động (timeline)

Ngày triển khai: 09/10/2026.

## Sử dụng

Nhà tổ chức mở **Tạo hoạt động** hoặc **Chỉnh sửa hoạt động**, đến phần **Chương trình hoạt động** và chọn **Thêm mốc chương trình**. Mỗi mốc gồm tên, thời gian bắt đầu/kết thúc và mô tả tùy chọn. Có thể chỉnh sửa hoặc xóa từng mốc; mọi thay đổi chỉ được lưu khi bấm nút lưu hoạt động.

Trang chi tiết hiển thị các mốc theo thời gian. Khách và Tình nguyện viên chỉ xem timeline của hoạt động Công khai. Nhà tổ chức xem được chương trình của hoạt động mình quản lý ở mọi trạng thái; chỉ sửa khi hoạt động còn Nháp hoặc Công khai. Hoạt động không có mốc hiển thị thông báo chưa cập nhật chương trình chi tiết.

## Quy tắc

- Tối đa 50 mốc cho một hoạt động; tên bắt buộc, tối đa 200 ký tự; mô tả tối đa 2.000 ký tự.
- Kết thúc mốc phải sau bắt đầu; toàn bộ mốc nằm trong thời gian hoạt động, cho phép trùng đúng biên bắt đầu/kết thúc hoạt động.
- Các mốc có thể trùng nhau để hỗ trợ chương trình song song; không bắt buộc phủ kín thời lượng hoạt động. Tự sắp xếp theo giờ bắt đầu, giờ kết thúc rồi ID.
- Nhập và hiển thị giờ Việt Nam (UTC+7); hỗ trợ hoạt động qua nhiều ngày. Quy tắc bắt đầu ít nhất 24 giờ vẫn áp dụng cho lịch hoạt động, không áp dụng riêng cho từng mốc.
- Khi đổi lịch hoạt động, phải điều chỉnh đồng thời các mốc nếu chúng nằm ngoài lịch mới. Hệ thống báo lỗi và giữ nguyên dữ liệu đã lưu nếu không hợp lệ.
- Không tự tạo thông báo/email riêng khi sửa chương trình chi tiết. Thông báo đổi thời gian tổng thể hoặc địa điểm hoạt động tiếp tục theo cơ chế hiện có.

## API và lưu trữ

API tạo, cập nhật và đọc hoạt động bổ sung trường `timeline`, là danh sách `{title, description, starts_at, ends_at}`. Thời gian API dùng ISO 8601 có múi giờ.

`PATCH` không gửi `timeline` sẽ giữ nguyên các mốc; gửi danh sách sẽ thay thế toàn bộ; gửi `[]` để xóa tất cả. Mỗi phần tử phải có đầy đủ tên và hai thời điểm. Không cho chuyển mốc sang hoạt động khác qua dữ liệu gửi lên.

Model `ActivityMilestone` liên kết nhiều-một với `Activity`; migration `activities.0003_activitymilestone`. Hoạt động cũ có danh sách rỗng. Việc ghi hoạt động và mốc nằm trong cùng transaction; cập nhật khóa dòng hoạt động như trước, không lưu dở dang khi có lỗi. Cơ sở dữ liệu cũng ràng buộc kết thúc mốc sau bắt đầu.

## Kiểm chứng

Kiểm thử backend bao gồm tạo/thay thế/xóa, thứ tự, giữ nguyên khi PATCH trường khác, giới hạn dữ liệu, đổi lịch tổng thể, phân quyền/CSRF, khóa trạng thái và khôi phục toàn bộ transaction khi ghi lỗi. Kiểm thử trình duyệt bao gồm nhập mốc sai thứ tự, sửa thời gian không hợp lệ, sửa lại và công khai, khách xem timeline, xóa mốc và kiểm tra bố cục nhiều kích thước.

Kết quả ngày 09/10/2026: 178 kiểm thử backend, 8 kiểm thử bảo vệ runner, lint/build đều đạt; 10 ca Playwright của timeline, hoạt động, hoạt động mở rộng và ghép nối đạt trên desktop/narrow. Đã kiểm tra ảnh giao diện desktop/narrow và chống tràn ngang ở 320, 390, 768, 1280px. Đã sao lưu, xác minh checksum và áp dụng migration vào MySQL hiện có.
