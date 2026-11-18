import { questions } from './curriculum-questions.js';

export const stages = [
  {
    id: 'foundation',
    name: '30–20 kyu',
    focus: 'Khí, bắt quân, luật và đếm diện tích',
    practice: 'Chơi 3 ván 9×9. Sau mỗi ván, ghi lại một nhóm mất quân vì thiếu khí.',
  },
  {
    id: 'tactics',
    name: '20–10 kyu',
    focus: 'Đọc hai nước đen, nối/cắt và hình cờ',
    practice: 'Chơi 3 ván 13×13 hoặc 19×19. Xem lại các điểm cắt và nhóm chỉ còn một khí.',
  },
  {
    id: 'reading',
    name: '10–5 kyu',
    focus: 'Đọc các cách đối thủ đáp, chọn hướng đi và giữ nhóm sống',
    practice:
      'Chơi 5 ván 19×19 với đối thủ có hạng. Chọn hai quyết định sai mỗi ván để tự đọc lại.',
  },
  {
    id: 'strategy',
    name: '5–1 kyu',
    focus: 'Tấn công, ko, quan tử và lựa chọn toàn bàn',
    practice:
      'Chơi 5 ván 19×19. Nhờ người mạnh hơn hoặc công cụ phân tích xem lại nhóm yếu và các nước quan tử lớn.',
  },
  {
    id: 'dan',
    name: 'Mục tiêu 1 dan',
    focus: 'Đọc nhiều nước tiếp theo và chọn nước khi ít thời gian',
    practice:
      'Duy trì thực chiến 19×19 với đối thủ có điểm xếp hạng ổn định. Theo dõi kết quả và nhờ người mạnh hơn kiểm tra các ván. Hoàn thành bài tập không tự xác nhận 1 dan.',
  },
  {
    id: 'dan2',
    name: 'Mục tiêu 2 dan',
    focus: 'Tính điểm cuối ván, tìm nước đối thủ hóa giải và lập kế hoạch',
    practice:
      'Xem lại 5 ván 19×19 của bạn trong phòng SGF. Trước khi xem phân tích, ghi hai nước đang cân nhắc và nước phản bác mạnh nhất. Đối chiếu với người mạnh hơn; ghi lỗi lặp lại.',
  },
  {
    id: 'dan3',
    name: 'Mục tiêu 3 dan nghiệp dư',
    focus: 'Đếm đe dọa ko, chọn nước trong ván sát điểm và thử chuỗi nước',
    practice:
      'Chơi với đối thủ có điểm xếp hạng ổn định trong cùng hệ. Xem lại khai cuộc, trung bàn và quan tử; nhờ người mạnh hơn kiểm tra các kết luận. Theo dõi điểm xếp hạng qua các ván đấu, không suy đẳng từ điểm bài tập.',
  },
];

export { questions };
export function stageForDepth(depth) {
  return depth === 1
    ? 'foundation'
    : depth === 3
      ? 'tactics'
      : depth === 5
        ? 'reading'
        : depth === 7
          ? 'strategy'
          : 'dan';
}
export function buildBank(readingBank) {
  return [
    ...readingBank.map((p, i) => ({
      ...p,
      id: p.id,
      kind: 'reading',
      stage:
        p.goal === 'eyes'
          ? p.depth === 1
            ? 'tactics'
            : p.depth === 3
              ? 'reading'
              : p.depth === 5
                ? 'strategy'
                : 'dan'
          : stageForDepth(p.depth),
      topic: p.shape === 'tactical' ? 'Đọc biến' : 'Sống/chết',
      title:
        p.goal === 'eyes'
          ? `Tạo hai mắt · ${i + 1}`
          : p.shape === 'tactical'
            ? `Tìm cách bắt nhóm Trắng · ${i + 1}`
            : `Ngăn nhóm Trắng sống · ${i + 1}`,
      prompt:
        p.goal === 'eyes'
          ? `Bạn cầm Đen và đi trước. Tạo hai mắt thật riêng cho nhóm có dấu tam giác trong ${Math.ceil(p.depth / 2)} nước của bạn (tổng ${p.depth} lượt của hai bên). Trắng có thể đi bất kỳ điểm hợp lệ nào hoặc bỏ lượt.`
          : `Bạn cầm Đen và đi trước. Bắt nhóm Trắng có dấu tam giác trong ${Math.ceil(p.depth / 2)} nước của bạn (tổng ${p.depth} lượt của hai bên). Trắng có thể đi bất kỳ điểm hợp lệ nào hoặc bỏ lượt.`,
      explanation:
        p.goal === 'eyes'
          ? 'Mục tiêu là hai điểm trống riêng, mỗi điểm chỉ giáp quân của cùng nhóm đen được đánh dấu. Với luật cấm tự sát, đối thủ không thể lấp một mắt để bắt nhóm còn mắt kia. App kiểm tra các cách đáp trong số lượt cho phép. Kết quả bài không đánh giá sức chơi cả ván.'
          : 'App kiểm tra các cách đặt quân của hai bên và bỏ lượt của Trắng trên bàn bài tập. Không được đặt quân để lặp lại bất kỳ thế bàn cũ nào. Bạn phải bắt nhóm trong số lượt cho phép; kết quả không đánh giá cuộc tranh ko cả bàn 19×19 hoặc xếp hạng bạn.',
    })),
    ...questions,
  ];
}
