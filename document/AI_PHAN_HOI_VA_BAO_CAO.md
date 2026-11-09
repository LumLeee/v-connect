# AI hỗ trợ phản hồi và bản nháp báo cáo

Cập nhật ngày 09/11/2026. Hai chức năng bổ sung chạy trên backend bằng mô hình embedding đa ngôn ngữ đã dùng cho [ghép nối](AI_GHEP_NOI.md). Không cần API key, mô hình sinh văn bản hoặc tải thêm mô hình khác. Đây là công cụ hỗ trợ thử nghiệm; người dùng đọc nguồn và quyết định xử lý.

## Sử dụng

Nhà tổ chức mở **Phản hồi hoạt động** của hoạt động mình quản lý, chọn mức sao và thứ tự rồi bấm **Phân tích AI**. Admin dùng nút này trong **Quản lý phản hồi**, theo bộ lọc Tất cả/Chưa ẩn/Đã ẩn. Phân tích áp dụng cho phạm vi bộ lọc qua các trang, tối đa số mẫu cấu hình; không chỉ cho trang danh sách đang mở. Kết quả cho biết phạm vi, số phản hồi được xem, giới hạn mẫu, thời điểm lấy dữ liệu, nhãn gợi ý, chủ đề, trích dẫn và nội dung cần đọc lại.

Nhà tổ chức hoặc Admin mở **Mẫu báo cáo tổng kết** của hoạt động Hoàn thành đủ điều kiện lập tổng kết rồi bấm **Soạn bản nháp AI**. Có thể sửa tiêu đề và các đoạn ngay trên trang, xem phản hồi làm căn cứ rồi sao chép. Tạo lại bản nháp sau khi đã chỉnh sửa cần xác nhận thay thế; lỗi tạo lại giữ nội dung đang sửa. Bản nháp chưa được lưu vào database hoặc tự phát hành. Nút in/lưu PDF của mẫu tổng kết vẫn sử dụng dữ liệu báo cáo gốc; sao chép là cách lấy nội dung bản nháp đã chỉnh sửa.

## Mô hình và phần quy tắc

