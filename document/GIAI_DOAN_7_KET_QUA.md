# Giai đoạn 7 — Đánh giá và phản hồi cơ bản

Ngày thực hiện và bàn giao: 25/09/2026. Nhánh `feature/feedback`, kế thừa giai đoạn 6 tại `91c53e5`.

## Quy tắc và chức năng

Người dùng đã chọn điểm đánh giá 1–5, nội dung bắt buộc tối đa 2.000 ký tự, mỗi người gửi một lần và chưa cho sửa/xóa. Admin ẩn phản hồi phải nhập lý do; phản hồi bị ẩn không hiển thị cho Organizer và không tính vào điểm trung bình.

- Volunteer chỉ gửi khi đã có bản ghi xác nhận có mặt, đơn vẫn Được duyệt và hoạt động đã kết thúc, được đánh dấu Hoàn thành. Hoạt động bị hủy hoặc chỉ hết giờ nhưng chưa hoàn thành không đủ điều kiện.
- Không dùng ID người gửi/điểm danh do frontend cung cấp; backend tìm lượt tham gia của tài khoản trong phiên. Một bản ghi phản hồi gắn với một Attendance, gián tiếp duy nhất cho mỗi người/hoạt động.
- Kiểm tra điểm nguyên trong khoảng 1–5, loại khoảng trắng đầu/cuối và từ chối nội dung rỗng. Nội dung hiển thị dưới dạng văn bản, không render HTML từ người dùng.
- Sau gửi, Volunteer xem lại nội dung và trạng thái xử lý. Nếu bị ẩn, người gửi thấy lý do nhưng không được gửi lại.
- Organizer chỉ xem phản hồi hợp lệ thuộc hoạt động của mình, có phân trang và điểm trung bình trên toàn bộ phản hồi hợp lệ, không chỉ trang đang xem. Chưa có phản hồi thì điểm trung bình là `null`, giao diện ghi **Chưa có đánh giá**.
- Admin xem tất cả hoặc lọc chưa ẩn/đã ẩn, chọn phản hồi và nhập lý do tối đa 1.000 ký tự trước khi xác nhận ẩn. Lưu Admin thực hiện, thời điểm và lý do; giữ bản gốc. Gửi lại yêu cầu ẩn không ghi đè quyết định đầu tiên. Chưa có chức năng khôi phục phản hồi đã ẩn.
- Không công khai danh sách phản hồi cho Guest hoặc Volunteer khác. Các thao tác kiểm tra vai trò, quyền sở hữu và CSRF tại backend.

## Dữ liệu và thống kê

App `feedback` chứa model, serializer, service và API. `Feedback.attendance` dùng OneToOne và PROTECT để bảo vệ liên kết với người thực sự tham gia. Migration `feedback.0001_initial` tạo bảng và ràng buộc điểm 1–5, nội dung không rỗng, thông tin xử lý đầy đủ khi đã ẩn.

Gửi phản hồi dùng transaction và khóa bản ghi Activity, cùng thứ tự với nghiệp vụ đăng ký/điểm danh; unique tại database chống trùng ngay cả khi gửi đồng thời. Admin ẩn dùng transaction và khóa chính bản ghi Feedback, giữ thông tin xử lý lần đầu.

Danh sách Organizer và thống kê cùng dùng `visible_feedback()`: chưa bị ẩn, đơn được duyệt, hoạt động hoàn thành, đã có điểm danh. Tính count/average trên toàn bộ tập hợp đó. Điểm trung bình làm tròn hai chữ số thập phân; phản hồi bị ẩn không nằm trong tập hợp. Đây là thống kê phản hồi tối thiểu; dashboard tổng hợp thuộc giai đoạn 8.

## API

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/api/v1/activities/<id>/feedback/` | Volunteer xem phản hồi của mình và `can_submit` |
| POST | `/api/v1/activities/<id>/feedback/` | Gửi `{ "rating": 5, "content": "Nội dung" }` |
| GET | `/api/v1/organizer/activities/<id>/feedback/` | Chủ hoạt động xem danh sách hợp lệ và `summary` |
| GET | `/api/v1/admin/feedback/?status=all` | Admin xem danh sách; status hỗ trợ all/visible/hidden |
| POST | `/api/v1/admin/feedback/<feedback_id>/hide/` | Admin ẩn với `{ "reason": "Lý do" }` |

Danh sách dùng phân trang chuẩn; trường `summary.count` và `summary.average_rating` chỉ có ở danh sách Organizer. Không mở PATCH/DELETE hoặc cho phép client gán người gửi, thời gian, trạng thái ẩn.

## Cách dùng

- Volunteer: **Lịch sử tham gia** → hoạt động đã Hoàn thành → **Gửi hoặc xem phản hồi của tôi**. Có liên kết tương tự trong chi tiết hoạt động và danh sách đăng ký.
- Organizer: chi tiết hoạt động → **Xem phản hồi hoạt động**.
- Admin: **Tài khoản của tôi** → **Quản lý phản hồi** → chọn **Ẩn phản hồi**, nhập lý do, xác nhận.

## Kiểm tra và migration

- 87 tests backend trên MySQL đạt, gồm 10 tests mới cho phản hồi: điều kiện gửi, dữ liệu đầu vào, quyền riêng tư, CSRF, chống gửi trùng/đồng thời, ràng buộc database và thống kê sau ẩn.
- Django system check, kiểm tra migration, 5 tests bảo vệ database kiểm thử và frontend lint/build đạt.
- Playwright trên Chrome: 34 ca đạt (17 ca ở mỗi kích thước desktop/màn hình nhỏ), gồm 4 ca mới về phản hồi. Luồng gửi → Organizer xem → Admin ẩn → thống kê cập nhật hoạt động đúng; người chưa có mặt bị chặn và không truy cập được trang quản trị.
- Kiểm tra hiển thị nội dung HTML như văn bản, không chạy script; các trang phản hồi không tràn ngang ở 320, 390, 768, 1280 px. Đã xem ảnh desktop/màn hình nhỏ tại `tmp/e2e-194e79cfc53c/screenshots`.
- Migration `feedback.0001_initial` đã áp dụng thành công sau bản sao lưu `tmp/backups/before-feedback-20260925-220121.sql`. Đối chiếu trước/sau xác nhận tài khoản, hồ sơ, hoạt động, đơn đăng ký và điểm danh được giữ nguyên.
- Log local: `tmp/phase7-check.log`, `tmp/phase7-e2e.log`. Dữ liệu mẫu cho kiểm thử nằm trong database kiểm thử riêng; runner kết thúc với mã 0 và đã dọn database này.

## Phạm vi tiếp theo

Giai đoạn 8: thống kê và quản trị cơ bản. Chưa phân loại cảm xúc, phát hiện spam/sự cố hoặc tóm tắt bằng AI; các phần đó vẫn thuộc đợt sau.
