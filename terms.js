export const terms = [
  {id:'liberties',label:'Khí',match:/khí/iu,meaning:'Giao điểm trống ngay cạnh một quân hoặc nhóm quân theo ngang/dọc. Hết khí thì cả nhóm bị bắt; không tính đường chéo.'},
  {id:'atari',label:'Atari · chỉ còn một khí',match:/atari/iu,meaning:'Nhóm chỉ còn 1 khí. Nếu đối thủ lấp khí cuối ở lượt tới và bạn không cứu được, nhóm bị bắt.'},
  {id:'eyes',label:'Mắt thật',match:/mắt/iu,meaning:'Vùng trống được một nhóm bao quanh và bảo vệ. Hai mắt thật riêng giúp nhóm không bị bắt theo luật cấm tự sát; hai điểm trống liền nhau chưa chắc là hai mắt.'},
  {id:'ko',label:'Ko · không được bắt lại ngay',match:/\bko\b/iu,meaning:'Thế hai bên có thể bắt một quân qua lại, nhưng không được bắt lại ngay để lặp thế bàn. Trước khi quay lại lấy ko, phải đi nơi khác; còn phải tuân thủ luật không lặp thế đang dùng.'},
  {id:'ko-threat',label:'Đe dọa ko',match:/đe dọa.*ko|ko.*đe dọa/isu,meaning:'Nước đi ở nơi khác, khiến đối thủ cần đáp vì bỏ qua sẽ thiệt hại đủ lớn. Sau khi họ đáp, bạn có thể quay lại lấy ko nếu hợp lệ. Đe dọa nhỏ có thể bị bỏ qua.'},
  {id:'superko',label:'Không lặp thế bàn · superko',match:/superko|thế bàn cũ|thế bàn đã/iu,meaning:'Luật trong bài tập: không được đặt quân để tái tạo bất kỳ thế bàn nào đã xuất hiện trong bài. Bộ xem SGF chỉ kiểm tra ko trực tiếp, chưa phân xử đầy đủ luật này.'},
  {id:'komi',label:'Điểm bù cho Trắng · komi',match:/komi|điểm bù/iu,meaning:'Điểm cộng cho Trắng để bù việc Đen đi trước. Ví dụ komi 6,5: Trắng đếm được 20 thì tổng sau điểm bù là 26,5.'},
  {id:'reading',label:'Đọc trước · thử một biến',match:/đọc|biến|chuỗi nước/iu,meaning:'Đọc trước là nghĩ: mình đi đâu, đối thủ đáp đâu, rồi mình đi đâu tiếp. Một biến là một chuỗi nước cụ thể; tìm được một chuỗi tốt chưa chứng minh nó thắng trước mọi cách đáp.'},
  {id:'yose',label:'Quan tử · lấy điểm cuối ván',match:/quan tử|cuối ván/iu,meaning:'Các nước thu thêm đất hoặc giảm đất đối thủ khi những nhóm chính đã ổn định. So cả số điểm và bên nào được chọn chỗ đi tiếp.'},
  {id:'sente',label:'Tiên thủ và hậu thủ',match:/sente|gote|tiên thủ|hậu thủ|lượt chủ động/iu,meaning:'Tiên thủ: nước khiến đối thủ cần đáp, nên bạn giữ quyền chọn chỗ đi tiếp. Hậu thủ: sau nước của bạn, đối thủ được chọn chỗ đi tiếp. Đi trước không tự động là tiên thủ.'},
  {id:'seki',label:'Sống chung · seki',match:/seki|sống chung/iu,meaning:'Hai bên đều sống vì bên tự lấp khí chung trước có thể bị bắt. Phải đọc thế cụ thể; có khí chung chưa đủ để kết luận sống chung.'},
  {id:'miai',label:'Hai lựa chọn thay thế · miai',match:/miai/iu,meaning:'Hai điểm cùng đạt một mục tiêu: nếu đối thủ lấy một điểm, bạn lấy điểm còn lại. Chỉ có tác dụng khi đối thủ không thể phá cả hai lựa chọn.'},
  {id:'joseki',label:'Mẫu chơi góc · joseki',match:/joseki/iu,meaning:'Chuỗi nước quen thuộc cho kết quả cân bằng ở góc. Vẫn phải chọn mẫu phù hợp các quân và nhóm yếu trên cả bàn.'},
  {id:'aji',label:'Khả năng khai thác về sau · aji',match:/aji/iu,meaning:'Quân hoặc điểm yếu chưa dùng được ngay nhưng có thể tạo cơ hội ở các nước sau. Aji-keshi là tự làm mất cơ hội đó, chẳng hạn giúp đối thủ sửa điểm cắt.'},
  {id:'snapback',label:'Bắt ngược sau hy sinh · snapback',match:/snapback/iu,meaning:'Hy sinh quân để đối thủ bắt, rồi bắt ngược một nhóm lớn hơn. Phải kiểm tra cả chuỗi; bắt lại ngay vẫn có thể hợp lệ nếu không lặp thế bàn.'},
  {id:'byoyomi',label:'Thời gian phụ · byo-yomi',match:/byo-yomi/iu,meaning:'Phần thời gian dùng sau khi hết thời gian chính. Bạn phải đi trong hạn của từng lượt hoặc từng giai đoạn, tùy quy định ván.'},
  {id:'sgf',label:'SGF · file ghi ván cờ',match:/SGF/iu,meaning:'File lưu bàn cờ, các nước đã đi, lời bình và những chuỗi nước thay thế. Có thể xuất file SGF từ nơi bạn chơi rồi mở ở “Xem lại ván”.'},
  {id:'refutation',label:'Nước hóa giải kế hoạch',match:/phản bác|hóa giải/iu,meaning:'Một cách đối thủ đáp khiến kế hoạch của bạn không còn đạt mục tiêu. Khi đọc trước, chủ động tìm cách đáp này thay vì chỉ nghĩ đối thủ sẽ đi theo ý mình.'},
  {id:'rank',label:'Kyu, dan và điểm xếp hạng',match:/kyu|dan|rating|rank|xếp hạng/iu,meaning:'Kyu giảm dần khi mạnh lên: 20 kyu → 10 kyu → 1 kyu. Tiếp theo là 1 dan, 2 dan, 3 dan… Điểm xếp hạng dựa vào các ván đấu. Các chặng của app là mục tiêu học, không cấp đẳng.'}
];
export function matchingTerms(text){return terms.filter(term=>term.match.test(text));}
export function renderTerms(root,text,{disabled=false}={}){
  root.replaceChildren();const matches=matchingTerms(text);root.hidden=disabled||!matches.length;root.open=false;
  if(root.hidden)return;
  const summary=document.createElement('summary');summary.textContent='Từ ngữ trong bài · nhấn để hiểu';root.append(summary);
  const list=document.createElement('dl');for(const term of matches){const title=document.createElement('dt'),meaning=document.createElement('dd');title.textContent=term.label;meaning.textContent=term.meaning;list.append(title,meaning);}root.append(list);
}
