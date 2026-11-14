# Igo

Ứng dụng tiếng Việt học cờ vây từ đầu, chạy trên GitHub Pages, không cần backend.

18 bài học trong ba lộ trình, mỗi lộ trình có tiến độ riêng:

- Nhập môn: đặt quân, khí, bắt một quân, bắt nhóm, cứu quân và đất.
- Trung cấp: nối/cắt, atari kép, hai mắt, khí chung và ko.
- Nâng cao: biến snapback, chuyển hóa atari kép, đọc bẫy biên, đe dọa ko, seki và quan tử.

Các bài đọc biến có nước trắng đáp tự động theo biến minh họa đã ghi. Chỉ kiểm tra những biến được cung cấp, không phải solver chứng minh tất cả đáp trả. Bài khái niệm seki và quan tử nêu giả định bằng chữ, không dùng bàn trống làm bằng chứng.

Ván với máy trên bàn 9×9, 13×13 hoặc 19×19; có hai mức cơ bản và mức tìm kiếm giới hạn. Ván có thể lưu, tiếp tục, tải SGF và mở lại trong phòng xem ván. Nhãn trình độ thuộc nội dung học, không phải rank của người chơi hay sức mạnh của máy. Tiến độ nhập môn cũ được chuyển sang ID bài ổn định khi đọc dữ liệu.

## Mở ứng dụng

