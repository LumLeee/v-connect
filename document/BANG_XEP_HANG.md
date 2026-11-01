# Bảng xếp hạng và cấp bậc đóng góp

Ngày triển khai: 01/11/2026.

## Quy tắc điểm và xếp hạng

Nhà tổ chức vẫn chấm điểm nguyên 0–10 cho từng Tình nguyện viên sau khi hoạt động Hoàn thành. Hệ thống tự cộng điểm đã chấm; không tự cho điểm thay Nhà tổ chức.

Chỉ tính lượt đăng ký Được duyệt, có điểm danh, hoạt động Hoàn thành và đã kết thúc. Tổng khớp trang **Đóng góp của tôi**, cộng trên toàn thời gian. Điểm 0 là đã chấm nhưng không làm tăng tổng; chưa chấm không được tự gán điểm. Không tính hoạt động Nháp/Công khai/Đã hủy, hoạt động chưa kết thúc hoặc lượt đăng ký đã hủy/bị từ chối.

Bảng lấy tối đa 20 tài khoản Tình nguyện viên đang hoạt động có tổng điểm lớn hơn 0, giảm dần theo tổng điểm. Tài khoản bị khóa và vai trò Organizer/Admin không tham gia xếp hạng.

Người bằng điểm cùng hạng theo kiểu **1, 1, 3**. Thứ tự hiển thị khi bằng điểm dùng ngày tham gia tài khoản tăng dần, sau đó mã tài khoản. Khi đồng điểm ở vị trí thứ 20, vẫn giới hạn 20 người theo thứ tự này; cấp bậc và thứ hạng không bị thay đổi bởi tiêu chí phụ.

Tình nguyện viên có phần **Hành trình của bạn** gồm tổng điểm, thứ hạng toàn hệ thống, cấp bậc và tiến độ lên cấp tiếp theo, kể cả ngoài Top 20. Người có 0 điểm hiển thị Khởi đầu, chưa xếp hạng. Organizer/Admin xem bảng nhưng không có thứ hạng cá nhân.

## Cấp bậc

| Tổng điểm | Cấp bậc |
| --- | --- |
| 0–19 | Khởi đầu |
| 20–49 | Đồng hành |
| 50–99 | Tích cực |
| 100–199 | Tiên phong |
| Từ 200 | Truyền cảm hứng |

Cấp bậc phụ thuộc tổng điểm hiện tại, có thể tăng hoặc giảm khi điều chỉnh điểm, trạng thái hoạt động hoặc trạng thái đăng ký làm thay đổi dữ liệu đủ điều kiện. Không lưu điểm/cấp bậc trùng vào bảng riêng, không cộng điểm theo sự kiện nên tải lại không cộng lặp. Dùng dữ liệu hiện tại mỗi lần tải; không cập nhật đẩy thời gian thực vào trang đang mở.

## Giao diện và quyền riêng tư

Mở **Bảng xếp hạng** trong menu của cả ba vai trò, từ tổng quan Tình nguyện viên hoặc trang đóng góp. Đường dẫn `/bang-xep-hang` yêu cầu đăng nhập. Có nút **Cập nhật bảng xếp hạng**, trạng thái trống, lỗi mạng/thử lại và ảnh thay thế nếu avatar không tải được.

Chỉ hiển thị họ tên, avatar, tổng điểm, thứ hạng và cấp bậc. Không hiển thị email, điện thoại, mô tả hồ sơ hoặc toàn bộ lịch rảnh. `matching_visible` là quyền xuất hiện trong gợi ý ghép nối, không phải điều kiện của bảng xếp hạng đã được xác nhận cho người đăng nhập.

Avatar được đọc qua API yêu cầu đăng nhập, chỉ cho người hiện ở Top 20 hoặc chính chủ. Không dùng URL file media công khai. Tài khoản đã bị khóa/không còn trong phạm vi hoặc ảnh đã xóa trả 404; giao diện dùng biểu tượng thay thế.

## API

- `GET /api/v1/leaderboard/`: `results` tối đa 20 người, `me` (chỉ Volunteer), `levels`, `limit=20`, `updated_at`.
- Mỗi người: `rank`, `full_name`, `avatar_url`, `total_score`, `level`, `is_me`. Không trả ID tài khoản riêng hoặc thông tin liên hệ.
- `level` gồm tên, mã cấp bậc, điểm bắt đầu, mốc/tên cấp tiếp theo và phần trăm tiến độ. Cấp cao nhất có tiến độ 100%, không có mốc tiếp theo.
- `GET /api/v1/leaderboard/avatars/<id>/`: ảnh JPEG trong phạm vi được phép; không có API sửa avatar người khác.
- API yêu cầu đăng nhập và trả `no-store`. Bảng xếp hạng chỉ đọc; chấm/sửa điểm tiếp tục qua API đóng góp có kiểm tra chủ hoạt động, phiên bản và lý do.

Không cần migration hoặc tiến trình tính điểm riêng; không thay đổi dữ liệu MySQL khi triển khai chức năng.

## Kiểm chứng ngày 01/11/2026

- 208 kiểm thử backend, 9 kiểm thử bảo vệ môi trường chạy, Django check, kiểm tra migration, frontend lint/build đều đạt.
- Kiểm tra mốc cấp bậc, tiến độ, tổng khớp đóng góp cá nhân, đồng hạng 1–1–3, giới hạn 20, thứ tự ổn định, thứ hạng ngoài Top 20, 0 điểm/chưa chấm, loại dữ liệu không đủ điều kiện và tài khoản bị khóa.
- Kiểm tra sửa điểm làm đổi tổng, hạng/cấp bậc ở lần tải tiếp theo; API chỉ đọc, khách không được xem, không lộ thông tin liên hệ; avatar được kiểm tra quyền và `no-store`.
- Bốn ca trình duyệt desktop/narrow đã đạt: Top 20 và cập nhật điểm/cấp bậc (2 ca), Admin xem bảng trống và người chưa có điểm (2 ca sau khi chỉnh đồng hồ kiểm thử vào phạm vi cho phép). Có lỗi mạng/thử lại và tải lại giữ đúng điểm.
- Đã xem ảnh giao diện rộng/hẹp, kiểm tra không tràn ngang ở 320, 390, 768, 1280px. Dữ liệu mẫu chỉ tạo trong database kiểm thử có kiểm tra tên/kết nối trước khi ghi; database được dọn sau mỗi lượt chạy.
