# Tu Tiên Ký — Mô tả hình vẽ cho AI tạo ảnh

Tài liệu này mô tả mọi hình vẽ cần cho game, để dùng với một AI tạo ảnh khác. Danh sách prompt đầy đủ cho từng ảnh nằm trong `docs/art/realm-prompts.csv` (462 dòng).

## 1. Cần tạo những gì

| Nhóm | Số ảnh | Đường dẫn | Ghi chú |
|---|---:|---|---|
| Nhân vật theo bậc | 462 | `assets/realms/<lớp>/<giới>/NN.png` | 7 lớp × 2 giới × 33 bậc; NN là `01` đến `33` |
| Tâm Ma Trễ Deadline | 3 | `assets/tamma/1.png`, `2.png`, `3.png` | 3 khung chuyển động (mục 6) |

Bạn **không** cần vẽ 3 khung hào quang cho mỗi bậc. Script `scripts/gen_realms.py` sẽ tạo 3 khung "thở" (`NN-1.png`, `NN-2.png`, `NN-3.png`) từ mỗi ảnh `NN.png`. Hiệu ứng thiên phạt (sét, lóe vàng, mưa) cũng do game vẽ đè lên, không cần trong ảnh.

## 2. Quy cách chung (áp dụng cho mọi ảnh)

- **Phong cách**: pixel art, nhân vật chibi toàn thân, nhìn thẳng.
- **Kích thước giao**: 96×96 px, PNG. Nếu AI chỉ tạo được ảnh lớn (ví dụ 512×512), hãy thu nhỏ bằng phương pháp *nearest neighbor* để giữ nét pixel.
- **Nền**: **trong suốt hoàn toàn** (kênh alpha), không có nền, không có bóng sàn hình hộp. Không dùng nền navy hay bàn cờ.
- **Bố cục**: nhân vật ở giữa, cùng tư thế, cùng tỉ lệ, cùng khoảng cách tới mép trong **toàn bộ** 462 ảnh. Đầu ở khoảng 1/5 từ trên xuống, chân cách đáy khoảng 1/8.
- **Hào quang**: nằm trong khung, không bị cắt; có thể tràn gần mép nhưng không chạm mép.
- **Không có**: chữ (trừ chi tiết cố ý của lớp, mục 3), watermark, chữ ký, khung viền.
- **Nhất quán giữa các bậc**: cùng một nhân vật lớn lên theo bậc. Khuôn mặt, kiểu tóc và màu chủ đạo giữ nguyên; chỉ trang phục và hào quang thay đổi.

## 2b. Cách dựng nhân vật (quan trọng)

- **Hình chính là hình của lớp**: mỗi lớp có một concept riêng (mục 3). Mọi bậc của lớp đó phải nhận ra là cùng một nhân vật.
- **Giới tính**: Nam và Nữ khác nhau ở dáng người và kiểu tóc, giữ nguyên bản sắc của lớp.
- **Theo bậc**: hào quang tăng dần (mục 5). Trang phục và ngoại quan chỉ thay đổi nhẹ theo bậc (thêm trang trí, thêm lụa bay, vương miện ở bậc cao), không làm đổi nhân vật.
- **Prompt đầy đủ**: `docs/art/realm-prompts.csv`, mỗi dòng đã ghi lớp, giới, bậc, hào quang và đường dẫn file.

## 3. Bảy lớp nhân vật

| Lớp | Vai trò | Trang phục và đạo cụ | Bảng màu |
|---|---|---|---|
| Kiếm Tu | kiếm tu | áo trắng pha xanh ngọc, tóc buộc cao, thanh kiếm mảnh khắc chữ "refactor" | trắng, xanh ngọc, bạc |
| Đan Sư | luyện đan | áo nâu cam, lò đan nhỏ bằng đồng đeo bên hông, túi thuốc | nâu, cam, đồng |
| Trận Pháp Sư | trận pháp | áo chàm và tím, cầm la bàn bát quái, đường trận đồ phát sáng mờ dưới chân | chàm, tím, xanh lơ |
| Luyện Khí Sư | luyện pháp khí | áo xám thép, tạp dề da, búa nhỏ, vài pháp khí đang sửa dở ở thắt lưng | xám thép, nâu da, cam than hồng |
| Phù Tu | phù chú | áo đỏ và vàng, cầm xấp phù giấy vàng viết chữ đỏ trông như biểu thức chính quy (regex) | đỏ, vàng kim, vàng giấy |
| Thể Tu | luyện thể | áo cộc màu đất, tay quấn băng, thân hình rắn chắc, tay không | nâu đất, cát, đồng |
| Ma Tu | ma tu | áo đen và đỏ thẫm, khói đen bay quanh, mắt đỏ phát sáng, nụ cười tự tin | đen, đỏ thẫm, xám khói |

Mỗi lớp có một chi tiết hài cho dân lập trình (chữ "refactor" trên kiếm, phù chú giống regex). Đây là chữ cố ý duy nhất được phép xuất hiện.

