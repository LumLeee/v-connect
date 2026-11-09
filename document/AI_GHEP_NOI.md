# AI ghép nối tình nguyện viên và hoạt động

Cập nhật ngày 09/11/2026. Ghép nối hai chiều đã bổ sung mô hình embedding đa ngôn ngữ chạy trên CPU của backend. AI so sánh ý nghĩa giữa kỹ năng/sở thích và nội dung hoạt động; các điều kiện tham gia vẫn do code kiểm tra trước. Chức năng không tự đăng ký, gửi lời mời, duyệt ứng viên hoặc chấm điểm đóng góp. [AI hỗ trợ phản hồi và bản nháp báo cáo](AI_PHAN_HOI_VA_BAO_CAO.md) dùng chung mô hình, ở mức thử nghiệm và cần người dùng kiểm tra.

## Cài đặt và chuẩn bị mô hình

Chạy từ `D:\V-connect`, sau khi đã có `.venv` và cấu hình Django trong `backend/.env`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.lock
.\.venv\Scripts\python.exe backend/manage.py prepare_matching_model
```

Lệnh chuẩn bị cần Internet để tải các tệp mô hình công khai; không cần API key, GPU hoặc kết nối database. Lệnh kiểm tra đầu ra 384 chiều, ghi manifest và SHA-256 từng tệp sau khi tải thành công. Tải vào thư mục staging rồi mới chuyển sang thư mục dùng thật. Chạy lại sẽ kiểm tra mô hình đã chuẩn bị; dùng `--force` nếu cần tải lại. Khi thay thế, thư mục cũ được giữ dưới tên backup mà lệnh in ra.

Mô hình cố định là `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, bản ONNX lượng tử hóa từ repository `Qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q`, revision `faf4aa4225822f3bc6376869cb1164e8e3feedd0`. Runtime dùng `fastembed==0.9.1` và ONNX Runtime với `CPUExecutionProvider`. Không đổi tên model trong `.env` để thay tùy ý sang mô hình khác: mã hiện tại kiểm tra đúng model và số chiều này.

Mặc định tệp nằm tại `backend/.models/matching`, đã được Git bỏ qua. Khi đưa ứng dụng sang máy khác cần chuẩn bị hoặc chuyển đầy đủ thư mục model, gồm manifest, sang máy đó. Request ghép nối chỉ mở tệp đã có với `local_files_only=True`; không tự tải model hoặc gọi dịch vụ AI bên ngoài.

Khởi động lại backend sau khi cài dependency hoặc thay biến môi trường. Mô hình được nạp lười ở lần ghép nối cần AI đầu tiên trong mỗi tiến trình.

## Cấu hình

Các giá trị sau được đọc từ `backend/.env`; đường dẫn model tương đối được tính từ thư mục `backend`.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `MATCHING_AI_ENABLED` | `true` | Bật AI; đặt `false` để dùng quy tắc cũ |
| `MATCHING_AI_MODEL` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Model cố định được hỗ trợ |
| `MATCHING_AI_MODEL_DIR` | `.models/matching` | Thư mục chứa model và manifest |
| `MATCHING_AI_TIMEOUT` | `10` | Số giây chờ công việc embedding, gồm nạp model nếu chưa nạp |
| `MATCHING_AI_THREADS` | `2` | Số luồng CPU của phiên ONNX |
| `MATCHING_AI_CACHE_SIZE` | `2048` | Số văn bản/vector tối đa lưu trong cache LRU của mỗi tiến trình; `0` tắt cache lưu lại |
| `MATCHING_AI_MAX_TEXTS` | `256` | Tối đa văn bản khác nhau trong một lần ghép nối trước phân trang |
| `MATCHING_AI_MAX_TEXT_CHARS` | `2000` | Tối đa ký tự đầu vào cho mỗi văn bản sau khi ghép các trường |
| `MATCHING_AI_MIN_SIMILARITY` | `0.35` | Ngưỡng cosine để bắt đầu cộng điểm AI |

Không đưa các cấu hình này vào biến `VITE_*`; frontend nhận trạng thái và kết quả từ API. Ngưỡng `0.35` là giá trị kỹ thuật ban đầu, chưa hiệu chỉnh trên dữ liệu vận hành.

