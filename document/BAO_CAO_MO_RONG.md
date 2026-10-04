# Báo cáo mở rộng

Phạm vi ngày 03/10/2026: biểu đồ đăng ký/điểm danh/phản hồi, bộ lọc, xuất Excel và in/lưu PDF cho Nhà tổ chức và Admin.

## Cách sử dụng

1. Đăng nhập Nhà tổ chức hoặc Admin, mở **Xem thống kê → Báo cáo mở rộng** (`/bao-cao/mo-rong`).
2. Chọn tên hoạt động, trạng thái, khoảng ngày bắt đầu; Admin có thêm lựa chọn Nhà tổ chức. Nhấn **Áp dụng bộ lọc**.
3. Xem các chỉ số tổng hợp, biểu đồ trạng thái đăng ký, kết quả điểm danh, phân bố đánh giá, trạng thái hoạt động và số liệu theo tháng.
4. Bảng chi tiết hiển thị 20 hoạt động mỗi trang. Nhấn tên hoạt động để mở báo cáo cơ bản và đối chiếu các đơn đăng ký.
5. **Xuất Excel** tải file `.xlsx` với ba sheet Tổng quan, Hoạt động, Theo tháng. File chứa toàn bộ kết quả bộ lọc, không chỉ trang đang xem.
6. **In / Lưu PDF** mở hộp thoại in của trình duyệt. Chọn **Lưu dưới dạng PDF** để lưu file; bản in dùng A4 ngang, ẩn thanh điều hướng/bộ lọc/nút thao tác, lặp tiêu đề bảng và hiển thị tất cả các trang dữ liệu. Có thể tắt đầu/chân trang mặc định của trình duyệt trong phần tùy chọn in.

Điều kiện lọc nằm trong URL nên tải lại hoặc quay lại bằng trình duyệt vẫn giữ điều kiện. **Xóa bộ lọc** trở về toàn bộ dữ liệu được phép xem. **Cập nhật số liệu** đọc lại dữ liệu hiện tại.

## Quy tắc số liệu

- Một người/hoạt động được tính một đơn theo trạng thái hiện tại. Hủy rồi đăng ký lại không tạo thêm lượt trong tổng đơn.
- Được duyệt là số đơn đang ở trạng thái được duyệt, bao gồm đơn chưa đến giờ tham gia.
- Đã tham gia chỉ tính đơn được duyệt, có điểm danh và hoạt động Hoàn thành. Lượt có mặt ở hoạt động Công khai hoặc Đã hủy được trình bày riêng.
- Phản hồi hợp lệ thuộc hoạt động Hoàn thành và đơn được duyệt, không bị Admin ẩn. Phân bố 1–5 sao và điểm trung bình đều dựa trên tập này.
- Điểm trung bình tổng thể tính bằng tổng điểm chia tổng số phản hồi hợp lệ, làm tròn hai chữ số; không lấy trung bình của các điểm trung bình hoạt động. Không có phản hồi thì hiển thị “Chưa có đánh giá”.
- Khoảng ngày bao gồm cả ngày từ và ngày đến, dựa trên **ngày bắt đầu hoạt động theo giờ Việt Nam UTC+7**. Có thể chỉ nhập một đầu khoảng ngày.
- Biểu đồ theo tháng cũng nhóm theo ngày bắt đầu hoạt động, không phải thời điểm tạo đơn/điểm danh/gửi phản hồi. Chỉ hiển thị tháng có hoạt động khớp bộ lọc.
- Mỗi báo cáo tối đa 2.000 hoạt động. Vượt giới hạn trả lỗi để người dùng thu hẹp bộ lọc; không cắt bớt dữ liệu âm thầm.
- Bảng, tổng hợp và biểu đồ của một phản hồi API được xây dựng từ cùng kết quả truy vấn tổng hợp. Excel đọc số liệu mới tại thời điểm xuất theo cùng bộ lọc; PDF in số liệu đang xem. Vì vậy số liệu có thể khác nếu nghiệp vụ thay đổi giữa hai thời điểm; thời gian lấy dữ liệu luôn được ghi trên báo cáo.

## Phân quyền và bảo vệ dữ liệu