Mô hình cố định là `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, ONNX lượng tử hóa, 384 chiều, revision `faf4aa4225822f3bc6376869cb1164e8e3feedd0`. Runtime dùng FastEmbed/ONNX Runtime trên CPU. Cài và chuẩn bị một lần theo [hướng dẫn model](AI_GHEP_NOI.md); request chỉ dùng tài sản local, không tự tải hoặc gọi dịch vụ AI ngoài.

Phân tích phản hồi so sánh vector với các câu nguyên mẫu cố định để gợi ý **Tích cực**, **Trung tính**, **Cần cải thiện** hoặc **Chưa rõ**, và các chủ đề như tổ chức, lịch trình, hậu cần, phối hợp, an toàn, ý nghĩa. Đây **không phải mô hình cảm xúc đã huấn luyện riêng**. Độ tương đồng không phải xác suất đúng. Điểm sao không được đưa vào bộ phân tích văn bản để suy nhãn cảm xúc. Nội dung yếu, nhiều chiều hoặc có phủ định được để Chưa rõ; vì vậy nhiều phản hồi tiêu cực cũng chưa được gán nhãn.

Cờ rà soát quảng cáo/an toàn có nguồn **quy tắc** riêng (`source=rules`). Mô hình có thể bổ sung tín hiệu ủng hộ (`ai_supported`), nhưng điều đó không biến cờ quy tắc thành kết luận AI. Quy tắc tìm kết hợp dấu hiệu thương mại và hành động liên hệ, hoặc cách diễn đạt sự việc an toàn; có kiểm tra phủ định và tình huống giả định. Các dấu hiệu này hẹp và bỏ sót nhiều cách diễn đạt. **Không có cờ không có nghĩa là không có sự cố hoặc quảng cáo.** Không tự ẩn, chặn người dùng, xác nhận sự cố hoặc thay đổi điểm phản hồi. Danh sách gốc vẫn cần được đọc; các mục Chưa rõ cũng được đưa vào phần xem lại.

Trích dẫn tham khảo trong phân tích phản hồi là nội dung nguyên văn từ một số nhóm nhãn được gợi ý, không phải bản tóm tắt đại diện thống kê. Trong bản nháp báo cáo, AI chọn tối đa bốn đoạn nguyên văn bằng độ gần tâm nội dung và độ đa dạng; có xét các nhóm điểm sao thấp/cao để giữ góc nhìn khác nhau. Điểm sao là dữ liệu nguồn, không phải xác nhận cảm xúc của AI.

Số liệu và các đoạn nối của bản nháp báo cáo được tạo bằng **mẫu cố định từ dữ liệu thật**: số đơn theo trạng thái, người được duyệt và điểm danh, điểm đóng góp, số phản hồi hợp lệ, điểm trung bình. MiniLM chỉ chọn trích dẫn; không viết văn bản tự do, bịa kết quả, suy người thụ hưởng, chi phí, tác động hoặc mức hài lòng của người chưa phản hồi. Mỗi trích dẫn có mã phản hồi nguồn, các phần số liệu có trường nguồn để kiểm tra lại.

## Quyền, phạm vi và dữ liệu thay đổi

- Nhà tổ chức chỉ phân tích phản hồi và lập nháp cho hoạt động của mình. Admin có phạm vi quản lý; Tình nguyện viên và khách không được gọi API quản lý này.
- Phản hồi bị ẩn không được đưa vào model, số liệu hoặc bản nháp của Nhà tổ chức. Admin có thể phân tích nội dung bị ẩn khi bộ lọc quản lý cho phép. Chỉ nội dung văn bản được đưa vào model, không tự ghép danh tính, email hoặc lý do ẩn; thông tin do người dùng tự viết trong nội dung vẫn có thể nằm trong văn bản đó.
- API trả `no-store`, thời điểm tạo và fingerprint nguồn. Đổi bộ lọc, tải lại danh sách, ẩn phản hồi hoặc thay đổi dữ liệu cần phân tích/tạo nháp lại. Nếu nguồn thay đổi trong lúc xử lý, API trả `409 source_changed` thay vì trả trích dẫn cũ. Bản nháp nhận fingerprint của mẫu tổng kết hiện tại để phát hiện số liệu đã đổi.
- Giới hạn mẫu được hiển thị rõ. Phản hồi dài được chia đoạn ngắn và giới hạn số đoạn để phù hợp cửa sổ 128 token của model; vẫn có thể mất ngữ cảnh. Không dùng kết quả mẫu để kết luận toàn bộ người tham gia.

Cache vector dùng chung nằm trong RAM từng tiến trình, theo giới hạn LRU của dịch vụ embedding. Văn bản phản hồi có thể còn trong cache tới khi bị đẩy ra hoặc tiến trình kết thúc; không ghi thành bảng AI mới hoặc log nội dung. Quyền và trạng thái ẩn vẫn được kiểm tra lại trước mỗi request. Không thêm migration cho hai chức năng này.

## Cấu hình và dự phòng

Các biến nằm trong `backend/.env`, chỉ backend đọc:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `MATCHING_AI_ENABLED` | `true` | Công tắc chung của dịch vụ embedding; tắt cũng làm phản hồi/báo cáo dùng dự phòng |
| `FEEDBACK_AI_ENABLED` | `true` | Bật nhãn/chủ đề bằng model cho phản hồi |
| `FEEDBACK_AI_MAX_ITEMS` | `40` | Tối đa phản hồi trong một lần phân tích, phạm vi hỗ trợ 1–80 |
| `REPORT_AI_ENABLED` | `true` | Bật AI chọn trích dẫn cho bản nháp báo cáo |
| `REPORT_AI_MAX_FEEDBACK` | `40` | Tối đa phản hồi hợp lệ mới nhất được xét cho bản nháp, phạm vi hỗ trợ 1–80 |

Model directory, timeout 10 giây, CPU threads 2, cache 2.048 văn bản và giới hạn 256 đầu vào dùng lại các biến `MATCHING_AI_*` trong [hướng dẫn ghép nối](AI_GHEP_NOI.md). Timeout là giới hạn chờ mềm; công việc model đang chạy không bị hủy cưỡng bức. Mỗi tiến trình chạy tối đa một công việc embedding; khi bận request khác dùng dự phòng. Khởi động lại backend sau khi đổi cấu hình.

Khi thiếu model/dependency, timeout, worker bận, vector lỗi hoặc vượt giới hạn, phân tích không gán nhãn AI giả: trả Chưa rõ và hướng dẫn đọc thủ công; cờ quy tắc vẫn hoạt động với nguồn ghi rõ. Bản nháp báo cáo vẫn có số liệu và đoạn nối từ mẫu cố định, không có trích dẫn được AI chọn. Trạng thái `active`, `fallback`, `disabled`, `not_applicable` phân biệt model đã chạy với dự phòng. Không hiển thị exception hoặc đường dẫn model cho người dùng.

## API

Các endpoint dùng phiên đăng nhập, CSRF với POST và giới hạn `ai_analysis=12/minute` theo người dùng:

| Endpoint | Dữ liệu POST | Phạm vi |
| --- | --- | --- |
| `/api/v1/organizer/activities/<id>/feedback/ai-analysis/` | `rating=all\|1\|2\|3\|4\|5`, `ordering=newest\|oldest` | Phản hồi hợp lệ của hoạt động thuộc Nhà tổ chức |
| `/api/v1/admin/feedback/ai-analysis/` | `status=all\|visible\|hidden` | Phạm vi quản lý phản hồi của Admin |
| `/api/v1/reports/activities/<id>/ai-draft/` | `{}` hoặc `expected_source_fingerprint` là SHA-256 của mẫu tổng kết hiện tại | Hoạt động đủ điều kiện tổng kết, theo quyền Nhà tổ chức/Admin |

Chỉ nhận các trường đã khai báo, không nhận prompt hoặc số liệu tự truyền từ client. Phản hồi phân tích gồm `ai`, `scope`, `source_fingerprint`, `sentiments`, `topics`, `summary`, `review_items`, `limitations`. Bản nháp gồm `ai`, `source`, `draft.sections`, `evidence`, `limitations`. `method=local_extractive_report_v1` chỉ khi AI đã chọn trích dẫn; dự phòng là `facts_template_v1`.

## Đánh giá chất lượng ngày 09/11/2026

Hai bộ đều là dữ liệu tổng hợp, không chứa người thật. Không dùng các kết quả nhỏ này làm độ chính xác vận hành, cam kết phát hiện sự cố hoặc quyết định xử lý tự động.

**V1: chẩn đoán ban đầu.** [Fixture](AI_PHAN_HOI_DANH_GIA.json) gồm 20 câu cảm xúc và 8 tình huống rà soát, SHA-256 `6a7ba7d54fdfb481df17f04192466f631d50d403d65e2858824b151e795e22a2`, được cố định trước lần chạy model đầu tiên. [Kết quả nguyên bản](AI_PHAN_HOI_DANH_GIA_KET_QUA.json) giữ nguyên: 12/20 nhãn trùng kỳ vọng, 10 câu Chưa rõ; trong 17 câu có nhãn cảm xúc xác định, model trả nhãn cho 10 câu, đúng 9. Cờ quảng cáo nhận ra 0/2, cờ sự cố 1/3 và có 1 cảnh báo nhầm. Sau kết quả này nhóm bổ sung quy tắc rà soát riêng, vì vậy **v1 hiện là dữ liệu chẩn đoán phát triển**, không còn là kiểm tra độc lập cho thuật toán đã sửa.

**V2: kiểm tra độc lập sau khi bổ sung quy tắc.** [Fixture mới](AI_PHAN_HOI_DANH_GIA_V2.json) gồm 20 câu cảm xúc mới và 8 tình huống mới, SHA-256 `e71ad02ff3aa51fa04140c7ad8fee8edbce74f8af526b4d5529073513bc91773`. Người kiểm tra cố định v2 trước khi đọc phần quy tắc mới hoặc chạy model. Không sửa ngưỡng, nguyên mẫu hay quy tắc dựa trên kết quả v2.

| Phép đo trên v2 | Kết quả |
| --- | --- |
| Nhãn trùng kỳ vọng, tính cả Chưa rõ | 12/20 |
| Số câu được để Chưa rõ | 12/20 |
| Phủ nhãn trên 16 câu có cảm xúc xác định | 8/16 |
| Đúng trong các câu có cảm xúc xác định đã được gán nhãn | 8/8; chỉ 8 câu, không phải độ chính xác vận hành 100% |
| Macro F1, gồm lớp Chưa rõ | 0,5833 |
| Cờ quảng cáo trên cả 28 câu | 2/2 nhận ra, 0 cảnh báo nhầm; cả hai do quy tắc kích hoạt |
| Cờ sự cố trên cả 28 câu | 0/3 nhận ra, 0 cảnh báo nhầm |
| Thời gian phân tích model trong lần chạy v2 | Khoảng 3,297 giây trên máy kiểm thử, không phải cam kết độ trễ |

[Kết quả v2 đầy đủ](AI_PHAN_HOI_DANH_GIA_V2_KET_QUA.json) ghi ma trận nhầm lẫn, các ca lỗi, nhãn Chưa rõ và nguồn quy tắc/AI riêng. Ba phản ánh sự cố bị bỏ sót gồm bị vật nặng rơi vào chân, đe dọa trong buổi tập huấn và đứt tay do kính. Điều này cho thấy giới hạn rõ của dấu hiệu hiện tại: phải đọc toàn bộ phản hồi, không chỉ các mục có cờ. Không có mô hình phát hiện sự cố đáng tin cậy đã được xác minh ở đây. Muốn cải thiện tiếp cần bộ dữ liệu mới, đánh giá có nhiều người gán nhãn và tập kiểm tra chưa được dùng để sửa thuật toán.

Chạy lại phép đo offline từ thư mục dự án:

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_feedback_ai.py --dataset document/AI_PHAN_HOI_DANH_GIA_V2.json --output tmp/feedback-ai-evaluation-v2.json
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p test_feedback_ai_evaluation.py -v
```