## Đầu vào và cách tính điểm

Với mỗi hoạt động, hệ thống ghép tên hoạt động, tên kỹ năng yêu cầu và mô tả. Với hồ sơ, hệ thống ghép tên kỹ năng đã khai báo và các sở thích. Kỹ năng được sắp xếp ổn định; đầu vào bị cắt theo giới hạn ký tự. Không thêm họ tên, email, số điện thoại, bio, địa chỉ hoặc lịch rảnh vào văn bản embedding.

Sau giới hạn 2.000 ký tự, tokenizer của bản model này tiếp tục cắt ở **128 token**, gồm token đặc biệt. Phần cuối mô tả dài có thể không được mô hình đọc. Hiện chưa chia văn bản thành nhiều đoạn; tên và kỹ năng được đặt trước mô tả để giữ các thông tin chính trong đầu vào.

Hai vector được chuẩn hóa, so sánh bằng cosine `c` trong khoảng `[-1, 1]`. Khi AI chạy thành công, điểm tối đa 100 gồm:

| Thành phần | Điểm tối đa | Cách tính |
| --- | --- | --- |
| Kỹ năng khai báo trùng yêu cầu | 35 | Thành phần kỹ năng của quy tắc cũ × 0,7 |
| Sở thích trùng cụm từ | 14 | Thành phần sở thích của quy tắc cũ × 0,7 |
| Lịch rảnh bao phủ hoạt động | 21 | Thành phần lịch rảnh của quy tắc cũ × 0,7 |
| Tương đồng nội dung bằng AI | 30 | `30 × max(0, (c - 0.35) / (1 - 0.35))` |

Từng thành phần được làm tròn hai chữ số, tổng không vượt 100. Ví dụ cosine `0.675` cộng 15/30 điểm AI. Phần trăm tương đồng hiển thị là `max(0, c) × 100`, không phải xác suất được duyệt hoặc xác suất người dùng đồng ý tham gia. Điểm AI không biến một kỹ năng suy diễn thành kỹ năng người dùng đã khai báo.

Hồ sơ không có kỹ năng và sở thích không được tạo gợi ý chỉ từ embedding. Nếu cả danh sách không có đầu vào phù hợp để chạy AI, hệ thống giữ điểm quy tắc. Trong danh sách đang dùng AI có một hồ sơ thiếu nội dung, hồ sơ đó nhận 0 điểm semantic và các thành phần còn lại vẫn theo thang 35/14/21 chung.

Điều kiện công khai, tài khoản hoạt động, quyền xem, sự đồng ý xuất hiện trong gợi ý, số chỗ còn lại, trạng thái đăng ký và xung đột lịch được lọc trước inference. Các kiểm tra thời gian vẫn tuân theo `ACTIVITY_TIME_CHECKS_ENABLED` hiện có. Sau đó mới chấm điểm toàn bộ ứng viên đủ điều kiện, loại điểm 0, sắp xếp và phân trang. Không chỉ chấm AI cho trang đang xem.

## Dự phòng, riêng tư và giới hạn vận hành

Thiếu dependency/model, manifest hoặc vector lỗi, timeout, worker bận, vượt số đầu vào và lỗi inference đều chuyển **toàn danh sách của response** về công thức quy tắc cũ: kỹ năng 50, sở thích 20, lịch rảnh 30. Không trộn hai thang điểm giữa các dòng. Tắt AI cũng dùng công thức này.

API ghép nối hiện có giữ nguyên URL. Các trường bổ sung ở đầu response gồm `method`, `ai`, `component_limits`, `explanation`:

| Giá trị | Ý nghĩa |
| --- | --- |
| `method=hybrid_embeddings_v1`, `ai.status=active` | Đã áp dụng embedding; trả model và revision |
| `method=rules_v1`, `ai.status=fallback` | Đã dùng quy tắc dự phòng; `ai.reason` là mã lỗi cố định |
| `ai.status=disabled` | AI bị tắt cấu hình |
| `ai.status=not_applicable` | Không có ứng viên hoặc không có nội dung hồ sơ để so sánh |

