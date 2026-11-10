# Tài liệu V-Connect

Đọc [README dự án](../README.md) để cài đặt và khởi chạy. Các tài liệu dưới đây được tổ chức theo chức năng hiện tại, thay cho báo cáo lặp theo từng giai đoạn hoặc đợt cập nhật.

Nếu chưa biết lập trình, bắt đầu với [Giới thiệu dự án dễ hiểu](MO_TA_DU_AN_DE_HIEU.md): mục đích, người sử dụng, quy trình minh họa và cách hiểu các loại điểm.

| Tài liệu | Nội dung |
| --- | --- |
| [Giới thiệu dự án dễ hiểu](MO_TA_DU_AN_DE_HIEU.md) | Mô tả bằng ngôn ngữ thông thường, dành cho người không chuyên về lập trình |
| [Kiến trúc](KIEN_TRUC.md) | Đường đi dữ liệu, cấu trúc Django/React, trách nhiệm các app và lựa chọn thiết kế |
| [Tài khoản và hồ sơ](TAI_KHOAN_VA_HO_SO.md) | Xác thực, phân quyền, username Admin, hồ sơ, avatar, kỹ năng và lịch rảnh |
| [Hoạt động và tham gia](HOAT_DONG_VA_THAM_GIA.md) | Hoạt động, timeline, thời gian, đăng ký, lời mời, điểm danh, phản hồi, đóng góp và xếp hạng |
| [Giao diện](GIAO_DIEN.md) | Bố cục và chức năng các trang của Tình nguyện viên, Nhà tổ chức và Admin |
| [Báo cáo và nhật ký](BAO_CAO_VA_NHAT_KY.md) | Quy tắc số liệu, Excel/PDF, tổng kết hoạt động và lịch sử trước–sau |
| [Thông báo](THONG_BAO.md) | Thông báo trong website, nhắc lịch, hàng đợi email và cấu hình SMTP |
| [AI ghép nối](AI_GHEP_NOI.md) | Cài model local, điều kiện gợi ý, điểm quy tắc/embedding, dự phòng và đánh giá |
| [AI phản hồi và báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md) | Phân tích hỗ trợ, bản nháp, nguồn dữ liệu, phép đo và giới hạn chất lượng |
| [Vận hành và sao lưu](VAN_HANH_VA_SAO_LUU.md) | Cập nhật, chạy worker, sao lưu và khôi phục |
| [Trạng thái và kiểm thử](TRANG_THAI_VA_KIEM_THU.md) | Phạm vi đã có/chưa có, lệnh kiểm tra và bảo vệ database kiểm thử |

## Dữ liệu đánh giá AI

Sáu file JSON được giữ nguyên để công cụ kiểm thử/đánh giá đọc lại và đối chiếu kết quả:

- `AI_GHEP_NOI_DANH_GIA.json` và `AI_GHEP_NOI_DANH_GIA_KET_QUA.json`: 20 cặp tổng hợp và kết quả ghép nối.
- `AI_PHAN_HOI_DANH_GIA.json` và `AI_PHAN_HOI_DANH_GIA_KET_QUA.json`: bộ chẩn đoán phát triển v1.
- `AI_PHAN_HOI_DANH_GIA_V2.json` và `AI_PHAN_HOI_DANH_GIA_V2_KET_QUA.json`: bộ đánh giá v2 độc lập và kết quả.

Không đổi dữ liệu hoặc ghi đè kết quả lịch sử để phù hợp thuật toán mới. Các số đo này có giới hạn mẫu đã nêu trong tài liệu AI, không phải độ chính xác vận hành.

Quy tắc hiện tại ưu tiên đối chiếu với mã nguồn và kiểm thử. Lịch sử từng giai đoạn, commit và log đã lược bỏ khỏi hướng dẫn; có thể tra lại trong Git khi cần.