[Học cách chơi](https://thangldw.github.io/igo/) · [Luyện bài tập](https://thangldw.github.io/igo/train.html) · [Xem lại ván SGF](https://thangldw.github.io/igo/review.html). Tiến độ và ghi chú nằm trong browser storage; không đồng bộ tài khoản.

## Chạy

`npm start` → http://localhost:4173. `npm test` kiểm tra luật, ngân hàng bài, lưu ván, tính điểm và engine tìm kiếm.

## Luật và giới hạn

Đen đi trước; bắt nhóm hết khí; cấm tự sát; positional superko (không lặp lại thế bàn, bỏ lượt được phép). Hai lượt bỏ liên tiếp kết thúc. Đếm diện tích; komi mặc định 6,5 (0,5 khi chấp, chỉnh được). Điểm cuối chỉ là ước tính: người chơi tự đánh dấu quân chết (có gợi ý, xem bên dưới) và chưa có phân xử seki phức tạp. Chơi tiếp và bắt hết quân chết trước khi bỏ lượt. Máy heuristic không có mức rank, không dùng KataGo. Không phải triển khai đầy đủ bộ luật AGA hay Nhật.

Tham khảo: https://www.britgo.org/intro/intro2.html và https://britgo.org/rules/agashort.html. Bài tập và mã nguồn tự viết.

## Triển khai

Repository `thangldw/igo`, branch `main`. Settings → Pages → Source: GitHub Actions. Workflow kiểm tra engine và tính hợp lệ các biến bài học, đóng gói các trang, module và ngân hàng bài static rồi deploy. Asset dùng đường dẫn tương đối, chạy tại `/igo/`.

## Giao diện làm việc và tính năng mới (2026-11)

- **Bố cục hai cột**: bàn cờ cỡ theo chiều cao màn hình, bên cạnh là đề, phản hồi và thao tác; trên mobile thanh thao tác cố định phía dưới. Nút “Bài tiếp theo” chỉ nổi bật khi bài đã xong. Nút tài trợ dùng chung nằm trên đầu trang, cùng hàng với logo.
- **Hôm nay** (`train.html`): kế hoạch gồm bài đến hạn ôn trước, rồi bài mới theo lộ trình, mục tiêu 5 bài/ngày, chuỗi ngày và 7 ngày gần nhất. Dữ liệu `activity` và `goal` nằm trong `igo-study-v1` (cùng version 1; bản lưu cũ vẫn đọc được).
- **Bốn trạng thái bài** trong danh sách chọn bài: mới, ✓ đã giải, ★ nhớ qua nhiều ngày, ↻ cần ôn. **Chủ đề mạnh/yếu** tính từ số lần sai và số bài đến hạn; bấm một chủ đề để luyện ngay.
- **Gợi ý 3 mức** cho bài đọc: số khí của nhóm mục tiêu, rồi hàng chứa nước đúng, rồi nước cụ thể. Mọi mức đều tính là có hỗ trợ.
- **Phát lại nước phản bác**: đi sai thì bàn hiện nước của bạn và nước Trắng đáp trả (engine đọc), rồi “Trở lại thế hiện tại”.
- **Góc nhìn khác**: từ lần làm lại thứ hai, bài đọc được xoay/lật ngẫu nhiên trong 8 phép đối xứng. Luật cờ đối xứng nên lời giải còn nguyên (có test so sánh tập nước thắng). Chế độ kiểm tra luôn dùng hướng gốc.
- **Sao lưu tiến độ**: xuất/nhập file JSON (`igo-backup`). Nhập chỉ giữ bài còn tồn tại, bản cũ được giữ ở khóa `igo-study-v1-before-import`.
- **Offline (PWA)**: `manifest.webmanifest`, `sw.js` (precache + network-first), icon. Chỉ cache cùng origin; mở lại trang không cần mạng sau lần tải đầu. Khi thêm file mới phải thêm vào `pages.yml` và `CORE` của `sw.js`; test `deploy-manifest` kiểm tra điều này.
- **Gợi ý quân chết** khi chấm điểm: mô phỏng ngẫu nhiên (có ưu tiên bắt/cứu atari) trong Web Worker. Chỉ là gợi ý để kiểm tra, không chứng minh; chỉ nhận seki đơn giản (mọi khí của nhóm là điểm cả hai bên đều tự atari); seki có ko hoặc khí ngoài vẫn có thể bị gợi ý nhầm, hãy kiểm tra tay.
- **Chấp, komi và đồng hồ** ở ván với máy: chấp 2–9 quân trên điểm sao (máy cầm Trắng đi trước), komi chọn được, SGF xuất `HA`/`AB`/`KM`. Đồng hồ chỉ nhắc nhịp suy nghĩ của bạn, không xử thua. Bản ghi cũ không có `handicap`/`komi` vẫn chạy như trước.
- **Nhập ván từ OGS** (`review.html`): dán link hoặc số ván; app tải SGF công khai từ `online-go.com` ngay trên trình duyệt (OGS cho phép CORS). Không có tài khoản, không gửi dữ liệu đi đâu.
- **Nội dung thêm**: 3 câu kiểm chứng (bắt hai quân ở góc, điểm sao, điểm trung lập), 20 bài tesuji ở biên 6×6 (engine chứng minh đúng một nước thắng, là nước hy sinh), 10 bài đếm diện tích yose (đáp án đối chiếu `area-score.js` trong test) và 1 câu khai cuộc (đường 3/4, chỉ nêu xu hướng, không do engine kiểm). Khai cuộc là mảng còn mỏng. Chế độ kiểm tra 10 bài hiện thêm thời gian trung bình mỗi bài.

Chủ ý chưa làm: đặt tên máy theo sức chơi (chưa có hiệu chỉnh hạng), engine mạnh hơn, tài khoản/bảng xếp hạng, ước lượng hạng, đa ngôn ngữ.

## Lộ trình hướng tới 3 dan nghiệp dư

`train.html` có **210 bài bổ sung**, giữ nguyên 18 bài nhập môn và tiến độ cũ.

| Mốc nội dung | Số bài |
| --- | ---: |
| 30–20 kyu | 16 |
| 20–10 kyu | 40 |
| 10–5 kyu | 46 |
| 5–1 kyu | 32 |
| Mục tiêu 1 dan | 34 |
| Mục tiêu 2 dan | 18 |
| Mục tiêu 3 dan nghiệp dư | 24 |

Các nhãn là mục tiêu học, **chưa được hiệu chuẩn theo rating**. Không có cam kết giải hết là đạt 3 dan.

- 69 thế bắt quân và phá không gian mắt; 20 thế tạo hai mắt thật. Đây là các thế riêng được tạo tại dự án, không cộng biến xoay/lật vào số bài.
- 121 câu về luật, khí, hình cờ, đọc biến, sống/chết, hướng chơi, tấn công, ko, quan tử và thực chiến. Những câu về chiến lược nêu giả định; sơ đồ 19×19 là minh họa, không phải đánh giá tối ưu của KataGo.
- Bộ đọc minimax xét mọi nước đặt hợp lệ trên **toàn bàn bài tập**, với positional superko; lịch sử bắt đầu từ thế bài, trắng được bỏ lượt. Đen phải đặt quân để đạt mục tiêu: nếu đen bỏ lượt, trắng có thể bỏ lượt kết thúc bàn khi mục tiêu chưa đạt. Mục tiêu bắt hoặc tạo hai mắt phải đạt trong giới hạn 1–11 lượt cả hai bên. Mọi nước còn bảo đảm mục tiêu đều được chấp nhận, không chỉ một nước mẫu.
- Hai mắt được kiểm tra bằng điều kiện đủ nghiêm ngặt: hai điểm trống riêng, mỗi điểm chỉ giáp quân của cùng nhóm đen. Đây không phải bộ nhận diện mọi dạng sống/seki.
- Trắng chọn một biến đáp được bộ đọc kiểm tra. Chuỗi đã chơi có thể xem lại từng lượt. Bộ đọc có giới hạn 250.000 nút mỗi yêu cầu trong Web Worker; nếu không tính xong, trả trạng thái chưa chấm, không tự kết luận sai.
- Luyện theo mốc, lọc chủ đề, ôn bài sai/đến hạn, kiểm tra 10 bài ngẫu nhiên không gợi ý. Bài sai vào hàng ôn ngay; lịch ôn thành công tăng 1/3/7/14/30 ngày.
- Đếm riêng bài đã giải, tự giải và tự giải qua ít nhất hai ngày khác nhau mà không có lỗi xen giữa. Xem gợi ý/khí/lời giải được ghi có hỗ trợ. Xem đáp án rồi làm lại trong cùng ngày không tạo kết quả tự nhớ mới.
- Nhật ký ván và lỗi do người dùng tự ghi tại máy; không gửi dữ liệu hay xác minh rating. Mỗi mốc có nhiệm vụ thực chiến. Máy heuristic của trang nhập môn vẫn là máy cơ bản.

Tiến độ mới dùng khóa `igo-study-v1`, tách biệt `igo-progress` cũ. Dữ liệu không tương thích không bị ghi đè. ID bài đọc là fingerprint ổn định của thế/mục tiêu; ID câu hỏi được đặt theo nội dung.

### Kiểm tra và tái tạo

`npm test` kiểm tra luật, bài cũ, mọi thế mới và các nước đầu thắng, giới hạn tối thiểu đã tìm, toàn chuỗi worker, ôn tập và lưu tiến độ. Bộ đọc được đối chiếu với tìm kiếm vét cạn không cắt tỉa trên các thế 3×3.

Để tái tạo ngân hàng deterministic: `node scripts/generate-reading.mjs`, sau đó `node scripts/generate-eyes.mjs`. Bộ sinh dùng seed cố định và loại các thế không được chứng minh trong ngân sách. Không chạy bộ sinh trong trình duyệt.

Tham khảo khung chủ đề: [BGA Puzzle Sheets](https://britgo.org/covers/psmith/index.html), [BGA luật và sống/chết](https://www.britgo.org/intro/intro2.html), [BGA xếp hạng](https://www.britgo.org/about/rating). Không sao chép bài tập hoặc đáp án từ những nguồn này.

## Phòng xem ván SGF

`review.html` nhập file SGF UTF-8 tối đa 1 MB, bàn 9/13/19, một ván mỗi file. Hỗ trợ cây biến FF[4], setup AB/AW/AE (cả vùng nén), PL, nước bỏ lượt và lời bình. Kiểm tra toàn bộ cây trước khi thay ván đang mở. Không gửi file lên máy chủ.

Điều hướng từng nút hoặc cuối nhánh, chọn nhánh trong SGF, nhấn bàn thử biến riêng, bỏ lượt, lùi và trở về ván gốc. Bộ xem kiểm tra bắt quân, cấm tự sát và ko trực tiếp; chưa phân xử superko theo RU, quân chết, điểm cuối ván hoặc nước tối ưu. Vì vậy file sử dụng luật cho phép tự sát có thể bị từ chối.

Ghi ứng viên, phản bác và kết luận đối chiếu tại từng nút; lưu một ván cùng ghi chú bằng khóa riêng `igo-sgf-review-v1`. File lỗi không thay ván đang mở; bản lưu lạ không bị ghi đè. Xuất Markdown gồm ghi chú đã lưu và SGF gốc; nước thử chưa lưu không được xuất.

Hai mốc mới có 42 câu tính/đọc theo giả định, gồm quan tử hai vùng, ngân sách ko, ván sát điểm và phản bác kế hoạch. Các dạng số được lặp với tham số để luyện, không phải 42 kỹ năng khác nhau. Không có engine mạnh, kiểm duyệt bởi kỳ thủ dan hay dữ liệu hiệu chuẩn độ khó; các nhãn chỉ là mục tiêu học. Mục tiêu 3 dan phải được đánh giá bằng thực chiến trong cùng hệ rating.

Tham chiếu định dạng: [SGF FF[4]](https://www.red-bean.com/sgf/sgf4.html) và [tọa độ/nước đi cờ vây](https://www.red-bean.com/sgf/go.html).

## Điều hướng và cách diễn đạt

Ba trang dùng chung menu bốn bước luôn hiện: **1 Học cách chơi → 2 Luyện bài tập → 3 Chơi với máy → 4 Xem lại ván**. Mục đang mở được đánh dấu bằng `aria-current`; có liên kết bỏ qua menu cho bàn phím. Bài/chặng trên điện thoại dùng hộp chọn thay cho danh sách cuộn ngang. Khi chọn bài/chặng hoặc đi trước/sau, trang đưa tiêu điểm tới nội dung mới.

Địa chỉ lưu bài đang mở (`lesson`, hoặc `stage` + `problem`) nên tải lại/mở liên kết trở về đúng bài. Chế độ chơi máy có `play=1` và là bước 3 của thanh điều hướng; vào lại sẽ tự mở ván đã lưu (không còn nút “Chơi với máy”/“Tiếp tục ván đã lưu” riêng). Các khóa tiến độ cũ giữ nguyên.

Nội dung dùng tên kỹ năng, câu ngắn và phép tính từng bước. “Ngân sách ko có điều kiện” đổi thành “Đếm đe dọa ko”: đề tự giải thích ko, đe dọa, các điều kiện; đáp án trình bày từng lượt. `terms.js` cung cấp giải nghĩa theo bài, đặt cạnh đề và không hiện trong kiểm tra. Không đổi thế cờ, đáp án đúng hoặc hạng mục tiêu.

## Ván luyện với máy

Ván tự lưu ở `igo-game-v1`; tải lại tiếp tục lượt đang chờ của máy. Có tải SGF và chuyển sang phòng xem ván, không ghi đè ghi chú cũ. Đếm diện tích sau hai lượt bỏ: người chơi tự đánh dấu nhóm chết; quân đã bắt không cộng lại. Bàn có phóng to, chấm sao và xác nhận nước đi trên màn hình nhỏ.

Engine Tìm kiếm chạy trong Web Worker, xét tối đa 6 nước mỗi bên ở độ sâu 2 lượt. Phân tích sau ván dùng cùng đánh giá gần đúng (diện tích và nguy cơ nhóm thiếu khí); các đơn vị đánh giá không phải điểm cuối ván hay xác suất thắng. Không có chứng cứ hiệu chuẩn kyu/dan; đây chưa phải KataGo hoặc engine ở sức chơi dan.

## Giấy phép

Mã nguồn được phát hành theo [Apache License 2.0](LICENSE). Xem [NOTICE](NOTICE) về phạm vi áp dụng.
