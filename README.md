# Igo

Ứng dụng tiếng Việt học cờ vây từ đầu, chạy trên GitHub Pages, không cần backend.

18 bài trong ba lộ trình, mỗi lộ trình có tiến độ riêng:

- Nhập môn: đặt quân, khí, bắt một quân, bắt nhóm, cứu quân và đất.
- Trung cấp: nối/cắt, atari kép, hai mắt, khí chung và ko.
- Nâng cao: biến snapback, chuyển hóa atari kép, đọc bẫy biên, đe dọa ko, seki và quan tử.

Các bài đọc biến có nước trắng đáp tự động theo biến minh họa đã ghi. Chỉ kiểm tra những biến được cung cấp, không phải solver chứng minh tất cả đáp trả. Bài khái niệm seki và quan tử nêu giả định bằng chữ, không dùng bàn trống làm bằng chứng.

Ván 9×9 với máy heuristic, lùi lượt và tiến độ lưu trong localStorage. Nhãn trình độ thuộc nội dung học, không phải rank của người chơi hay sức mạnh của máy. Tiến độ nhập môn cũ được chuyển sang ID bài ổn định khi đọc dữ liệu.

## Chạy

`npm start` → http://localhost:4173. `npm test` kiểm tra luật.

## Luật và giới hạn

Đen đi trước; bắt nhóm hết khí; cấm tự sát; positional superko (không lặp lại thế bàn, bỏ lượt được phép). Hai lượt bỏ liên tiếp kết thúc. Đếm diện tích với komi 6,5. Điểm cuối chỉ là ước tính vì chưa có phân xử quân chết/seki. Chơi tiếp và bắt hết quân chết trước khi bỏ lượt. Máy heuristic không có mức rank, không dùng KataGo. Không phải triển khai đầy đủ bộ luật AGA hay Nhật.

Tham khảo: https://www.britgo.org/intro/intro2.html và https://britgo.org/rules/agashort.html. Bài tập và mã nguồn tự viết.

## Triển khai

Repository `thangldw/igo`, branch `main`. Settings → Pages → Source: GitHub Actions. Workflow kiểm tra engine và tính hợp lệ các biến bài học, đóng gói 5 file static và deploy. Asset dùng đường dẫn tương đối, chạy tại `/igo/`.
