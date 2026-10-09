# Hồ sơ tình nguyện viên mở rộng

Ngày thực hiện: 27/09/2026. Phạm vi đã thống nhất: kỹ năng, sở thích và lịch rảnh hằng tuần cho Tình nguyện viên.

## Sử dụng

Mở **Chỉnh sửa hồ sơ** → **Hồ sơ tình nguyện mở rộng**. Chọn kỹ năng từ danh mục, nhập mỗi sở thích trên một dòng, thêm ngày và khoảng giờ rảnh rồi bấm **Lưu hồ sơ**. Dữ liệu được lưu cùng thông tin cơ bản. Có thể bỏ chọn kỹ năng, xóa dòng sở thích hoặc xóa khung giờ rồi lưu lại.

Các mục đều tùy chọn; bỏ trống nghĩa là chưa khai báo, không có nghĩa người dùng không có kỹ năng hoặc không thể tham gia. Chỉ chủ tài khoản xem và sửa đầy đủ thông tin mở rộng. Từ 09/10/2026, người dùng có thể bật tùy chọn cho phép Nhà tổ chức tìm thấy mình trong gợi ý (mặc định tắt); chỉ chia sẻ thông tin phù hợp với hoạt động, không chia sẻ thông tin liên hệ hoặc toàn bộ lịch rảnh. Xem [ghép nối](GHEP_NOI.md).

## Quy tắc dữ liệu

- Tối đa 20 kỹ năng có trong danh mục, không trùng. Danh mục hỗ trợ phân trang; lựa chọn ở trang khác được giữ.
- Tối đa 20 sở thích, mỗi mục 80 ký tự; bỏ khoảng trắng đầu/cuối, từ chối trùng không phân biệt hoa/thường. Sở thích nhập tự do để người dùng mô tả nhu cầu của mình.
- Tối đa 28 khung giờ mỗi tuần, theo giờ Việt Nam (UTC+7), độ chính xác tới phút. Ngày từ 0 (thứ hai) đến 6 (chủ nhật).
- Mỗi khung có giờ bắt đầu và kết thúc trong cùng ngày; kết thúc phải sau bắt đầu. Không nhận khoảng qua nửa đêm hoặc các khoảng trùng/chồng lấn cùng ngày. Hai khoảng liền nhau được chấp nhận.
- Lịch rảnh lặp hằng tuần, chưa có ngoại lệ cho từng ngày, lịch nghỉ hoặc tự động xử lý xung đột với đăng ký hoạt động.

## API và lưu trữ

Tiếp tục dùng `GET/PATCH /api/v1/auth/profile/`, bổ sung object `volunteer`. Ví dụ PATCH:

```json
{
  "volunteer": {
    "skills": [1, 2],
    "interests": ["Bảo vệ môi trường", "Giáo dục cộng đồng"],
    "availability": [
      {"weekday": 5, "starts_at": "08:30", "ends_at": "11:30"},
      {"weekday": 6, "starts_at": "14:00", "ends_at": "17:00"}
    ]
  }
}
```

ID kỹ năng phải lấy từ `/api/v1/skills/`; các ID ví dụ không bảo đảm tồn tại ở mọi database. Gửi một danh sách sẽ thay toàn bộ danh sách đó; gửi `[]` để xóa; không gửi trường thì giữ giá trị hiện tại. Nếu chưa có hồ sơ mở rộng, client coi thông tin chưa khai báo là rỗng.

`VolunteerProfile` liên kết một-một với User; kỹ năng dùng quan hệ nhiều-nhiều với Skill; sở thích lưu danh sách JSON. `AvailabilitySlot` lưu ngày và hai mốc giờ, có ràng buộc database cho ngày hợp lệ, thứ tự giờ và khung giờ trùng hoàn toàn. Kiểm tra chồng lấn ở serializer, ghi cùng transaction và khóa User với thông tin cơ bản, tránh cập nhật dở dang khi lỗi.

Migration: `accounts.0005_volunteerprofile_availabilityslot`. Chỉ thêm bảng, không sửa thông tin cũ. Hồ sơ mở rộng được tạo khi Volunteer lưu lần đầu; không tự điền kỹ năng hoặc sở thích cho tài khoản có sẵn.

## Giới hạn phạm vi

Đây là dữ liệu đầu vào cho các bước ghép nối sau này. Chưa triển khai AI, tính điểm phù hợp, giới thiệu tình nguyện viên, ghép nối hai chiều hoặc tự động đăng ký hoạt động. Không bổ sung các chức năng này chỉ vì hồ sơ đã có dữ liệu.

## Kết quả kiểm tra và dữ liệu hiện có

- 107 tests backend trên MySQL và 8 tests bảo vệ runner đạt; lint/build đạt.
- Bộ Playwright đầy đủ đạt 46/46 ca trên desktop và màn hình hẹp. Hai ca hồ sơ mở rộng được chạy lại và đạt sau khi bổ sung kiểm tra lỗi tải kỹ năng: nút Thử lại chỉ tải lại danh mục, không gửi form.
- Xác minh lưu/tải lại, giữ bản nháp khi focus, lịch chồng lấn, xóa thông tin, phân quyền, CSRF, cập nhật từng phần và rollback khi ghi dữ liệu lỗi. Database mới áp dụng đủ 29 migration; seed lặp không đổi dữ liệu.
- Đã xem ảnh giao diện cuối và kiểm tra không tràn ngang tại 320, 390, 768, 1280px.

Trước khi áp dụng migration vào MySQL80 hiện có, đã tạo snapshot `tmp/backups/snapshot-20260927-082209/` và đối chiếu SHA-256. Sau migration, đối chiếu dữ liệu tài khoản, hồ sơ Organizer, hoạt động, đơn, điểm danh, phản hồi, nhật ký và danh mục kỹ năng với trước migration: không thay đổi.

Log local: `tmp/extended-profile-check.log`, `tmp/extended-profile-e2e-full.log`, `tmp/extended-profile-e2e.log`. Ảnh cuối: `tmp/e2e-b228aeceda5e/screenshots/`. Nhánh bàn giao: `feature/profile`, kế thừa nền code tại commit `7fea0f5`.