Khi AI hoạt động, mỗi dòng có thêm `rule_score` và `semantic` với cosine, phần trăm tương đồng và điểm AI. Không trả vector, toàn bộ văn bản đầu vào, đường dẫn local hoặc exception của thư viện cho client. Giải thích là các thành phần tính điểm; không gọi mô hình sinh văn bản để suy diễn năng lực ứng viên.

Cache LRU nằm trong RAM từng tiến trình backend, chứa văn bản đầu vào và vector tương ứng, không ghi bảng database. Văn bản đã có trong cache có thể còn lại tới khi bị đẩy khỏi cache hoặc tiến trình kết thúc. Thu hồi `matching_visible` được kiểm tra trước khi tạo danh sách ở request sau, kể cả khi vector cũ còn trong RAM. Các API vẫn trả `no-store` và chỉ trả các trường ứng viên theo quyền hiện có.

Mỗi tiến trình có tối đa một công việc inference, không xếp hàng thêm. Timeout là giới hạn chờ mềm: công việc ONNX đã chạy không bị hủy cưỡng bức và có thể hoàn tất rồi đưa kết quả vào cache; request mới khi worker đang bận sẽ dùng quy tắc dự phòng. Vì vậy `MATCHING_AI_TIMEOUT` không phải cam kết thời gian tối đa cho toàn bộ request, truy vấn database hoặc phép chấm quy tắc. Mặc định vượt 256 văn bản khác nhau sẽ dùng quy tắc cho cả danh sách; cần đo tải và thiết kế xử lý nền/chỉ mục riêng khi số ứng viên tăng lớn.

Embeddings không hiểu chắc chắn phủ định, điều kiện cá nhân hoặc mọi cách diễn đạt. Chỉ khai báo lịch rảnh mới được dùng tính điểm lịch; không suy lịch từ sở thích. Model không được huấn luyện thêm trên dữ liệu V-Connect và không dùng dữ liệu nhạy cảm để suy đoán năng lực. Quyết định tham gia và xét duyệt vẫn do người dùng.

## Đánh giá mô hình thật

Bộ [20 cặp tiếng Việt](AI_GHEP_NOI_DANH_GIA.json) là dữ liệu tổng hợp, gán nhãn thủ công, không có thông tin người thật. Mỗi ca gồm một hồ sơ, một hoạt động được gán nhãn phù hợp hơn và một hoạt động gần chủ đề nhưng ít phù hợp hơn. Có 15 ca khác cách diễn đạt và 5 ca kiểm soát khớp kỹ năng trực tiếp. Hai hoạt động đều có điểm lịch bằng 0.

Lượt chạy mô hình thật ngày 08/11/2026 trong [báo cáo JSON](AI_GHEP_NOI_DANH_GIA_KET_QUA.json), dùng đúng bộ dựng văn bản và công thức production:

| Cách xếp hạng | Hoạt động dương cao hơn | Bằng điểm | Hoạt động âm cao hơn |
| --- | --- | --- | --- |
| Quy tắc cũ | 5/20 | 15/20 | 0/20 |
| Cosine mô hình | 19/20 | 0/20 | 1/20 |
| Điểm kết hợp triển khai | 19/20 | 1/20 | 0/20 |

Ca hỗ trợ di chuyển cho người khuyết tật có cosine hoạt động dương cao hơn nhưng cả hai đều dưới ngưỡng `0.35`, nên điểm kết hợp bằng nhau. Ca thiết kế đồ họa có thứ tự cosine sai; điểm kỹ năng khai báo giữ thứ tự đúng trong công thức kết hợp. Chẩn đoán câu sở thích có phủ định vẫn cho cosine khoảng `0.414` với hoạt động nấu ăn, cho thấy không thể xem embedding là xác nhận mong muốn tham gia.

Đây là kết quả trên **20 cặp tổng hợp**, không phải độ chính xác chung của hệ thống, không đo tỉ lệ được duyệt, tỉ lệ chấp nhận lời mời hoặc chất lượng với hồ sơ thực tế. Bộ dữ liệu chưa đại diện vận hành và không dùng để điều chỉnh ngưỡng/trọng số sau khi xem kết quả. Cần bộ đánh giá độc lập, có sự đồng ý sử dụng dữ liệu và thêm ngữ cảnh thực tế trước khi hiệu chỉnh.

