# Sự cố dọn database kiểm thử ngày 15/09/2026

## Diễn biến và ảnh hưởng

Khi chạy Playwright để hoàn thiện giai đoạn 2, runner ban đầu không đóng được cây tiến trình npm/Vite trên Windows. Lỗi chờ tiến trình làm bước dọn database test chưa chạy.

Trong lúc xử lý phiên test còn sót, script hỗ trợ tạm thời gọi `destroy_test_db` khi connection vẫn trỏ tới `v_connect`. Django xóa database đang được connection cấu hình, nên database ứng dụng bị xóa nhầm. Đây là lỗi của script hỗ trợ do trợ lý tạo, không phải lỗi của chức năng tài khoản.

Đã dừng kiểm thử ngay khi phát hiện và thông báo cho người dùng. Không commit hoặc push thay đổi lên GitHub.

## Khôi phục và xác minh

- MySQL còn binary log từ thời điểm tạo database: `LAPTOP-37FU86HG-bin.000171`.
- Đã lọc riêng các sự kiện của `v_connect`, dừng trước sự kiện `DROP DATABASE` tại vị trí `304048`, rồi phát lại để khôi phục.
- Kiểm tra phạm vi trước khi phát lại: chỉ chọn database `v_connect`, không có lệnh xóa database, tạo user hoặc cấp quyền.
- Phát lại hoàn tất không lỗi. Toàn bộ 11 bảng có số bản ghi khớp với các sự kiện thêm/xóa trước sự cố: 2 User, 8 Skill, 28 Permission, 7 ContentType, 20 Migration, 2 Session; các bảng quan hệ và admin log còn lại rỗng.
- Kiểm tra migrations không còn thay đổi chờ áp dụng.
- Lưu bản sao SQL sau khôi phục và bằng chứng cục bộ trong `tmp/mysql-recovery/`, được Git bỏ qua. Các file SQL chứa dữ liệu tài khoản nên không đưa lên GitHub.

## Sửa nguyên nhân

- Xóa script dọn tạm thời gây lỗi.
- Runner khởi chạy trực tiếp tiến trình Node/Vite để có thể đóng đúng tiến trình đã tạo.
- Dùng các khối `finally` lồng nhau để lỗi đóng frontend không bỏ qua bước dọn backend/database.
- Trước khi xóa database test, bắt buộc tên có tiền tố `test_`, khác tên database ứng dụng, và tên database trong connection lẫn settings đều khớp database test.
- Thêm 5 tests cho chốt kiểm tra này, gồm trường hợp connection còn trỏ vào database ứng dụng; xác minh không gọi lệnh xóa khi điều kiện không đúng.

Chỉ tiếp tục E2E sau khi hoàn tất khôi phục và các tests chốt kiểm tra đạt.

## Kết quả chạy lại

- Playwright đạt 12/12 ca; runner đóng server và xóa đúng database test.
- Đối chiếu bản dump database ứng dụng trước và sau lượt E2E cuối: nội dung khớp hoàn toàn sau khi bỏ dòng thời gian hoàn tất dump.
- Bản sao cục bộ: `tmp/mysql-recovery/v_connect-restored-backup.sql`.
