# Mẫu báo cáo tổng kết và chứng nhận đóng góp

Phạm vi ngày 10/10/2026: một mẫu báo cáo tổng kết hoạt động và một mẫu chứng nhận đóng góp. Có xem trước, in/lưu PDF và QR tra cứu chứng nhận. Chưa có trình thiết kế mẫu tùy ý hoặc chữ ký số.

## Báo cáo tổng kết

Nhà tổ chức vào **Báo cáo → Báo cáo từng hoạt động → Kết quả hoạt động → Mẫu báo cáo tổng kết**; Admin xem toàn hệ thống. Chỉ lập tổng kết khi hoạt động Hoàn thành và đã kết thúc.

Mẫu A4 dọc gồm thông tin hoạt động, đơn vị tổ chức, thời gian/địa điểm, nội dung, số đơn theo trạng thái, số người thực sự tham gia, số phút đóng góp đã xác nhận, số người còn chờ xác nhận, số chứng nhận hiệu lực, phản hồi hợp lệ và timeline. Có người lập và thời điểm lấy số liệu. Không tính phản hồi bị ẩn; không tự suy ra số giờ từ thời lượng hoặc giờ check-in.

Nút **Cập nhật số liệu** lấy dữ liệu mới. **In / Lưu PDF** in số liệu đang xem; chọn “Lưu dưới dạng PDF” trong hộp thoại của trình duyệt. Báo cáo không được đóng băng thành bản lưu tại máy chủ; PDF đã tải là bản tại thời điểm người dùng xuất.

## Cấp và nhận chứng nhận

- Nhà tổ chức cấp/thu hồi cho hoạt động mình quản lý; Admin cấp/thu hồi toàn hệ thống. Tình nguyện viên chỉ xem/in chứng nhận của mình.
- Từ kết quả hoạt động chọn **Cấp và quản lý chứng nhận**, hoặc tab **Chứng nhận** trong hoạt động. Chọn người rồi xác nhận cấp.
- Điều kiện: hoạt động Hoàn thành và đã kết thúc, đơn Được duyệt, có điểm danh, số phút đóng góp được xác nhận lớn hơn 0.
- Mỗi lượt điểm danh chỉ có một chứng nhận còn hiệu lực. Gửi lặp hoặc gửi đồng thời không tạo chứng nhận trùng.
- Mỗi chứng nhận có mã UUID ngẫu nhiên riêng, QR và bản chụp họ tên, tên hoạt động, đơn vị tổ chức, lịch hoạt động, số phút, phiên bản xác nhận đóng góp, người/ngày cấp. Sửa hồ sơ về sau không thay đổi nội dung chứng nhận đã cấp.
- Tình nguyện viên mở **Chứng nhận của tôi**; Nhà tổ chức/Admin mở **Quản lý chứng nhận**. Danh sách hỗ trợ tìm tên người/hoạt động, lọc trạng thái và phân trang.
- Mẫu chứng nhận A4 ngang không giả lập chữ ký hoặc con dấu. Nút in kiểm tra lại hiệu lực trước khi mở hộp thoại in.

## Thu hồi, điều chỉnh giờ và cấp lại

Thu hồi bắt buộc lý do, lưu người thực hiện và thời điểm; không xóa chứng nhận. Thu hồi lặp không ghi đè lý do đầu tiên. Chứng nhận bị thu hồi vẫn tra cứu được với trạng thái không còn hợp lệ; nút in bản hợp lệ bị vô hiệu hóa.

Khi số phút đóng góp thay đổi, chứng nhận đang hiệu lực tự thu hồi trong cùng transaction với điều chỉnh. Lưu lại số phút không đổi không thu hồi. Sau khi đối chiếu, người có quyền có thể cấp bản mới nếu còn đủ điều kiện: mã mới, số phút mới, giữ lịch sử bản cũ. Không tự cấp lại.

Nhật ký quản trị ghi cấp và thu hồi chứng nhận, kể cả thu hồi do điều chỉnh đóng góp. Nếu ghi nghiệp vụ/nhật ký lỗi, toàn bộ giao dịch rollback.

## Tra cứu công khai

Mở **Tra cứu chứng nhận** ở chân trang hoặc quét QR/đi theo đường dẫn trên chứng nhận. Chỉ tra cứu khi biết mã; không có danh sách chứng nhận công khai hoặc tìm theo tên.

Thông tin công khai chỉ gồm mã, họ tên được chứng nhận, tên hoạt động, đơn vị tổ chức, số phút, ngày cấp, trạng thái và thời điểm thu hồi. Không công khai email, số điện thoại, lý do thu hồi, ID tài khoản hoặc mô tả đầy đủ của hoạt động. Chứng nhận hoạt động Hoàn thành vẫn tra cứu được, nhưng không mở quyền xem chi tiết hoạt động đã đóng.

QR dùng địa chỉ website đang mở. Để người khác quét từ thiết bị ngoài, website cần được triển khai tại địa chỉ truy cập được. Bản PDF không tự cập nhật khi bị thu hồi; trang tra cứu là nơi kiểm tra hiệu lực hiện tại.

## Kết quả kiểm chứng ngày 10/10/2026

- 193 kiểm thử backend và 8 kiểm thử bảo vệ môi trường chạy đều đạt.
- 12 kiểm thử trình duyệt trên màn hình rộng/hẹp đều đạt, gồm cấp, tra cứu, thu hồi, cấp lại và tự thu hồi khi sửa đóng góp; kiểm tra hồi quy không gian Admin và Tình nguyện viên.
- Frontend lint và build thành công; Django system check và kiểm tra migration không phát hiện lỗi.
- Đã xuất và kiểm tra trực quan bốn PDF từ màn hình rộng/hẹp: chứng nhận A4 ngang, báo cáo A4 dọc. Với dữ liệu kiểm thử, mỗi mẫu nằm trong một trang, chữ tiếng Việt và QR rõ, không lẫn thanh điều hướng.
- Đã sao lưu dữ liệu, kiểm tra checksum và áp dụng migration chứng nhận vào MySQL80. Dữ liệu kiểm thử trình duyệt dùng database riêng và được dọn sau khi chạy.

## API và dữ liệu

- `GET /api/v1/certificates/`: danh sách theo quyền, bộ lọc `activity` (UUID), `status` (valid/revoked), `search`.
- `GET /api/v1/certificates/<id>/`: chi tiết riêng tư theo quyền.
- `GET /api/v1/certificates/<id>/verify/`: thông tin công khai tối thiểu, `no-store` và `X-Robots-Tag: noindex, nofollow`.
- `GET /api/v1/reports/activities/<id>/certificate-candidates/`: người đã được duyệt/điểm danh và điều kiện cấp.
- `POST /api/v1/reports/activities/<id>/certificates/` với `{ "attendance": "UUID" }`: cấp hoặc trả lại chứng nhận hiệu lực hiện có.
- `POST /api/v1/certificates/<id>/revoke/` với `{ "reason": "Lý do" }`: thu hồi.
- `GET /api/v1/reports/activities/<id>/summary-document/`: số liệu cho mẫu tổng kết.

Migration `reports.0004_alter_auditevent_action_certificate` thêm model Certificate và loại nhật ký. Ràng buộc một chứng nhận hiệu lực cho mỗi lượt điểm danh dùng quan hệ duy nhất nullable tương thích MySQL. Các thao tác chia sẻ khóa dòng hoạt động với xác nhận đóng góp; Django Admin chỉ đọc chứng nhận. Không gửi email riêng cho chứng nhận trong phạm vi này.
