# Báo cáo, tổng kết và nhật ký quản trị

Tài liệu mô tả quy tắc dữ liệu và API hiện tại. Bố cục từng vai trò xem [Giao diện](GIAO_DIEN.md); cách chạy kiểm thử xem [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md).

## Phạm vi và quy tắc số liệu

Tình nguyện viên chỉ xem số liệu và đăng ký của mình. Nhà tổ chức chỉ xem hoạt động mình sở hữu; Admin xem toàn hệ thống. Backend xác định phạm vi từ phiên đăng nhập, không tin vai trò hoặc chủ sở hữu do client gửi lên.

| Chỉ số `metric` | Cách tính |
| --- | --- |
| `registered` | Tất cả đơn trong phạm vi; mỗi người/hoạt động có một đơn |
| `pending`, `approved`, `rejected`, `cancelled` | Theo trạng thái hiện tại của đơn |
| `attended_completed` | Được duyệt, có điểm danh, hoạt động Hoàn thành |
| `attended_ongoing` | Được duyệt, có điểm danh, hoạt động Công khai |
| `attended_cancelled` | Có điểm danh, hoạt động Đã hủy; giữ để đối chiếu lịch sử |

Hủy rồi đăng ký lại cập nhật đơn hiện có, không tăng số đơn tích lũy. Số được duyệt chưa đồng nghĩa đã tham gia. Phản hồi hợp lệ thuộc hoạt động Hoàn thành, đơn Được duyệt và chưa bị Admin ẩn. Điểm trung bình tổng hợp bằng tổng điểm chia tổng số phản hồi hợp lệ, làm tròn hai chữ số; không lấy trung bình của các trung bình hoạt động. Không có phản hồi thì chưa có điểm trung bình.

Các API dưới đây đều có tiền tố `/api/v1/` và yêu cầu đăng nhập:

| Phương thức | Đường dẫn | Phạm vi |
| --- | --- | --- |
| GET | `reports/overview/` | Tổng hợp theo vai trò; Admin có thêm số tài khoản |
| GET | `reports/volunteer-dashboard/` | Hồ sơ, việc cần làm, hoạt động sắp tới và lịch sử của Volunteer |
| GET | `reports/organizer-dashboard/` | Tổng quan riêng của Nhà tổ chức |
| GET | `reports/activities/` | Danh sách báo cáo hoạt động của Nhà tổ chức/Admin |
| GET | `reports/activities/<id>/` | Hoạt động và các chỉ số chi tiết của Nhà tổ chức/Admin |
| GET | `reports/participations/` | Đối chiếu từng đơn theo `metric`, `activity` tùy chọn và phân trang |

Số tổng lấy từ API trên toàn phạm vi đã lọc, không suy từ số dòng đang hiển thị. Các phản hồi dùng `no-store` để không giữ báo cáo riêng tư trong cache trình duyệt.

## Báo cáo mở rộng, Excel và PDF

Nhà tổ chức và Admin mở `/bao-cao/mo-rong`; Admin còn có `/bao-cao` với ba chế độ Tổng hợp/Theo hoạt động/Biểu đồ. Bộ lọc nằm trong URL, giữ khi phân trang, tải lại và quay lại. Nhà tổ chức xem dữ liệu của mình; Admin có thể chọn một Nhà tổ chức, kể cả tài khoản đã bị khóa để đối chiếu dữ liệu cũ.

| Phương thức | API | Công dụng |
| --- | --- | --- |
| GET | `reports/analytics/` | Tổng hợp, trạng thái, phân bố sao, số liệu theo tháng và từng hoạt động |
| GET | `reports/analytics/export/` | Excel theo cùng bộ lọc/quyền |
| GET | `reports/organizers/` | Admin lấy ID, tên và trạng thái Nhà tổ chức, có phân trang |

Analytics nhận `search`, `status=draft/published/completed/cancelled`, `date_from`, `date_to` dạng `YYYY-MM-DD`; `organizer` là UUID chỉ dành cho Admin. Khoảng ngày bao gồm cả hai đầu, dựa trên ngày bắt đầu hoạt động theo múi giờ `Asia/Ho_Chi_Minh`. Biểu đồ tháng cũng dựa trên tháng bắt đầu hoạt động, không phải ngày tạo đơn hay gửi phản hồi.

Mỗi báo cáo tối đa 2.000 hoạt động. Vượt giới hạn trả lỗi để thu hẹp bộ lọc, không âm thầm cắt dữ liệu. Bảng, tổng hợp và biểu đồ trong cùng response dùng chung tập dữ liệu.

- **Xuất Excel** tạo ba sheet Tổng quan/Hoạt động/Theo tháng, chứa toàn bộ kết quả đã lọc. Chế độ xem và trang hiện tại không giới hạn dữ liệu xuất. Tên và nội dung được ghi thành ô văn bản, không thực thi như công thức; ký tự XML không hợp lệ được loại bỏ. File tạo trong bộ nhớ, không có liên kết tải công khai.
- **In / Lưu PDF** dùng hộp thoại in của trình duyệt, A4 ngang, ẩn menu/bộ lọc/nút và in toàn bộ kết quả đang xem. Excel đọc lại dữ liệu tại thời điểm xuất; PDF in số liệu đã tải, vì vậy hai bản có thể khác nếu nghiệp vụ vừa thay đổi. Báo cáo ghi thời điểm lấy số liệu.

Báo cáo tổng hợp không xuất email, điện thoại hoặc danh sách cá nhân tham gia. Volunteer/khách không có quyền gọi analytics, xuất Excel hoặc lấy danh sách Nhà tổ chức.

## Tổng kết từng hoạt động