## 4. Hai giới

- **Nam** và **Nữ**: cùng trang phục, cùng đạo cụ, cùng bảng màu và cùng hào quang. Chỉ khác dáng người và kiểu tóc.
- Giữ trang phục kín đáo và trang nhã, phù hợp phong cách tiên hiệp và môi trường công sở.

## 5. Ba mươi ba bậc: hào quang và độ cầu kỳ

Mỗi đại cảnh giới có một kiểu hào quang. Trong cùng đại cảnh giới, ba kỳ khác nhau ở độ sáng: **Sơ Kỳ** mờ và mảnh, **Trung Kỳ** rõ, **Hậu Kỳ** sáng và mạnh.

| Bậc | Đại cảnh giới | Hào quang | Độ cầu kỳ của trang phục |
|---|---|---|---|
| 1–3 | Luyện Khí | làn sương xanh nhạt quanh chân | đơn sơ |
| 4–6 | Trúc Cơ | một vòng sáng xanh nhạt | đơn giản |
| 7–9 | Kim Đan | quầng vàng ấm, viên cầu vàng nhỏ phát sáng ở bụng | tinh tế |
| 10–12 | Nguyên Anh | hai vòng màu oải hương, một linh thể nhỏ như đứa trẻ trong suốt lơ lửng phía sau | trang trí |
| 13–15 | Hóa Thần | lửa linh hồn màu cam quanh vai | trang trí |
| 16–18 | Luyện Hư | gợn sóng hư không màu tím quanh người | sang trọng |
| 19–21 | Hợp Thể | vòng trời đất hai màu xanh dương và nâu đất | sang trọng |
| 22–24 | Đại Thừa | vầng sen hồng lớn sau lưng | tiên khí |
| 25–27 | Độ Kiếp | tia sét xanh nhỏ lách tách quanh người, mây đen phía trên | tiên khí |
| 28–30 | Chân Tiên | tia sáng vàng nhạt tỏa ra xung quanh | thần thánh |
| 31–33 | Tiên Đế | vương miện vàng phát sáng, tia sáng vàng rực khắp người | thần thánh |

Bậc 33 (Tiên Đế Hậu Kỳ) là bậc cao nhất: hãy làm nổi bật nhất bộ, với vương miện rõ ràng.

## 6. Tâm Ma Trễ Deadline

Bóng ác ma đại diện cho thói trì hoãn deadline, xuất hiện đè lên nhân vật trong game.

- **Hình dạng**: một bóng đen lớn dạng khói, mắt đỏ phát sáng, nụ cười rộng. Trong làn khói có những hình đồng hồ bị méo và tờ lịch bay.
- **Phong cách**: pixel art 96×96, cùng bảng màu tối của bộ ảnh; **nền trong suốt** (bắt buộc, vì ảnh được vẽ đè).
- **3 khung**:
  - `1.png`: bóng mờ, mới hiện ra.
  - `2.png`: bóng rõ nhất, đang cười.
  - `3.png`: bóng nghiêng về phía trước như đang dọa.
- **Giọng điệu**: đáng sợ vừa phải và hơi hài, không kinh dị.

Prompt gợi ý: *Pixel art, 96x96, transparent background, a large shadowy smoke demon with glowing red eyes and a wide grin, distorted clocks and flying calendar pages inside the smoke, slightly comedic, dark palette, no text, no watermark.* Thêm cho từng khung: "faint and just appearing" / "fully visible and laughing" / "leaning forward menacingly".

## 7. Quy trình

1. Dùng prompt trong `docs/art/realm-prompts.csv` (cột `prompt`) để tạo từng ảnh. Lưu đúng đường dẫn ở cột `file`.
2. Nên tạo 7 ảnh bậc 1 (một cho mỗi lớp) trước để chốt khuôn mặt và trang phục, rồi dùng chúng làm ảnh tham chiếu cho các bậc sau, để nhân vật nhất quán.
3. Thu nhỏ về 96×96 bằng nearest neighbor nếu cần.
4. Đặt ảnh vào `assets/realms/...` và `assets/tamma/...`.
5. Chạy lại script để sinh 3 khung hào quang từ ảnh của bạn (chế độ này cần được thêm vào `scripts/gen_realms.py`; hiện script chỉ tự vẽ ảnh đơn giản).

## 8. Kiểm tra trước khi giao

- [ ] Đủ 462 ảnh nhân vật và 3 ảnh tâm ma, đúng tên file.
- [ ] Mọi ảnh 96×96 px, PNG.
- [ ] Cùng nền, cùng bố cục, cùng tư thế trong toàn bộ.
- [ ] Một nhân vật trông giống nhau qua 33 bậc, chỉ trang phục và hào quang đổi.
- [ ] Bậc 33 có vương miện rõ ràng.
- [ ] Ảnh tâm ma có nền trong suốt.
- [ ] Không watermark, không chữ ngoài các chi tiết cố ý của lớp.
