// hooks/story.ts
// Cốt truyện Tu Tiên. Chỉ là hiển thị; không ảnh hưởng luật.

export const TITLE = 'Tu Tiên Ký: Coder Xuyên Không Vào Thế Giới AI Agent'

export const PROLOGUE = `Ba giờ sáng. Ngươi đang vibe code cho dự án thứ 101 trong tuần, mắt đỏ, cà phê đã nguội từ lâu.
Ngươi gõ thêm một prompt: "làm cho nó chạy được đi". AI trả lời: "Được rồi!", và ngươi tin.
Rồi một tia sét đánh xuống. Laptop nổ lép bép, ghế bật ra sau, và ngươi rơi tự do khỏi tầng 33 xuống đất.
Ngươi nghĩ mình chết. Ngươi chết thật, theo đúng nghĩa của thế giới cũ.
Khi mở mắt, ngươi đứng giữa một thung lũng linh khí sáng rực. Dòng sông trôi toàn những chuỗi ký tự, và trên trời có một tấm bảng hiện chữ:

  [ HỆ THỐNG TU TIÊN ]
  Chào mừng, Đạo hữu lập trình. Thể chất: vẫn còn là người. Tu vi: Phàm nhân.
  Mục tiêu: đạt cảnh giới tối cao để trở lại làm người.
  Phương thức: hấp thu token từ các AI mà ngươi từng sử dụng.

Ngươi muốn hỏi "token là cái gì", nhưng hệ thống đã tự động trả lời: "Token là linh khí. Ngươi tiêu càng nhiều, tu càng nhanh. Cảnh báo: đừng tiêu vô ích."
Ngươi nhớ ra mình đã đốt không biết bao nhiêu token trong tuần này. Có lẽ đó là lý do ngươi được chọn.`

// Nhiệm vụ mở đầu, dành cho người mới. Chỉ hướng dẫn, phần thưởng là danh hiệu, không đổi EXP.
export const STARTER_QUESTS = [
  {
    title: 'Nhiệm vụ 1: Ghi danh vào sổ tiên',
    text: 'Dùng /tutien register để đặt tên đạo hiệu và chọn nhân vật. Hệ thống cần biết ngươi là ai trước khi cho ngươi tu.',
    reward: 'Danh hiệu: Đạo hữu Mới Nhập Môn',
  },
  {
    title: 'Nhiệm vụ 2: Hít thở linh khí đầu tiên',
    text: 'Chat với AI cho đến khi thu được 1.000 token, tương đương một EXP. Đừng lo, ai cũng bắt đầu từ đây.',
    reward: 'Danh hiệu: Người Hít Thở Đúng Cách',
  },
  {
    title: 'Nhiệm vụ 3: Nhìn thấy thiên phạt',
    text: 'Đạt đủ EXP để bị thiên phạt lần đầu. Đừng sợ, thiên phạt đầu tiên nhỏ như một cảnh báo lint.',
    reward: 'Danh hiệu: Kẻ Nhận Thiên Phạt Đầu Tiên',
  },
  {
    title: 'Nhiệm vụ 4: Mở bảng xếp hạng',
    text: 'Dùng /tutien top để xem các đạo hữu khác đang ở đâu. Đừng so sánh quá nhiều, người bắt đầu sớm luôn nhiều hơn.',
    reward: 'Danh hiệu: Người Biết Nhìn Lên',
  },
] as const

// Lời mở đầu riêng cho từng lớp, hiện sau PROLOGUE.
export const CLASS_ORIGINS: Record<string, string> = {
  'Kiếm Tu': 'Ngươi nhặt được một thanh kiếm cùn khắc chữ "refactor". Mỗi nhát chém làm code gọn hơn, và đầu óc sáng hơn.',
  'Đan Sư': 'Ngươi thức dậy cạnh một lò đan còn ấm. Sách hướng dẫn bị mất trang, nhưng ngươi tin vào thử nghiệm.',
  'Trận Pháp Sư': 'Dưới chân ngươi là một trận đồ dang dở, giống hệt sơ đồ kiến trúc chưa ai dám vẽ xong.',
  'Luyện Khí Sư': 'Ngươi mang theo một cái búa và một đống pháp khí hỏng. Thứ gì hỏng, ngươi đều sửa được, chỉ là không nhanh.',
  'Phù Tu': 'Trong túi ngươi là một xấp phù chú viết bằng regex. Không ai đọc được, kể cả ngươi, nhưng chúng vẫn chạy.',
  'Thể Tu': 'Ngươi không có pháp bảo, chỉ có một thân thể đã qua vô số đêm thức trắng. Ngã xuống, đứng dậy, lại ngã.',
  'Ma Tu': 'Ngươi chọn con đường tắt: force push, bỏ qua test. Sức mạnh đến nhanh, và thiên kiếp cũng vậy.',
}