Mở từ trang Kết quả hoạt động tới `/bao-cao/hoat-dong/<id>/tong-ket`. Nhà tổ chức chỉ xem hoạt động của mình; Admin xem toàn hệ thống. Hoạt động phải Hoàn thành và đã kết thúc; điều kiện giờ kết thúc tuân theo `ACTIVITY_TIME_CHECKS_ENABLED` như [quy tắc thời gian](HOAT_DONG_VA_THAM_GIA.md).

`GET reports/activities/<id>/summary-document/` trả tên/đơn vị tổ chức, thời gian, địa điểm, mô tả, timeline, các chỉ số đăng ký/điểm danh/phản hồi, người lập, thời điểm và fingerprint nguồn. `contributions` gồm tổng `score`, số `confirmed` và số `pending`.

Điểm đóng góp là số nguyên 0–10 mỗi người; điểm 0 vẫn đã chấm. Tổng nhiều người có thể lớn hơn 10. Không suy điểm từ thời lượng hoặc giờ điểm danh; điểm này khác đánh giá hoạt động /5.

Bản in tổng kết là A4 dọc và chỉ chứa báo cáo số liệu gốc. Chức năng [bản nháp AI](AI_PHAN_HOI_VA_BAO_CAO.md) đứng riêng, do người dùng yêu cầu, có thể sửa/sao chép, không tự lưu/phát hành hoặc thay số liệu gốc. Nguồn thay đổi cần tạo lại; không sao chép bản nháp đã cũ.

Chứng nhận/chứng chỉ đã được gỡ. Migration `reports.0007_delete_certificate` xóa bảng chứng nhận; cần sao lưu trước khi cập nhật. Giữ nguyên các migration cũ để cài mới và nâng cấp cùng chạy đúng lịch sử. Nhật ký chứng nhận cũ vẫn đọc được. QR/mã điểm danh là chức năng riêng và tiếp tục hoạt động.

## Nhật ký thao tác

Admin tra cứu `/quan-tri/nhat-ky`, kết hợp loại thao tác, khoảng ngày, người thực hiện, tài khoản liên quan và tên hoạt động. Tìm người theo tên/email/username hiện tại. Tra cứu bằng mã dùng UUID chính xác; ngày tính theo múi giờ dự án, bao gồm hai đầu khoảng. Mở chi tiết rồi quay lại giữ nguyên bộ lọc.

| API GET | Tham số/nội dung |
| --- | --- |
| `admin/audit/` | `action`, `date_from`, `date_to`, `actor_search`, `subject_search`, `activity_search`, UUID `actor`, `subject`, `activity`, `object_id`, phân trang |
| `admin/audit/<id>/` | Chi tiết và hai trường JSON `before`, `after` |

Danh sách không tải hai trường JSON. API và Django Admin chỉ đọc nhật ký; không có thao tác thêm/sửa/xóa qua giao diện. Phản hồi dùng `no-store`.

| Nhóm thao tác | Nội dung được ghi |
| --- | --- |
| Khóa/mở khóa tài khoản | Trạng thái và lý do |
| Duyệt/từ chối đơn, xác nhận có mặt | Trạng thái trước–sau, phương thức điểm danh |
| Tạo/thu hồi mã điểm danh | Thời điểm cấp/hết hạn/thu hồi; không lưu nonce, mã ngắn hoặc token QR |
| Tạo/sửa/đổi trạng thái hoạt động | Các trường nghiệp vụ thay đổi; timeline nằm trong thao tác sửa |
| Đổi/xóa ảnh bìa | Tên tệp nội bộ; không giữ bản sao ảnh cũ |
| Ẩn phản hồi | Trạng thái và lý do xử lý |
| Xác nhận/điều chỉnh đóng góp | Điểm, revision và lý do; `object_id` là UUID điểm danh |
| Gửi/chấp nhận/từ chối/thu hồi lời mời | Trạng thái lời mời và đối tượng liên quan |

Nhật ký được ghi cùng transaction với thay đổi nghiệp vụ; lỗi ghi nhật ký làm rollback thay đổi. Lưu lại dữ liệu không đổi không tạo sự kiện giả. Dữ liệu được chọn từ danh sách trường cho phép, không sao chép toàn bộ request/model hoặc thông tin xác thực.

Tên người/hoạt động ở phần thông tin chung có thể phản ánh tên hiện tại; UUID giữ định danh. `before`/`after` là dữ liệu tại thời điểm thao tác, không dựng lại từ model hiện tại. Bản ghi cũ có thể thiếu hai trường này và được ghi rõ. Phân biệt giá trị không ghi nhận, `null`, `false`, `0` và danh sách rỗng khi đọc lịch sử.

Không phải mọi hành động đều được ghi: xem trang, sửa hồ sơ cá nhân, tự đăng ký/hủy đơn hoặc SQL trực tiếp không tự tạo sự kiện kiểm toán. Chưa có phân quyền quản trị chi tiết.

## Vị trí mã nguồn

- `backend/apps/reports/services.py`: phạm vi theo vai trò và các chỉ số `METRICS`.
- `analytics.py`, `analytics_views.py`, `exports.py`: bộ lọc, tổng hợp và Excel.
- `summary_document.py`, `ai_draft.py`: dữ liệu tổng kết và bản nháp.
- `audit.py`, `audit_filters.py`, `models.py`: snapshot, tra cứu và lưu nhật ký.
- `frontend/src/pages/AdminReportsPage.jsx`, `AdminParticipationsPage.jsx`, `ActivitySummaryDocumentPage.jsx`, `AuditPage.jsx`, `AuditDetailPage.jsx`: các trang tương ứng; Nhà tổ chức dùng `OrganizerReportsView.jsx`.

Cài dependency và chạy migration theo [hướng dẫn vận hành](VAN_HANH_VA_SAO_LUU.md). Không sửa hoặc chạy lùi migration để khớp một tài liệu lịch sử.