Chạy lại từ thư mục gốc; lệnh chỉ đọc bộ dữ liệu và gọi model local, không cần truy cập MySQL:

```powershell
.\.venv\Scripts\python.exe scripts/evaluate_matching_ai.py --output tmp/matching-ai-evaluation.json
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p test_matching_ai_evaluation.py -v
```

Báo cáo lưu model revision, checksum bộ dữ liệu, kết quả từng ca và kết quả riêng từng nhóm. `--minimum-accuracy` là tùy chọn kiểm tra ngưỡng tỉ lệ xếp đúng của **điểm kết hợp**, không phải số đo xác suất.

Kiểm thử backend với inference mô phỏng kiểm tra công thức, vector lỗi, dự phòng, hồ sơ rỗng, phân trang và phân quyền. Nhóm 61 kiểm thử backend liên quan đã đạt trên MySQL tạm riêng; đây là kiểm tra tính đúng của mã và nghiệp vụ, tách biệt với chất lượng ngữ nghĩa của mô hình thật. Sáu kiểm thử công cụ đánh giá không dùng database đã đạt. Tích hợp AI không thêm bảng hoặc migration mới.

Hoàn tất kiểm chứng giao diện ngày 09/11/2026: 30 ca liên quan trên desktop/narrow đã đạt qua hai lượt chạy. Bao gồm ghép nối hai chiều bằng model thật với điểm quy tắc bằng 0, bật/thu hồi quyền xuất hiện, gửi và chấp nhận lời mời bằng giao diện, từ chối/thu hồi lời mời, dự phòng toàn danh sách, phân trang và hợp đồng API cũ. Đã xem ảnh giao diện thực tế và kiểm tra không tràn ngang ở 320–1440 px. Lint, build và `pip check` đạt; Vite còn cảnh báo kích thước bundle lớn. Database kiểm thử và tiến trình kiểm thử đã được dọn riêng.

Chạy kiểm thử trình duyệt với model thật đã chuẩn bị và database kiểm thử riêng theo hướng dẫn runner của dự án:

```powershell
$env:E2E_MATCHING_AI='true'
.\.venv\Scripts\python.exe scripts/test_e2e.py matching-ai-flow.spec.js matching-ai-ui.spec.js
```

`matching-ai-flow.spec.js` bắt buộc API báo AI đang hoạt động với đúng model/revision; không chấp nhận kết quả quy tắc dự phòng. Khi không đặt `E2E_MATCHING_AI=true`, riêng ca này được bỏ qua để các lượt kiểm thử không có model vẫn chạy được.

## Kiểm chứng nhánh AI riêng

Ngày 09/11/2026, nhánh `feature/ai-local` được tách từ `dev` tại `862c14b`, chỉ gồm AI ghép nối, phân tích phản hồi, bản nháp báo cáo và phần cấu hình/kiểm thử/tài liệu liên quan. Các thay đổi giao diện khác và việc di chuyển toàn bộ test không nằm trong nhánh này.

Trên checkout riêng: 130 kiểm thử backend của `apps.recommendations`, `apps.reports`, `apps.feedback`; 11 kiểm thử công cụ đánh giá và 9 kiểm thử bảo vệ runner đều đạt. Bốn file trình duyệt `matching-ai-flow.spec.js`, `matching-ai-ui.spec.js`, `remaining-ai-flow.spec.js`, `remaining-ai-ui.spec.js` đạt 28 lượt trên desktop/màn hình hẹp, gồm luồng AI thật của cả ba chức năng. Model thật dùng tài sản local đã chuẩn bị; kiểm thử dùng tiến trình MySQL và dữ liệu riêng, không sửa database ứng dụng.

`manage.py check`, kiểm tra không phát sinh migration, lint, build và `git diff --check` đều đạt. Model, cache, `.env`, file tạm và dữ liệu runtime không được đưa vào Git; người cài cần chạy `prepare_matching_model` theo hướng dẫn ở trên. Build còn cảnh báo bundle JavaScript hơn 500 kB.