Không ghi đè kết quả v1 để giả làm kết quả thuật toán mới. Công cụ báo lỗi nếu model không active, batch bị cắt hoặc số kết quả không khớp. Bộ kiểm tra công cụ đã đạt 5 ca về tính metric, không loại nhãn Chưa rõ khỏi độ chính xác, nguồn cờ, tương ứng đầu vào và không truyền điểm sao vào model. Kết quả kiểm thử ứng dụng, trình duyệt và build được ghi riêng sau khi hoàn tất đợt tích hợp.

## Kiểm chứng tích hợp

Hoàn tất ngày 09/11/2026 trên database MySQL tạm riêng, không dùng database ứng dụng đang chạy:

- 91 kiểm thử backend liên quan đạt: phân tích phản hồi, bản nháp, mẫu tổng kết, phản hồi cũ, ghép nối và dịch vụ embedding. Bao phủ phân quyền, CSRF, giới hạn tần suất, vector/đầu vào lỗi, dự phòng, nguồn thay đổi và loại nội dung bị ẩn trước inference.
- 22 ca trình duyệt liên quan đạt qua các lượt chạy trên desktop/narrow: 12 ca giao diện mới, 2 ca mô hình thật, 8 ca hồi quy phản hồi và mẫu tổng kết. Luồng model thật bắt buộc đúng model/revision và trạng thái active; kiểm tra trích dẫn là đoạn nguyên văn trong phản hồi nguồn, số liệu khớp API gốc, không tự ghi dữ liệu, bản sửa chỉ nằm trên trang và phản hồi vừa bị ẩn không xuất hiện khi phân tích/tạo nháp lại.
- 11 kiểm thử công cụ đánh giá AI và 9 kiểm thử bảo vệ runner đạt. Lint, build và kiểm tra dependency đạt; Vite còn cảnh báo bundle JavaScript lớn. Đã xem ảnh giao diện thật và kiểm tra không tràn ngang ở 320–1440 px.

Các kiểm thử nghiệp vụ trên chứng minh hoạt động của mã nguồn, không nâng kết quả chất lượng mô hình vượt các giới hạn v2 đã công bố. Công cụ, database và tiến trình kiểm tra tạm được dọn sau khi chạy.

Chạy lại kiểm thử trình duyệt với model đã chuẩn bị và database kiểm thử riêng theo hướng dẫn của dự án:

```powershell
$env:E2E_REMAINING_AI='true'
.\.venv\Scripts\python.exe scripts/test_e2e.py remaining-ai-ui.spec.js remaining-ai-flow.spec.js
```

Nếu không đặt `E2E_REMAINING_AI=true`, riêng luồng cần mô hình thật được bỏ qua để các lượt kiểm tra giao diện không có model vẫn chạy được. Runner giữ giới hạn scoped `ai_analysis`; không thay thế các kiểm tra quyền và CSRF của ứng dụng.