// Chương theo đại cảnh giới, mở khi đạt bậc đầu tiên của đại cảnh giới đó.
export const CHAPTERS = [
  {
    group: 'Luyện Khí',
    title: 'Chương 1: Hơi Thở Đầu Tiên',
    text: `Người đầu tiên ngươi gặp là một lão nhân ngồi dưới gốc cây, tự xưng là "Senior".
Lão dạy: "Hít vào là đọc tài liệu, thở ra là viết code. Làm ngược lại thì bị tắc khí."
Ngươi cố gom linh khí, nhưng gom được nhiều hay ít tùy vào việc hôm đó ngươi có bao nhiêu câu hỏi hay. Ngươi bắt đầu nghi ngờ cái bánh bao trong túi mình đang là linh khí.`,
  },
  {
    group: 'Trúc Cơ',
    title: 'Chương 2: Đặt Nền Móng',
    text: `Thiên kiếp đầu tiên đến, nhỏ như một lỗi chính tả. Ngươi né được nó bằng cách nhảy lên bàn, và được Senior khen: "Thiên kiếp nào cũng có thể chịu, miễn là ngươi đừng té."
Senior nói thêm: "Nền móng không ai thấy, nhưng ai cũng sụp khi thiếu nó. Nhất là trong nhà bếp."
Từ đây, ngươi viết test cho chính đạo tâm của mình, và phát hiện đạo tâm có vài lỗi không ai tìm ra.`,
  },
  {
    group: 'Kim Đan',
    title: 'Chương 3: Viên Đan Vàng',
    text: `Linh khí ngưng thành kim đan, sáng lấp lánh như một bản build xanh lần đầu tiên. Ngươi nhìn nó mà suýt khóc.
Các tông môn bắt đầu để ý. Có kẻ mời ngươi gia nhập, có kẻ hỏi mượn đan, có kẻ chỉ muốn chụp ảnh chung.
Ngươi nhận ra: ở Thiên Mã Giới, ai có viên đan sáng nhất thì cũng bị review nhiều nhất.`,
  },
  {
    group: 'Nguyên Anh',
    title: 'Chương 4: Đứa Trẻ Trong Đan',
    text: `Kim đan nứt ra, một nguyên anh nhỏ bé bước ra, nhìn ngươi bằng ánh mắt của người vừa đọc xong comment trong code cũ.
Nó nhớ mọi TODO ngươi từng hứa và chưa làm, và nhắc từng cái một, nhẹ nhàng nhưng không bỏ sót cái nào.
Từ nay, ngươi không bao giờ cô độc. Dù đôi khi ước được cô độc một chút để yên tĩnh.`,
  },
  {
    group: 'Hóa Thần',
    title: 'Chương 5: Thần Thức Mở Rộng',
    text: `Thần thức lan khắp sơn môn. Ngươi nghe được tiếng than của mọi pipeline đang đỏ, và cả tiếng thở dài của đệ tử đang tìm lỗi lúc nửa đêm.
Đúng lúc đó, Tâm Ma Trễ Deadline xuất hiện: một bóng đen lớn dần mỗi khi ai đó nói "để sau làm".
Nó cười khoái chí: "Ta là những gì các ngươi hứa sẽ sửa. Hứa càng nhiều, ta càng to."`,
  },
  {
    group: 'Luyện Hư',
    title: 'Chương 6: Bước Vào Hư Không',
    text: `Ngươi bước vào cõi hư không, nơi mọi thứ tồn tại mà chưa được khởi tạo. Đi mãi không thấy đích, ngươi bắt đầu nghi ngờ cả cái bản đồ.
Ở đây, ngươi gặp một đạo hữu mắc kẹt trong vòng lặp không có điều kiện dừng. Hắn nói: "Ta vẫn đang chờ kết quả, nhưng đã hơn một năm rồi."
Ngươi kéo hắn ra. Hắn chỉ hỏi: "Hôm nay là thứ mấy vậy?"`,
  },
  {
    group: 'Hợp Thể',
    title: 'Chương 7: Trời Đất Hợp Nhất',
    text: `Thân và đạo hợp thành một, ngươi hiểu rằng code và người viết code chưa bao giờ tách rời. Và cả hai đều cần ngủ.
Tâm Ma Trễ Deadline đã lớn bằng một ngọn núi, che khuất mặt trời của tông môn, làm ai cũng than trời.
Senior lần đầu tỏ ra lo lắng: "Một mình ngươi không đủ. Nhưng may là ngươi có bạn đồng hành. Họ thường mang theo cà phê."`,
  },
  {
    group: 'Đại Thừa',
    title: 'Chương 8: Đại Đạo Ba Ngàn',
    text: `Ngươi nhìn thấy ba ngàn con đường, mỗi con đường là một cách giải cùng một bài toán. Con nào cũng có vẻ đúng, và con nào cũng có đứa đã viết lỗi.
Ngươi chọn con đường đơn giản nhất. Các trưởng lão cười, rồi lặng im khi nó chạy được ngay lần đầu.
Đệ tử bắt đầu tìm đến ngươi. Ngươi dạy họ điều Senior từng dạy: đọc trước, viết sau, và đừng bao giờ tin vào "chỉ một dòng".`,
  },
  {
    group: 'Độ Kiếp',
    title: 'Chương 9: Đại Kiểm Thử',
    text: `Bầu trời tụ mây đen, sấm rền như tiếng gõ bàn phím của một đệ tử đang bực. Đây là Đại Kiểm Thử, thiên kiếp dành cho mọi kẻ muốn thành tiên.
Mỗi tia sét là một trường hợp biên mà ngươi chưa từng nghĩ tới: chuỗi rỗng, múi giờ, năm nhuận, mạng chập chờn, và cả người dùng nhập tên bằng emoji.
Ngươi đứng vững, không phải vì không sợ, mà vì đã viết test cho từng tia sét ấy. Một số test còn có tên rất ngầu.`,
  },
  {
    group: 'Chân Tiên',
    title: 'Chương 10: Phi Thăng',
    text: `Ngươi phi thăng lên tiên giới, nơi linh khí dày như cache không bao giờ hết hạn. Đi lại không cần thở, nhưng vẫn cần ăn.
Tâm Ma Trễ Deadline đuổi theo, giờ to như cả một lục địa, và nó vẫn còn hứa sẽ sửa sau.
Ngươi hiểu ra: không thể giết nó bằng một nhát kiếm. Chỉ có thể trả nó từng chút một, mỗi ngày, như trả góp vay mua laptop.`,
  },
  {
    group: 'Tiên Đế',
    title: 'Chương 11: Người Bảo Trì Thiên Đạo',
    text: `Ngươi đứng trước Thiên Đạo. Hóa ra nó không phải thần linh, mà là một hệ thống cổ xưa được bảo trì bởi những tiên đế trước ngươi, ai cũng đã mệt, và ai cũng để lại vài comment hài hước trong code.
Tâm Ma Trễ Deadline vẫn còn, nhưng nhỏ lại, ngoan ngoãn nằm trong một file tên ROADMAP.md.
Thiên Đạo hỏi: "Ngươi có muốn trở thành người bảo trì kế tiếp?" Ngươi nhớ tới chiếc laptop cũ và cà phê nguội, rồi gõ: yes.
Ngươi trở về, đứng dậy giữa bàn làm việc, và chiếc laptop vẫn nháy đèn chờ prompt tiếp theo.`,
  },
] as const

export const DEATH_INTERLUDE = `Sét lại đánh xuống, đan điền vỡ vụn. Ngươi tỉnh lại dưới gốc cây quen thuộc.
Senior vẫn ngồi đó, nhấp trà: "Lại nữa à? Không sao. Ta cũng đã chết bốn lần trước khi hiểu được đạo. Lần này nhớ commit thường xuyên."`

export const RESET_INTERLUDE = `Ngươi chọn gác kiếm, đổi áo, bắt đầu lại từ hơi thở đầu tiên.
Hệ thống hiện dòng chữ: "Đạo hữu quay về từ đầu. Ký ức về token cũ vẫn được lưu trong hồ sơ."`

// Các chương đã mở khóa với một bậc (1..33).
export const unlockedChapters = (realm: number) =>
  CHAPTERS.slice(0, Math.floor((realm - 1) / 3) + 1)