- Organizer chỉ xem/xuất hoạt động do mình sở hữu, kể cả bản nháp. Không được gửi tham số lọc Nhà tổ chức khác để mở rộng phạm vi.
- Admin xem toàn hệ thống hoặc lọc theo một Organizer; danh sách lựa chọn bao gồm cả tài khoản bị khóa để đối chiếu dữ liệu cũ.
- Volunteer và khách không được truy cập API báo cáo mở rộng/xuất Excel/danh sách Organizer. Thống kê cá nhân của Volunteer vẫn dùng luồng hiện có.
- Mọi endpoint yêu cầu phiên đăng nhập và dùng `no-store`. Không xuất email, số điện thoại hay danh sách cá nhân tham gia trong báo cáo tổng hợp này.
- Tên hoạt động, tên tổ chức và từ khóa được ghi thành ô văn bản Excel, không phải công thức. Ký tự điều khiển không hợp lệ trong XML được loại bỏ khi xuất.
- Không lưu báo cáo Excel trên máy chủ hoặc tạo đường dẫn tải công khai. File được tạo trong bộ nhớ và trả về phiên được phép truy cập.

## API và tổ chức code

| Phương thức | Đường dẫn | Chức năng |
|---|---|---|
| GET | `/api/v1/reports/analytics/` | Tổng hợp, phân bố đánh giá, số liệu theo tháng và chi tiết hoạt động |
| GET | `/api/v1/reports/analytics/export/` | Tải Excel theo cùng bộ lọc và quyền truy cập |
| GET | `/api/v1/reports/organizers/` | Admin lấy danh sách Organizer có phân trang, chỉ gồm ID/tên/trạng thái tài khoản |

Hai endpoint analytics nhận `search`, `status` (`draft/published/completed/cancelled`), `date_from`, `date_to` (`YYYY-MM-DD`) và `organizer` (UUID, chỉ Admin). Tham số phân trang không giới hạn dữ liệu xuất.

- `backend/apps/reports/analytics.py`: xác thực bộ lọc, giới hạn quyền, tổng hợp một truy vấn để tránh nhân bản số liệu khi liên kết bảng; dùng lại điều kiện `METRICS` của nghiệp vụ chính.
- `exports.py`: tạo file Excel từ kết quả tổng hợp, định dạng bảng và xử lý ô văn bản an toàn.
- `analytics_views.py`: API và endpoint danh sách Organizer.
- `frontend/src/pages/AdvancedReportsPage.jsx`: bộ lọc, biểu đồ có nhãn số liệu, bảng phân trang và thao tác xuất/in.
- `frontend/src/styles/analytics.css`: bố cục responsive và CSS in nhiều trang.

Không cần migration mới và không thay đổi dữ liệu nghiệp vụ. Bổ sung `openpyxl==3.1.5` và phụ thuộc `et_xmlfile==2.0.0` vào requirements lock. Khi cập nhật bản cài, chạy Python trong `.venv`: `python -m pip install -r backend/requirements.lock`. Cách sử dụng thư viện: [tài liệu openpyxl](https://openpyxl.readthedocs.io/en/stable/tutorial.html).

## Kiểm chứng

123 kiểm thử backend trên MySQL, 8 kiểm thử bảo vệ runner và frontend lint/build đã đạt. Kiểm thử mới bao gồm đối chiếu với thống kê cơ bản, điểm trung bình theo số phản hồi, loại phản hồi bị ẩn, tách điểm danh hoạt động bị hủy, ranh giới ngày/tháng Việt Nam, dữ liệu rỗng, giới hạn số hoạt động, phân quyền và nội dung file Excel qua nhiều trang.

50 ca hồi quy trình duyệt đạt; 4 ca báo cáo mở rộng đạt sau khi sửa cách nhận diện ô lọc trong kiểm thử. Đã kiểm tra trên desktop và màn hình hẹp, gồm dữ liệu rỗng, ngày sai, giữ bộ lọc khi tải lại/quay lại, quyền truy cập, tải Excel và in khi đang ở trang thứ hai của bảng.

Đối chiếu file tải về xác nhận cả Excel và PDF đều có đủ 21 hoạt động kiểm thử. Bản PDF cuối gồm 3 trang A4 ngang, có số trang và tiêu đề bảng lặp lại; đã render và kiểm tra trực quan chữ tiếng Việt, biểu đồ, bảng và ngắt trang. Hoàn tất rà soát ngày 04/10/2026.

Log backend: `tmp/reports-extended-check.log`; hồi quy: `tmp/reports-extended-e2e-regression.log`; các ca báo cáo cuối: `tmp/reports-extended-e2e.log`. File kiểm chứng cuối ở `tmp/e2e-8170e19c580e/screenshots/`. Database kiểm thử đã được dọn sau mỗi lượt chạy. Báo cáo thật đọc được 8 hoạt động hiện có và tạo Excel thành công, không thay đổi dữ liệu nghiệp vụ.
