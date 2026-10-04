# Igo

Ứng dụng tiếng Việt học cờ vây từ đầu, chạy trên GitHub Pages, không cần backend.

6 bài tương tác trên bàn 5×5: đặt quân, khí, bắt một quân, bắt nhóm, cứu quân và đất. Ván 9×9 với máy heuristic, lùi lượt và tiến độ lưu trong localStorage.

## Chạy

`npm start` → http://localhost:4173. `npm test` kiểm tra luật.

## Luật và giới hạn

Đen đi trước; bắt nhóm hết khí; cấm tự sát; positional superko (không lặp lại thế bàn, bỏ lượt được phép). Hai lượt bỏ liên tiếp kết thúc. Đếm diện tích với komi 6,5. Điểm cuối chỉ là ước tính vì chưa có phân xử quân chết/seki. Chơi tiếp và bắt hết quân chết trước khi bỏ lượt. Máy heuristic không có mức rank, không dùng KataGo. Không phải triển khai đầy đủ bộ luật AGA hay Nhật.

Tham khảo: https://www.britgo.org/intro/intro2.html và https://britgo.org/rules/agashort.html. Bài tập và mã nguồn tự viết.

## Triển khai

Repository `thangldw/igo`, branch `main`. Settings → Pages → Source: GitHub Actions. Workflow kiểm tra engine, đóng gói 4 file static và deploy. Asset dùng đường dẫn tương đối, chạy tại `/igo/`.
