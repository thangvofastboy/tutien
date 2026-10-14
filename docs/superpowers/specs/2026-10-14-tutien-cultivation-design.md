# Tu Tiên — mini game EXP trên Claude Code (thiết kế)

Ngày: 2026-10-14. Trạng thái: đã duyệt thiết kế; kế hoạch triển khai ở `docs/superpowers/plans/2026-10-14-tutien-cultivation.md`.

## 1. Mục tiêu

Biến token Claude Code thành tiến trình tu luyện. Chơi theo team: mỗi người tu riêng, cả team xem chung bảng xếp hạng. Chạy như mod `/tutien` trong repo `claude-tutien`.

## 2. Quy ước đã chốt

- **Nguồn token**: sự kiện `turn.complete`. Tính `input_tokens + output_tokens + cache_creation_input_tokens`. **Không tính `cache_read_input_tokens`**: đo trên máy này, cache read chiếm khoảng 98% tổng token nhưng rất rẻ.
- **Tỷ lệ**: 1.000 token = 1 EXP (trước khi áp bonus).
- **Mức đỉnh chuẩn**: 20.000.000 token/ngày (chọn làm mốc thiết kế; ngày cao nhất đo được trên máy là 17,4 triệu).
- **33 bậc** = 11 đại cảnh giới × 3 kỳ (Sơ, Trung, Hậu). EXP của mỗi bậc riêng, lên bậc thì về 0.
- **Danh tính**: tên tự đặt + khóa bí mật server cấp lúc đăng ký. Khóa lưu trong `$.store` trên máy.
- **Mức đệm thiên phạt**: 750.000 token/ngày (xem mục 4).

## 3. Kiến trúc

- **Mod (client)**: hooks module trong repo này. Đọc token từ `turn.complete`, gửi lên server, vẽ pane.
- **Server**: Cloudflare Worker + Durable Objects, **một Durable Object cho mỗi người chơi**. DO giữ EXP, bậc, pháp bảo, trạng thái thiên phạt. Request trong DO được xử lý tuần tự nên không có race.
- **Bảng xếp hạng**: roster Durable Object giữ ảnh chụp của từng người chơi, tính ra nhiều bảng (mục 16).
- **Luật dùng chung**: `hooks/rules.ts` là nguồn duy nhất; server và mod đều import từ đây.

### API (Worker)

| Route | Auth | Body | Trả về |
|---|---|---|---|
| `POST /register` | không | `{name, cls, gender}` | `{key}`, hoặc 409 nếu tên đã có |
| `POST /usage` | Bearer | `{turnId, tokens}` | `{player, events}` |
| `POST /appearance` | Bearer | `{cls, gender}` | `{player}` |
| `POST /reset` | Bearer | `{cls, gender}` | `{player}` (bậc 1, EXP 0, không pháp bảo, lớp và giới mới) |
| `GET /me` | Bearer | — | `{player}` (đã settle) |
| `GET /leaderboard?board=<loại>` | không | — | `{rows}`, sắp theo loại bảng (mục 16) |

**Chống gửi trùng**: DO lưu tập `turnId` đã xử lý (tối đa 1.000 gần nhất).
**Mất mạng**: mod đệm lượt trong `$.store` (tối đa 500), gửi lại khi kết nối lại.

## 4. Luật tu luyện

- Khi EXP đạt ngưỡng bậc hiện tại, người chơi **bị thiên phạt**: phải tích lũy đủ token thiên phạt của bậc đó trong **cửa sổ thiên phạt**.
- **Cửa sổ thiên phạt** (ngày) = ⌈ token thiên phạt ÷ 750.000 ⌉ + bonus lớp (Trận Pháp Sư +12 giờ). Cửa sổ được tính lúc bắt đầu thiên phạt và cố định cho lần đó. Bảng mục 6.
- Trong lúc thiên phạt, EXP giữ ở ngưỡng và token được tính vào thiên phạt. Token đến sau hạn không tính.
- **Vượt thiên phạt**: lên bậc kế, EXP về 0. Khi lên đại cảnh giới mới (xem mục 5, pháp bảo), có thể nhận một pháp bảo. Sau đó chịu tỷ lệ tử vong.
- **Quá hạn**: EXP về 0 (Luyện Khí Sư giữ 15% ngưỡng), giữ bậc, đánh dấu "vừa trượt" để Thể Tu được giảm yêu cầu lần kế.
- **Tử vong**: mỗi lần vượt thiên phạt thành công có tỷ lệ chết (mặc định 2%, theo lớp và pháp bảo). Chết → về Luyện Khí Sơ Kỳ, EXP 0, **mất hết pháp bảo**.
- Bậc 33 là tối đa: không còn thiên phạt, token vẫn tính vào tổng để xếp hạng.
- Thời hạn do server ghi nhận, không tin giờ máy người chơi.

**Quy ước thiên phạt**: rời bậc *i* (1 đến 32) lên bậc *i+1* cần đạt ngưỡng EXP `need_i`, rồi vượt thiên phạt `trib_i` = `round(20.000.000 × (0,1 + 0,7 × (i-1)/31))` trong cửa sổ thiên phạt của bậc *i*.

## 5. Bonus lớp và pháp bảo

Lớp nhân vật có một bonus nhỏ, và mọi lớp đều phải cân bằng trong mô phỏng (mục 7).

| Lớp | Bonus |
|---|---|
| Kiếm Tu | +3% EXP từ token |
| Đan Sư | token thiên phạt cần ít hơn 5% |
| Trận Pháp Sư | cửa sổ thiên phạt +12 giờ |
| Luyện Khí Sư | khi trượt, giữ 15% ngưỡng EXP thay vì 0 |
| Phù Tu | tỷ lệ tử vong 1,75% (thay vì 2%) |
| Thể Tu | sau một lần trượt, thiên phạt kế tiếp cần ít hơn 10% |
| Ma Tu | +5% EXP, tỷ lệ tử vong 2,5% |

**Pháp bảo**: khi lên một đại cảnh giới mới (bậc 4, 7, 10, …, 31; tổng 10 lần), có **20%** nhận ngẫu nhiên một pháp bảo (chọn đều một trong 3 loại). Không rơi khi lên tiểu kỳ.

| Pháp bảo | Hiệu lực mỗi cái | Trần |
|---|---|---|
| Tụ Linh Bình | +0,5% EXP | +1,5% |
| Phá Kiếp Phù | −1% token thiên phạt | −2,5% |
| Hộ Mệnh Ngọc | −0,05% tỷ lệ tử vong | −0,15% |

Trần giữ cho người may mắn không vượt quá xa. Pháp bảo hiển thị trong `/tutien status` và pane.

## 6. Bảng cảnh giới (cơ sở, chưa tính bonus)

| Bậc | Cảnh giới | EXP cần để rời bậc | Thiên phạt (token) | Cửa sổ (ngày) |
|---:|---|---:|---:|---:|
| 1 | Luyện Khí Sơ Kỳ | 8,000 | 2.0M | 3 |
| 2 | Luyện Khí Trung Kỳ | 9,881 | 2.5M | 4 |
| 3 | Luyện Khí Hậu Kỳ | 12,204 | 2.9M | 4 |
| 4 | Trúc Cơ Sơ Kỳ | 15,072 | 3.4M | 5 |
| 5 | Trúc Cơ Trung Kỳ | 18,616 | 3.8M | 6 |
| 6 | Trúc Cơ Hậu Kỳ | 22,992 | 4.3M | 6 |
| 7 | Kim Đan Sơ Kỳ | 28,398 | 4.7M | 7 |
| 8 | Kim Đan Trung Kỳ | 35,073 | 5.2M | 7 |
| 9 | Kim Đan Hậu Kỳ | 43,319 | 5.6M | 8 |
| 10 | Nguyên Anh Sơ Kỳ | 53,501 | 6.1M | 9 |
| 11 | Nguyên Anh Trung Kỳ | 66,079 | 6.5M | 9 |
| 12 | Nguyên Anh Hậu Kỳ | 81,614 | 7.0M | 10 |
| 13 | Hóa Thần Sơ Kỳ | 100,800 | 7.4M | 10 |
| 14 | Hóa Thần Trung Kỳ | 124,497 | 7.9M | 11 |
| 15 | Hóa Thần Hậu Kỳ | 153,765 | 8.3M | 12 |
| 16 | Luyện Hư Sơ Kỳ | 189,913 | 8.8M | 12 |
| 17 | Luyện Hư Trung Kỳ | 234,559 | 9.2M | 13 |
| 18 | Luyện Hư Hậu Kỳ | 289,701 | 9.7M | 13 |
| 19 | Hợp Thể Sơ Kỳ | 357,806 | 10.1M | 14 |
| 20 | Hợp Thể Trung Kỳ | 441,922 | 10.6M | 15 |
| 21 | Hợp Thể Hậu Kỳ | 545,812 | 11.0M | 15 |
| 22 | Đại Thừa Sơ Kỳ | 674,125 | 11.5M | 16 |
| 23 | Đại Thừa Trung Kỳ | 832,604 | 11.9M | 16 |
| 24 | Đại Thừa Hậu Kỳ | 1,028,338 | 12.4M | 17 |
| 25 | Độ Kiếp Sơ Kỳ | 1,270,087 | 12.8M | 18 |
| 26 | Độ Kiếp Trung Kỳ | 1,568,669 | 13.3M | 18 |
| 27 | Độ Kiếp Hậu Kỳ | 1,937,443 | 13.7M | 19 |
| 28 | Chân Tiên Sơ Kỳ | 2,392,911 | 14.2M | 19 |
| 29 | Chân Tiên Trung Kỳ | 2,955,454 | 14.6M | 20 |
| 30 | Chân Tiên Hậu Kỳ | 3,650,244 | 15.1M | 21 |
| 31 | Tiên Đế Sơ Kỳ | 4,508,369 | 15.5M | 21 |
| 32 | Tiên Đế Trung Kỳ | 5,568,230 | 16.0M | 22 |
| 33 | Tiên Đế Hậu Kỳ | cảnh giới tối đa | — | — |

## 7. Cân bằng công bằng

- Mô phỏng `scripts/balance.ts` chạy 3 mức dùng token: **1 triệu/ngày (ít)**, **4,37 triệu/ngày (vừa, trung bình đo được)**, **20 triệu/ngày (nhiều, mức đỉnh thiết kế)**, cộng nhiễu ±30% mỗi ngày, cộng pháp bảo và tử vong.
- Tiêu chí: với mỗi mức dùng, số ngày trung bình để đạt bậc 33 của các lớp **chênh so với trung bình không quá ±3%**.
- Các con số bonus ở mục 5 là điểm xuất phát; mô phỏng sẽ chỉnh chúng cho đến khi đạt tiêu chí. Không thể cân bằng hoàn toàn cho mọi kiểu người chơi, nên tiêu chí áp dụng cho từng mức dùng riêng.
- Test đơn vị giữ con số đã chọn để không lệch khi sửa luật.

## 8. Hình nhân vật (pixel art)

- Script Python `scripts/gen_realms.py` sinh **1.386 ảnh PNG** (7 lớp × 2 giới × 33 bậc × 3 khung hào quang, mục 15) tại `assets/realms/<lớp>/<giới>/NN-F.png`. Seed cố định theo lớp, giới, bậc nên tái tạo được.
- Giới chỉ đổi hình (dáng người), không có bonus.
- **Hiển thị**: element `Image`, nguồn `{file, format: 'png'}` với đường dẫn tuyệt đối từ `$.plugin.root`, kích thước 24×12 ô.
- **Dự phòng**: `alt` là một dòng mô tả bậc, hiện khi terminal không hiển thị được ảnh.

## 9. Mod: lệnh và pane

- `/tutien update`: checkout tag mới nhất và reload plugin (đã triển khai).
- `/tutien register <tên> <lớp> <giới>`: đăng ký, lưu khóa vào `$.store`.
- `/tutien persona <tên>` hoặc `/tutien persona tuy-chinh <mô tả>`: chọn tính cách nhân vật (mục 17). Sau khi đăng ký, mod nhắc người chơi chọn persona.
- `/tutien appearance <lớp> <giới>`: đổi lớp và giới, chỉ đổi hình và bonus lớp (bonus áp dụng theo lớp hiện tại).
- `/tutien status`: bậc, phần trăm tiến độ, thiên phạt (phần trăm đã góp, thời gian còn lại), pháp bảo. Không hiện số EXP hay số token (mục 19.6).
- `/tutien reset confirm <lớp> <giới>`: quay về Luyện Khí Sơ Kỳ và **chọn lại nhân vật** (lớp và giới mới). Xóa bậc, EXP, thiên phạt, pháp bảo, và lớp, giới cũ. Giữ tên, khóa và tổng token trọn đời; ghi thêm số lần reset trên hồ sơ. Gõ `/tutien reset` không có `confirm` thì chỉ hiện cảnh báo và danh sách lớp, giới.
- `/tutien top`: in **cả 5 bảng** xếp hạng cùng lúc, dạng văn bản (mục 16). Không có tham số.
- Pane `tu-tien`: ảnh bậc hiện tại, thanh EXP, trạng thái thiên phạt, pháp bảo.

## 10. Lỗi và giới hạn

- **Gian lận**: mod tự báo số token. Đây là giới hạn chấp nhận được cho team nội bộ.
- **Terminal không hỗ trợ ảnh**: vẫn chơi được, chỉ thấy dòng mô tả.
- **Lượt không có `usage`**: tính là 0 token.

## 11. Kiểm thử

- Luật thuần (ngưỡng, thiên phạt, cửa sổ, quá hạn, bonus lớp, pháp bảo, tử vong): test đơn vị trong `claude plugin test`.
- Server: route với `turnId` trùng, khóa sai, chuỗi lên bậc → thiên phạt → quá hạn.
- Pane: `$.ui.mount` trên terminal, có `Image` đúng bậc.
- Mô phỏng cân bằng: chạy `node --experimental-strip-types scripts/balance.ts`, đạt tiêu chí mục 7.

## 12. Ngoài phạm vi

- Đấu tay đôi giữa người chơi (PvP): dễ mất cân bằng, cần thiết kế riêng.
- Mua bán vật phẩm giữa người chơi: phức tạp, dễ phát sinh gian lận.
- Hệ thống tiền thật: vượt phạm vi mini game nội bộ.
- Nhiều server hoặc đa team.

## 13. Lời thoại nhân vật (hài hước)

- Pane hiển thị một câu thoại ngắn, vui nhộn, dưới ảnh nhân vật. Câu đổi mỗi lần pane vẽ lại hoặc sau mỗi 60 giây.
- **Nhóm thoại** theo sự kiện, ưu tiên từ trên xuống:
  1. Vừa chết (quay về Luyện Khí).
  2. Vừa trượt thiên phạt.
  3. Đang thiên phạt (còn ít thời gian, hoặc chưa góp đủ token).
  4. Vừa lên bậc (lên đại cảnh giới).
  5. Thoại theo đại cảnh giới hiện tại (11 nhóm, mỗi nhóm vài câu).
  6. Thoại chung khi không có sự kiện.
- **Số câu**: khoảng 5 câu cho mỗi nhóm, tổng khoảng 70 câu. Lưu trong `hooks/lines.ts`, không gọi server.
- Giọng văn: hài nhẹ, nhại lại tiên hiệp và việc dùng Claude Code (ví dụ "Token đâu rồi, thiên phạt đang đợi"). Không chế giễu người chơi cụ thể.
- Lời thoại chỉ là hiển thị, không ảnh hưởng luật.

## 14. Hiệu ứng thiên phạt

Hiệu ứng chạy trên client, dựa vào sự kiện trả về từ `/usage` (`events`), không cần server thêm dữ liệu.

- **Bắt đầu thiên phạt** (`tribulation-started`): pane chớp sét khoảng 4 giây, đổi giữa vài khung ASCII tia sét mỗi 250 ms. Toast: "Thiên phạt giáng xuống! Còn N ngày để vượt qua."
- **Vượt thiên phạt** (`breakthrough`): pane lóe vàng 1,5 giây. Toast: "Đột phá thành công!"
- **Trượt thiên phạt** (`tribulation-failed`): pane tối lại kèm vài dòng mưa, khoảng 3 giây. Toast: "Thiên phạt hết hạn, EXP tan thành mây khói."
- **Chết** (`death`): pane nháy đỏ 1 giây, toast báo về Luyện Khí.

Kỹ thuật: một atom `effect` giữ loại hiệu ứng và thời điểm kết thúc; `$.clock.every(250, ...)` đổi khung và tự dừng khi hết thời gian. Hiệu ứng chỉ là hình ảnh; không ảnh hưởng luật hay dữ liệu.

Tùy chọn chưa chốt: âm thanh (`$.audio.play`) cần file âm thanh riêng trong `assets/`. Mặc định là chưa có âm thanh.

## 15. Hào quang theo cấp độ

Hào quang được vẽ sẵn vào ảnh nhân vật (script `scripts/gen_realms.py`), không tính toán lúc chạy.

| Đại cảnh giới | Hào quang |
|---|---|
| Luyện Khí | Làn sương mờ quanh chân |
| Trúc Cơ | Một vòng sáng nhạt |
| Kim Đan | Quầng vàng tròn, sáng ở bụng |
| Nguyên Anh | Hai lớp vòng, một bóng nhỏ phía sau |
| Hóa Thần | Lửa linh hồn quanh vai |
| Luyện Hư | Gợn sóng hư không, viền tím |
| Hợp Thể | Vòng trời đất, hai màu xanh và nâu |
| Đại Thừa | Vầng sen sau lưng |
| Độ Kiếp | Tia sét nhỏ quanh người |
| Chân Tiên | Tia sáng tỏa ra như nắng |
| Tiên Đế | Vương miện sáng và tia sáng toàn thân |

- **Theo kỳ**: Sơ Kỳ mờ, Trung Kỳ rõ hơn, Hậu Kỳ sáng nhất (độ sáng và độ rộng tăng dần).
- **Chuyển động**: mỗi ảnh có **3 khung** (hào quang co, vừa, giãn). Pane đổi khung mỗi 400 ms bằng `$.ui.blit` trên `Image` có `key`, nên không vẽ lại cả pane.
- **Số file**: 7 lớp × 2 giới × 33 bậc × 3 khung = **1.386 PNG**, đường dẫn `assets/realms/<lớp>/<giới>/NN-F.png` (F = 1, 2, 3). Ảnh nhỏ (96×96), tổng dung lượng dự kiến vài MB.
- **Hiệu ứng thiên phạt** (mục 14) vẽ đè tạm thời; hết hiệu ứng thì hào quang chạy lại bình thường.
- Terminal không hiển thị ảnh: vẫn có dòng mô tả, không có hào quang.

## 16. Bảng xếp hạng

Có 5 bảng. Mỗi bảng sắp theo một tiêu chí, người bằng điểm thì xếp theo tên.

| Bảng | Tiêu chí (giảm dần) | Lấy từ |
|---|---|---|
| **Tu vi** (mặc định) | bậc, rồi EXP | trạng thái hiện tại |
| **Chăm chỉ** | tổng token trọn đời | cộng dồn, không bị reset |
| **Tuần này** | token trong 7 ngày gần nhất | cửa sổ trượt theo ngày |
| **Phượng hoàng** | số lần đã chết (bậc bị đưa về 1) | cộng dồn |
| **Pháp bảo** | số pháp bảo đang giữ, rồi bậc | trạng thái hiện tại |

- **Server**: hồ sơ người chơi lưu thêm `lifetimeTokens`, `weekTokens` (mảng token theo ngày, tối đa 7 ngày), `deaths`. Roster lấy các trường này để tính bảng. Với bảng Tuần này, server cộng dồn theo ngày UTC và bỏ các ngày quá 7 ngày.
- **Lệnh**: `/tutien top` in toàn bộ 5 bảng, mỗi bảng tối đa 10 dòng, và thứ hạng của chính bạn ở cuối mỗi bảng. Không có lệnh con theo loại.
- **Pane**: các nút chọn bảng (`Button`) ở đầu phần xếp hạng; bấm để đổi bảng. Mặc định hiển thị 5 dòng đầu và vị trí của bạn.
- **Hiển thị**: mỗi dòng có hạng, tên, lớp, bậc và một cột điểm theo bảng. Bảng Tu vi hiện bậc và phần trăm tiến độ; các bảng khác hiện hạng và phần trăm so với người đứng đầu (mục 19.6).
- **Dữ liệu cũ**: người chơi đăng ký trước khi có bảng mới được tính từ lúc server ghi nhận; `lifetimeTokens` và `deaths` bắt đầu từ 0.

## 17. Persona (tính cách nhân vật)

Persona chỉ đổi giọng nói của nhân vật, **không ảnh hưởng luật**. Chọn sau khi đăng ký, đổi được bất cứ lúc nào; reset (mục 9) xóa persona cùng nhân vật.

**Persona có sẵn** (mỗi cái có câu cửa miệng và khoảng 10 câu thoại riêng, trộn vào bộ thoại chung):

| Persona | Giọng | Câu cửa miệng ví dụ |
|---|---|---|
| Lầy Lội | đùa mọi lúc, không nghiêm túc | "Tu thì tu, nhưng cười cái đã." |
| Lạnh Lùng | ít nói, cụt lủn | "Hừ." |
| Hiền Lành | nhẹ nhàng, động viên | "Không sao đâu, từ từ mà tu." |
| Kiêu Ngạo | tự cao, coi thường thiên kiếp | "Thiên phạt? Chỉ đáng làm khởi động." |
| Lười Biếng | chỉ muốn ngủ | "Để mai tu tiếp." |
| Cuồng Code | nói chuyện như log và commit | "git commit -m \"đột phá\"" |
| Triết Gia | nói câu sâu xa, đôi khi vô nghĩa | "Token là gì, nếu không phải là thời gian?" |

**Persona tự nhập**:
- `/tutien persona tuy-chinh <mô tả>`, mô tả tối đa 200 ký tự.
- Mod gọi `$.model.complete` **một lần** để sinh 15 câu thoại ngắn (dưới 120 ký tự mỗi câu) theo mô tả, tiếng Việt, giữ giọng hài và không xúc phạm ai. Kết quả lưu trong `$.store` trên máy.
- Lần gọi model này không phải lượt chat, nên không tính EXP.
- Nếu model lỗi hoặc trả về rỗng, dùng bộ thoại mặc định và báo người chơi.

**Lưu trữ**: tên persona (hoặc "Tùy chỉnh") lưu trên server cùng hồ sơ, để bảng xếp hạng hiển thị; câu thoại tùy chỉnh chỉ lưu trên máy người chơi.

**Hiển thị**: pane và `/tutien status` dùng thoại của persona khoảng một nửa số lần, nửa còn lại là bộ thoại chung (mục 13).

## 18. Tính năng mở rộng

Các tính năng dưới đây đều dựa trên nền hiện có. Mục đánh dấu **[cân bằng]** ảnh hưởng tốc độ tu, nên phải đưa vào mô phỏng (mục 7) trước khi chốt.

### 18.1 Tông môn
- `/tutien tong tao <tên>`, `/tutien tong vao <tên>`, `/tutien tong roi`. Tối đa 10 thành viên mỗi tông.
- **Điều kiện lập tông**: phải đạt **Nguyên Anh Sơ Kỳ (bậc 10)** trở lên. Gia nhập tông thì không có điều kiện.
- Tông chủ chết hoặc reset vẫn giữ tông; người khác không tự động lên làm tông chủ.
- Tông có **Tổng tu vi** (tổng chỉ số bậc của các thành viên) và bảng xếp hạng tông riêng, thêm vào `/tutien top`.
- Server: một Durable Object cho mỗi tông, lưu danh sách thành viên.

#### Chức vụ trong tông **[cân bằng]**

Tông chủ bổ nhiệm bằng `/tutien tong bo-nhiem <tên> <chức vụ>`. Mỗi chức vụ có điều kiện bậc tối thiểu và số chỗ giới hạn.

| Chức vụ | Số chỗ | Bậc tối thiểu | Bonus |
|---|---:|---|---|
| Tông Chủ | 1 | Nguyên Anh Sơ Kỳ (10) | +1% EXP |
| Phó Tông Chủ | 1 | Kim Đan Sơ Kỳ (7) | +0,75% EXP |
| Trưởng Lão | 2 | Kim Đan Sơ Kỳ (7) | −1% token thiên phạt |
| Hộ Pháp | 2 | Trúc Cơ Sơ Kỳ (4) | −0,05% tỷ lệ tử vong |
| Chân Truyền Đệ Tử | 2 | không | +0,5% EXP |
| Đệ Tử | còn lại | không | không có |

- Bonus chức vụ cộng chung vào trần tổng bonus của mục 5, không vượt trần.
- Thành viên bị tụt dưới bậc tối thiểu (do chết hoặc reset) thì mất chức vụ, trở thành Đệ Tử.

#### Nhiệm vụ tông môn hằng tuần

- **Mục tiêu tông**: tổng token của cả tông trong tuần (thứ Hai đến Chủ nhật, UTC+7) đạt **2.000.000 × số thành viên**.
- **Đóng góp tối thiểu**: mỗi thành viên phải đóng góp ít nhất **20%** phần của mình (400.000 token/tuần).
- **Không đạt mục tiêu tông**: toàn bộ bonus chức vụ bị tạm dừng trong tuần kế tiếp.
- **Thành viên không đạt đóng góp tối thiểu**: mất bonus chức vụ của riêng mình trong tuần kế tiếp; nếu hai tuần liền không đạt, tông chủ được thông báo để cân nhắc cho rời tông.
- Tiến độ nhiệm vụ hiện trong `/tutien status` và pane.

#### Cân bằng với tán tu

- **Tán tu** (người không thuộc tông nào) được bonus **Tự Do: +0,5% EXP** và không có nhiệm vụ tuần.
- Lý do: thành viên tông thường (Đệ Tử) không có bonus nhưng có nhiệm vụ; chức vụ có bonus nhưng có điều kiện và có thể bị tạm dừng. Tán tu được bù bằng một bonus nhỏ, cố định.
- Mô phỏng (mục 7) chạy thêm hai kịch bản: **tán tu** và **thành viên tông** ở từng chức vụ, giữ chênh lệch trung bình giữa tán tu và thành viên tông không quá ±3%.

### 18.2 Bạn đồng hành **[cân bằng]**
- `/tutien ban <tên>`: mời, người kia chấp nhận bằng `/tutien ban chap-nhan <tên>`.
- Khi cả hai có token trong cùng 24 giờ, mỗi bên nhận thêm **0,5% EXP** từ lượt đó. Tối đa một lần mỗi ngày mỗi bên.

### 18.3 Thông báo kênh chung
- Server gửi một dòng tới webhook của team (Slack hoặc Discord) khi có người **đột phá đại cảnh giới** hoặc **chết**.
- Webhook lưu dưới dạng secret của Worker, không nằm trong mod.

### 18.4 Nhiệm vụ hằng ngày
- Mỗi ngày (theo múi giờ UTC+7) có một nhiệm vụ: dùng **500.000 token** trong ngày.
- Hoàn thành 10 ngày (không cần liên tục) thì nhận 1 pháp bảo ngẫu nhiên. Mỗi ngày chỉ tính một lần.
- Nhiệm vụ hiện trong `/tutien status` và pane.

### 18.5 Thành tựu
- 8 huy hiệu, ví dụ: lần đầu đột phá, vượt thiên kiếp không chết, 30 ngày liên tục có token, đạt Hóa Thần.
- Server tính huy hiệu khi có sự kiện tương ứng; hiển thị trong `/tutien status`.
- Huy hiệu không ảnh hưởng luật.

### 18.6 Lịch sử tu luyện
- Server lưu token và EXP theo ngày, giữ 90 ngày.
- `/tutien history`: biểu đồ cột văn bản bằng ký tự khối cho 14 ngày gần nhất.

### 18.7 Bí cảnh **[cân bằng]**
- **Mở một lần mỗi tháng**, vào **ngày 1 đến ngày 7** của tháng (theo múi giờ UTC+7).
- Ghi danh bằng `/tutien bicanh` trong **ngày 1 đến ngày 2** của tháng. Không ghi danh thì bỏ qua tháng đó.
- Thử thách kéo dài 7 ngày (ngày 1 đến ngày 7), mỗi ngày phải dùng ít nhất **1.000.000 token**.
- Hoàn thành: nhận một pháp bảo hiếm chọn ngẫu nhiên từ 3 loại mạnh hơn bình thường: Tụ Linh Bình hiếm (+1,5% EXP), Phá Kiếp Phù hiếm (−2,5% token thiên phạt), Hộ Mệnh Ngọc hiếm (−0,1% tử vong). Trần tổng bonus như mục 5 vẫn áp dụng.
- Bỏ một ngày là thất bại của tháng đó. Thất bại hoặc thành công đều không ảnh hưởng tháng sau.
- Đang thiên phạt thì không ghi danh được.

### 18.8 Luyện đan **[cân bằng]**
- `/tutien luyen-dan <loại>`: tiêu một pháp bảo cùng loại để luyện một viên đan. Tối đa một viên đan có hiệu lực cùng lúc.
- Ba loại đan:
  - **Đan Hộ Thể**: lần vượt thiên phạt kế tiếp chỉ chịu **một nửa** tỷ lệ chết.
  - **Đan Tốc Tu**: +10% EXP trong 24 giờ.
  - **Đan Thông Thiên**: giảm 10% token thiên phạt lần kế tiếp.
- **Giới hạn**:
  - Giữ tối đa **2 viên đan** trong túi, chưa tính viên đang có hiệu lực.
  - Đan Hộ Thể và Đan Thông Thiên: mỗi loại dùng tối đa một lần cho mỗi đại cảnh giới.
  - Đan Tốc Tu: tối đa một lần mỗi 14 ngày.
- Đan có hiệu lực một lần và được ghi vào hồ sơ; reset làm mất đan đang giữ.

### 18.9 Đạo lữ **[cân bằng]**
- `/tutien dao-lu <tên>`, cần người kia chấp nhận bằng `/tutien dao-lu chap-nhan <tên>`. Mỗi người chỉ có một đạo lữ.
- Đạo lữ nhận **2% EXP** từ mỗi lượt của người kia, tối đa 20.000 EXP mỗi ngày mỗi bên.
- Hủy đạo lữ bằng `/tutien dao-lu huy`, không mất tài nguyên.

### Tác động đến kiến trúc
- **Server**: thêm các Durable Object cho tông môn, nhiệm vụ ngày, lịch sử, thành tựu, và quan hệ (bạn đồng hành, đạo lữ). Roster giữ nguyên.
- **Mod**: thêm lệnh cho tông, bạn, đạo lữ, luyện đan, bí cảnh, lịch sử; hiển thị nhiệm vụ và thành tựu trong pane.
- **Luật thuần** (`hooks/rules.ts`): thêm bonus đồng hành, đạo lữ, đan, bí cảnh vào `applyUsage`, có test riêng cho từng cái.
- **Mô phỏng**: chạy lại `scripts/balance.ts` với các bonus **[cân bằng]**, giữ chênh lệch lớp trong ±3%.

### Mức bonus (đã giảm để cân bằng)
- Mọi bonus lớp, pháp bảo, đồng hành, bí cảnh, đan và đạo lữ đã giảm khoảng một nửa so với đề xuất ban đầu. Tỷ lệ rơi pháp bảo khi lên đại cảnh giới giảm từ 30% xuống 20%.
- Các con số này vẫn là điểm xuất phát; mô phỏng (mục 7) sẽ chỉnh tiếp nếu chênh lệch giữa các lớp vượt ±3%.

## 19. UX/UI

### 19.1 Người mới
- **Hướng dẫn lần đầu**: lần mở pane đầu tiên hiện 3 bước: đăng ký, chọn nhân vật, dùng Claude Code như bình thường. Mỗi bước một câu, có nút "Bỏ qua".
- **Thanh tiến độ**: hai thanh ngang, một cho EXP, một cho thiên phạt, chỉ hiện phần trăm và thời gian còn lại (mục 19.6).
- **Dòng trạng thái cố định**: một dòng cuối pane luôn hiện bậc, EXP và thiên phạt, để không cần gõ `/tutien status`.

### 19.2 Trải nghiệm chơi
- **Màu theo trạng thái**: xanh khi đang tu, vàng khi gần thiên phạt (còn dưới 25% token hoặc dưới 12 giờ), đỏ khi sắp hết giờ (dưới 1 giờ), xám khi chưa đăng ký.
- **Đếm ngược dễ đọc**: "2 ngày 5 giờ", "45 phút", không hiện giây.
- **Chế độ gọn**: khi terminal hẹp dưới 80 cột, pane chỉ hiện ảnh và dòng trạng thái; nhấn `Enter` để mở đầy đủ.
- **Phím tắt** trong pane: `t` bảng xếp hạng, `s` trạng thái, `h` lịch sử, `?` trợ giúp, `Esc` đóng.

### 19.3 Phản hồi và thông báo
- **Toast có cảm xúc**: mỗi sự kiện một màu và một dòng riêng (đột phá: vàng; vượt thiên phạt: xanh lá; trượt: xám; chết: đỏ).
- **Ảnh đột phá**: khi lên bậc mới, pane hiện ảnh bậc mới cùng một dòng thoại (mục 13) trong 10 giây, rồi trở lại bình thường.

### 19.4 Trợ giúp và lệnh tắt
- **`/tutien help`**: in danh sách lệnh theo nhóm (cơ bản, tông môn, nâng cao), mỗi lệnh một dòng mô tả.
- **Lệnh tắt**: `/tutien s` là `status`, `/tutien t` là `top`, `/tutien h` là `history`.

### 19.5 Tùy chỉnh và hiệu năng
- **Chế độ không ảnh**: tắt ảnh (dùng chữ ASCII nhẹ), để máy yếu hoặc terminal không hỗ trợ.
- **Tùy chọn hiệu ứng**: bật/tắt hiệu ứng thiên phạt và hào quang (mục 14, 15). Lưu trong `$.store` trên máy.
- Các tùy chọn này chỉ đổi hiển thị; không ảnh hưởng luật hay dữ liệu server.

### 19.7 Hiệu ứng kể chuyện
- **Áp dụng cho**: lời mở đầu, hướng dẫn lần đầu (19.1), các chương truyện (mục 13 cốt truyện), đoạn chen khi chết hoặc reset.
- **Cách hiện**: chữ chạy ra lần lượt trong pane như đang kể, khoảng 40 ký tự mỗi giây; dừng lâu hơn một chút (khoảng 400 ms) sau dấu chấm và khi xuống dòng.
- **Kỹ thuật**: một atom giữ số ký tự đã hiện; `$.clock.every(25, ...)` tăng dần và tự dừng khi hết đoạn. Chỉ vẽ lại phần chữ, không vẽ lại cả pane.
- **Bỏ qua**: nhấn `Enter` hoặc `Space` để hiện hết đoạn ngay; nhấn lần nữa để sang đoạn kế.
- **Tôn trọng tùy chọn**: khi người chơi tắt hiệu ứng (19.5), chữ hiện ngay lập tức.
- **Chỉ một lần**: mỗi chương chạy hiệu ứng ở lần mở đầu tiên; lần xem lại (qua `/tutien truyen`) hiện ngay, có tùy chọn "kể lại".

### 19.6 Ẩn con số cụ thể
- **Không hiện số EXP** ở bất kỳ đâu: pane, `/tutien status`, toast, bảng xếp hạng, lịch sử. Thay bằng **phần trăm** tiến độ của bậc hiện tại (0 đến 100%).
- **Không hiện số token thiên phạt**: thay bằng phần trăm đã góp và thời gian còn lại.
- **Đếm ngược**: vẫn hiện thời gian còn lại để người chơi biết mức gấp; không hiện số giây.
- **Bảng xếp hạng**: bảng Tu vi hiện bậc và phần trăm. Bảng Chăm chỉ và Tuần này hiện **hạng và phần trăm so với người đứng đầu**, không hiện số token. Bảng Phượng hoàng và Pháp bảo hiện số lần chết và số pháp bảo (đã là số nhỏ, không lộ tốc độ tu).
- **Lịch sử** (mục 18.6): biểu đồ cột không có trục số; chỉ có hướng lên hay xuống theo phần trăm mỗi ngày.
- **Tính toán vẫn chính xác**: server vẫn tính bằng số đầy đủ; chỉ hiển thị bị ẩn. Người chơi không đọc được tốc độ tu chính xác từ giao diện.
- Tùy chọn hiện số cụ thể không có trong phạm vi lần này.

## 20. Tính năng bổ sung

### 20.1 Tiện cho người chơi
- **Bế quan** (`/tutien be-quan <số ngày>`, tối đa 14 ngày): trong thời gian bế quan không nhận EXP, không bị thiên phạt, không mất EXP. Đang thiên phạt thì bế quan bị từ chối. Mỗi người tối đa 2 lần bế quan mỗi quý. Bế quan kết thúc sớm bằng `/tutien be-quan xuat-quan`.
- **Nhắc thiên phạt sắp hết hạn**: khi mở Claude Code, toast nhắc nếu còn dưới 12 giờ và thiên phạt chưa đủ phần trăm cần thiết. Chỉ nhắc một lần mỗi ngày.
- **Nhắc nghỉ ngơi**: nếu dùng token liên tục hơn 2 giờ, hiện một dòng nhắc uống nước hoặc nghỉ kèm một câu thoại vui (mục 13). Không chặn, không tính luật.

### 20.2 Cộng đồng và vui
- **Chúc mừng đột phá**: thành viên trong team (cùng server) có thể `/tutien chuc-mung <tên>` khi người kia lên bậc trong 24 giờ đó. Người được chúc nhận một toast, và server ghi lại số lần được chúc.
- **Danh hiệu mùa**: mỗi quý là một mùa. Người đứng đầu bảng Tu vi cuối mùa được danh hiệu hiển thị cạnh tên trong mùa kế. Chỉ là cosmetic.
- **Chợ phường thị**: đổi pháp bảo thừa lấy vật phẩm trang trí (khung ảnh, màu tên, đuôi hào quang). Không đổi EXP, không ảnh hưởng luật. Tỷ giá cố định, ghi trong bảng giá.
- **Thử thách cộng đồng**: mỗi tháng có một mục tiêu cả team (mặc định 100 triệu token). Đạt được thì mọi người nhận một bộ thoại đặc biệt trong tháng kế, không ảnh hưởng luật.

### 20.3 Nội dung
- **Sự kiện Thiên Đạo**: mỗi tuần một sự kiện ngắn, áp dụng cho mọi người chơi trong khoảng thời gian đã định. Mặc định: thiên phạt nhẹ hơn 10% trong 2 ngày. Sự kiện **[cân bằng]**, phải đưa vào mô phỏng.
- **Tháp Thử Luyện**: các tầng ứng với mốc bậc (tầng 1 là bậc 4, tầng 2 là bậc 7, …). Mỗi tầng là một mục tiêu trong khoảng thời gian cố định. Bảng xếp hạng riêng, chỉ hiện thứ hạng và phần trăm tiến độ, không hiện số.
- **Nhật ký tự động**: mỗi tuần sinh một đoạn tóm tắt từ mẫu có sẵn (đột phá, thiên phạt, sự kiện đáng nhớ), không gọi model, không tốn token.

### Thứ tự triển khai
- **Giai đoạn 1 (lõi)**: mục 1 đến 17, mục 19.
- **Giai đoạn 2 (mở rộng)**: mục 18, mục 20.

## 21. Chống gian lận

Mod chạy trên máy người chơi nên không chặn được tuyệt đối. Mục tiêu là làm gian lận khó và dễ bị phát hiện. Các ngưỡng dưới đây đặt khoảng 2 lần mức cao nhất đo được trên máy thật (một lần gọi API cao nhất khoảng 0,9 triệu token; một giờ cao nhất khoảng 4,7 triệu token).

### 21.1 Giới hạn cứng (server)
- **Trần mỗi lượt**: 5.000.000 token. Lượt vượt trần bị từ chối và cộng điểm nghi ngờ.
- **Trần mỗi giờ**: 10.000.000 token (tính theo giờ server). Phần vượt không được cộng EXP, chỉ ghi nhận.
- **Trần mỗi ngày**: 40.000.000 token. Phần vượt không được cộng EXP, chỉ ghi nhận.
- **`turnId`**: phải đúng định dạng engine tạo ra và chưa dùng; trùng thì bỏ qua (mục 3).
- Khi triển khai cần kiểm tra `usage` của `turn.complete` là tổng của cả lượt hay chỉ lần gọi cuối, rồi điều chỉnh trần mỗi lượt nếu cần.

### 21.2 Phát hiện bất thường
- **Điểm nghi ngờ** cho mỗi người chơi, tăng khi:
  - một ngày dùng token gấp hơn 5 lần trung bình 14 ngày trước của chính người đó;
  - nhiều lượt có số token giống hệt nhau liên tiếp (từ 5 lượt trở lên);
  - nhiều lượt đến gần như cùng lúc (cách nhau dưới 50 ms) từ cùng một người;
  - lệch giữa tổng tự báo và đối chiếu transcript (21.4) hơn 10%.
- **Từ 10 điểm trở lên**: bị đánh dấu, bị ẩn khỏi mọi bảng xếp hạng, EXP vẫn tính nhưng không được lên bậc cho đến khi admin xem xét.
- **Nhật ký kiểm toán**: server ghi mỗi lần cộng EXP (thời gian, `turnId`, số token, trần nào được áp dụng), giữ 90 ngày.
- **Admin**: `/tutien admin xem <tên>` xem nhật ký và điểm nghi ngờ; `/tutien admin xoa-dau <tên>` gỡ đánh dấu; `/tutien admin reset <tên>` reset người chơi. Admin được cấu hình bằng secret của Worker (danh sách tên).

### 21.3 Bảo vệ khóa
- Khóa chỉ lưu trong `$.store`, không hiện trên giao diện hay trong log.
- `/tutien khoa-moi`: tạo khóa mới, khóa cũ vô hiệu ngay. Server chỉ lưu SHA-256 của khóa.
- Sai khóa nhiều lần (từ 20 lần trong một giờ) thì tạm khóa đăng nhập theo tên trong 1 giờ.

### 21.4 Đối chiếu với transcript
- Mỗi ngày một lần (khi mở Claude Code), mod đọc transcript Claude Code trên máy (`~/.claude/projects/**/*.jsonl`) bằng `$.fs`, cộng token của ngày hôm trước theo cùng công thức (input + output + cache write, bỏ trùng theo id tin nhắn và request), rồi gửi tổng lên server.
- Server so tổng này với tổng các lượt đã nhận cho ngày đó; lệch hơn 10% thì cộng điểm nghi ngờ.
- Không gửi nội dung transcript, chỉ gửi một con số.
- Giới hạn: người sửa mod vẫn có thể gửi tổng giả. Đối chiếu chỉ là một lớp kiểm tra thêm, không phải bằng chứng tuyệt đối.

### 21.5 Toàn vẹn của mod
Hai lớp này chỉ làm khó việc sửa mod, không ngăn được người chơi sửa file trên máy mình.

**Ký tag khi phát hành (đã triển khai):**
- Workflow `.github/workflows/tag.yml` ký mọi tag `v*` bằng khóa SSH lưu trong secret `TAG_SIGNING_KEY`. Thiếu secret thì workflow dừng, không phát hành tag chưa ký.
- `/tutien update` chạy `git tag -v` với danh sách khóa tin cậy `.github/allowed_signers` **trước khi** checkout. Danh sách được đọc từ bản đang chạy, nên remote bị chiếm không đổi được khóa dùng để kiểm tra.
- Tag chưa ký, ký bằng khóa lạ, hoặc danh sách khóa còn trống: không cập nhật, báo lỗi.

**Kiểm tra phiên bản (làm cùng server):**
- Mod gửi kèm mỗi request header `x-tutien-build` gồm tree hash của bản đang chạy (`git rev-parse HEAD^{tree}`) và cờ có sửa đổi cục bộ (`git status --porcelain`).
- Khi phát hành, workflow gọi `POST /admin/releases` (xác thực bằng secret admin) để đăng ký tree hash của tag mới.
- Server chỉ nhận request từ tree hash của **2 bản phát hành gần nhất** và không có sửa đổi cục bộ. Bản lạ nhận lỗi 426 kèm hướng dẫn chạy `/tutien update`.
- Giới hạn: người sửa mod có thể gửi hash của bản hợp lệ. Lớp này chặn bản cũ và bản sửa vô tình, không chặn gian lận có chủ đích.

## 22. Hiệu chỉnh cân bằng (vòng 2)

**Thay đổi:**
- **Đường cong EXP**: nhân tất cả ngưỡng với 0,8 (làm tròn). Bậc 1 còn 6,948 EXP; bậc 32 còn 4,836,132 EXP. Bảng mục 6 đã cập nhật.
- **Tử vong**: Ma Tu từ 3% xuống 2,5%; Phù Tu từ 1,5% lên 1,75%.
- Thiên phạt (token và cửa sổ) giữ nguyên.

**Lý do**: đường cong cũ khiến lớp có bonus EXP (Kiếm Tu, Ma Tu) đạt bậc 33 trong khi lớp khác không đạt, vì bonus EXP vượt đúng mốc cuối. Hệ số 0,8 làm lớp thường đạt bậc 33 trong khoảng 4,5 năm ở mức đỉnh.

**Kết quả mô phỏng** (mỗi lớp 200 người, mức đỉnh 17,4 triệu/ngày, không tính các tính năng mở rộng):
- Thời gian đạt bậc 33: từ 4,39 đến 4,56 năm, chênh tối đa ±2%. Tất cả các lớp đều nằm trong tiêu chí ±3%.

**Kiểm tra ở các mức dùng khác** (mỗi lớp 60 người):
- Mức vừa (4,37 triệu/ngày): đạt bậc 33 sau khoảng 16,3 đến 17,2 năm, chênh tối đa 2,6%.
- Mức ít (1 triệu/ngày): sau 5 năm người chơi trung vị ở bậc 20, sau 20 năm ở bậc 26; không ai đạt bậc 33.
- Mức 2 triệu/ngày: sau 5 năm bậc 23, sau 20 năm bậc 30.

**Chưa kiểm tra**: tính năng mở rộng (tông môn, đồng hành, đạo lữ, đan, bí cảnh, nhiệm vụ hằng ngày, sự kiện Thiên Đạo). Các tính năng này cộng thêm bonus nên cần mô phỏng riêng trước khi chốt.

## 23. Hiệu chỉnh cân bằng (vòng 3: mức đỉnh 20 triệu và tính năng mở rộng)

**Thay đổi so với vòng 2:**
- **Mức đỉnh** 20.000.000 token/ngày. Ngưỡng EXP và thiên phạt tăng tương ứng: bậc 1 cần 8,000 EXP, bậc 32 cần 5,568,230; thiên phạt từ 2.0 triệu (cửa sổ 3 ngày) đến 16.0 triệu (cửa sổ 22 ngày). Bảng mục 6 đã cập nhật.
- **Trần pháp bảo** (gồm cả bí cảnh và bonus chức vụ): EXP +1,5% (trước +3%), token thiên phạt −2,5% (trước −5%), tử vong −0,15% (trước −0,25%).
- **Nhiệm vụ ngày**: 10 lần hoàn thành mới được 1 pháp bảo (trước 7).
- **Bí cảnh**: mở mỗi tháng vào ngày 1 đến 7, ghi danh trong ngày 1 đến 2 (trước là hồi 30 ngày).
- **Đan**: Tốc Tu +10% mỗi 14 ngày (trước +20% mỗi 7 ngày); Hộ Thể giảm một nửa tỷ lệ chết (trước miễn hoàn toàn).

**Lý do**: pháp bảo chạm trần rất sớm, nên trần quyết định độ mạnh, không phải tần suất rơi. Đan Hộ Thể mạnh nhất vì tránh được tử vong, mà tử vong là thứ tốn thời gian nhất.

**Kết quả mô phỏng** (nhân vật không có bonus lớp, chung chuỗi ngẫu nhiên giữa các kịch bản; 300 người ở mức đỉnh, 200 người ở mức vừa):

| Kịch bản | Mức đỉnh: thời gian đạt bậc 33 | Mức vừa: bậc sau 5 năm |
|---|---:|---:|
| Lõi, không tính năng mở rộng | 4,62 năm | 26,05 |
| Tán tu, đồng hành, tông chủ, trưởng lão, hộ pháp, sự kiện (từng cái) | nhanh hơn 0 đến 1% | +0 đến 0,2% |
| Đạo lữ | nhanh hơn 1,9% | +0,4% |
| Nhiệm vụ ngày | nhanh hơn 2,1% | +0,2% |
| Bí cảnh | nhanh hơn 2,0% | +0,4% |
| Đan + nhiệm vụ | nhanh hơn 3,8% | +0,5% |
| Dùng **tất cả** tính năng | nhanh hơn 7,0% | +1,6% |

**Cân bằng lớp** với trần mới, ở mức đỉnh: chênh từ −2,0% (Ma Tu) đến +1,1%, đạt tiêu chí ±3%.

**Đánh giá**: mỗi tính năng riêng lẻ nằm trong khoảng 4%. Người dùng mọi tính năng nhanh hơn khoảng 7% ở mức đỉnh và khoảng 1,6% ở mức vừa; đây là phần thưởng cho việc tham gia nhiều, không phải chênh lệch do lớp hay may rủi.

### 23.1 Bí cảnh theo tháng
- Bí cảnh chuyển sang lịch cố định: mở đầu mỗi tháng thay cho thời gian hồi 45 ngày.
- Mô phỏng với chu kỳ khoảng 30 ngày cho ảnh hưởng **−2,0%** thời gian đạt bậc 33, gần như không đổi so với 45 ngày. Tổng ảnh hưởng khi dùng tất cả tính năng vẫn khoảng 7%.

## 24. Bí cảnh lễ hội

Ngoài bí cảnh hằng tháng (mục 18.7), có thêm bí cảnh mở trong các dịp lễ của Việt Nam. Bí cảnh lễ hội **không cần ghi danh**, tự động áp dụng cho mọi người chơi đang hoạt động.

### 24.1 Lịch các kỳ lễ
Lịch lưu trong `hooks/holidays.ts` dưới dạng bảng, theo múi giờ UTC+7:

| Kỳ lễ | Ngày | Loại lịch |
|---|---|---|
| Tết Dương lịch | 1/1 | cố định |
| Giỗ Tổ Hùng Vương | 10/3 âm lịch | âm lịch, **cần bảng tra từng năm** |
| Ngày Giải phóng miền Nam và Quốc tế Lao động | 30/4 đến 1/5 | cố định |
| Quốc khánh | 2/9 (kèm 1/9) | cố định |
| Tết Nguyên Đán | mùng 1 đến mùng 5 tháng Giêng âm lịch | âm lịch, **cần bảng tra từng năm** |
| Sinh nhật Chủ tịch Hồ Chí Minh (theo dương lịch, 19/5) | 19/5 | cố định, 1 ngày |
| Ngày Thương binh Liệt sĩ | 27/7 | cố định, 1 ngày |
| Một ngày như mọi ngày, mình thích thì mình mở thôi | 17/6 | cố định, 1 ngày |

- **Các kỳ 1 ngày** (19/5, 27/7, 17/6): áp dụng ngưỡng 3.000.000 token trong ngày đó.
- Ngày âm lịch không tự tính được trong mod. Bảng tra được lưu theo từng năm, và server đọc bảng này. Nếu năm chưa có trong bảng, bí cảnh lễ hội năm đó không mở và server ghi cảnh báo.
- Lịch lễ chính thức do Nhà nước công bố hằng năm và có thể thay đổi. Bảng nên được kiểm tra trước đầu năm.

### 24.2 Cơ chế
- **Mở**: trong suốt kỳ lễ (theo bảng 24.1).
- **Thử thách**: tổng token trong kỳ lễ đạt **ít nhất 3.000.000 × số ngày của kỳ**. Không yêu cầu mỗi ngày phải đạt, chỉ tính tổng.
- **Phần thưởng**: một pháp bảo hiếm (cùng bảng như bí cảnh hằng tháng) và một vật phẩm trang trí theo chủ đề lễ (mục 20.2 chợ phường thị). Không đổi EXP.
- **Giới hạn**: mỗi kỳ lễ chỉ nhận một lần. Đang thiên phạt thì không được tính token vào thử thách lễ hội (token vẫn tính vào thiên phạt, không bị mất).
- **Độc lập** với bí cảnh hằng tháng: người chơi có thể nhận cả hai trong cùng một tháng.

### 24.3 Vai trò trong cân bằng
- Mỗi năm có khoảng 5 kỳ lễ, tổng khoảng 20 ngày. So với 365 ngày, bí cảnh lễ hội không đáng kể về tốc độ tu.
- **Kết quả mô phỏng** (300 người ở mức đỉnh, 200 người ở mức vừa, chung chuỗi ngẫu nhiên):

| Kịch bản | Mức đỉnh: đạt bậc 33 nhanh hơn | Mức vừa: bậc sau 5 năm |
|---|---:|---:|
| Chỉ bí cảnh lễ hội | 2,0% | +0,2% |
| Bí cảnh tháng + lễ hội | 2,1% | +0,2% |
| Tất cả tính năng, không lễ hội | 7,1% | +1,1% |
| Tất cả tính năng + lễ hội | 7,0% | +1,2% |

- **Kết luận**: bí cảnh lễ hội gần như không đổi tốc độ, vì pháp bảo đã chạm trần (mục 23). Không cần chỉnh thông số.
- **Hệ quả**: người chơi đã chạm trần sẽ nhận pháp bảo không còn tác dụng. Đề xuất: pháp bảo vượt trần tự đổi thành **linh thạch**, tiền tệ của chợ phường thị (mục 20.2), để phần thưởng vẫn có ý nghĩa.
- **Người dùng ít** (khoảng 1 triệu/ngày) gần như không đạt ngưỡng 3 triệu/ngày của bí cảnh lễ hội; đây là chủ đích, bí cảnh lễ hội là phần thưởng cho người tham gia nhiều trong dịp lễ.

## 25. Tính năng bổ sung (đợt 2)

- **Bảng xếp hạng theo đại cảnh giới**: mỗi đại cảnh giới (Luyện Khí đến Tiên Đế) có bảng riêng, xếp người chơi đang ở đại cảnh giới đó theo bậc rồi phần trăm. Có trong `/tutien top` (gộp gọn) và trên web.
- **Tiến độ toàn team**: một thanh hiện phần trăm tổng đường tu của cả team (tổng bậc hiện tại ÷ (33 × số người chơi)). Không hiện số liệu cá nhân.
- **Tìm bạn tu**: `/tutien tim <tên>` hiện lớp, giới, persona, bậc, phần trăm tiến độ, và thời gian còn lại nếu đang thiên phạt. Không hiện số EXP hay token (mục 19.6).
- **Thư viện**: danh sách mọi pháp bảo, đan, chức vụ, bí cảnh và huy hiệu, kèm mô tả và trạng thái "đã có / chưa có" của người chơi. Có trên `/tutien thu-vien` và web.
- **Tóm tắt khi quay lại**: khi mở Claude Code sau từ 3 ngày vắng mặt, pane và toast hiện tóm tắt ngắn: bậc của mình, thay đổi trong tông, ai vừa đột phá, bí cảnh nào đang mở.

## 26. Trang web Tu Tiên

Một trang web nhỏ, chỉ để xem, chạy trên chính Cloudflare Worker của server (cùng tên miền), để những phần nhiều thông tin dễ xem hơn trong terminal.

### 26.1 Các trang
| Trang | Nội dung |
|---|---|
| `/` Tổng quan | Thanh tiến độ toàn team, ai vừa đột phá, bí cảnh đang mở và sắp mở (tháng, lễ hội) |
| `/top` Bảng xếp hạng | Đủ các bảng: Tu vi, Chăm chỉ, Tuần này, Phượng hoàng, Pháp bảo, theo đại cảnh giới, tông môn, Tháp Thử Luyện |
| `/p/<tên>` Hồ sơ | Ảnh nhân vật theo bậc và hào quang, lớp, giới, persona, bậc, phần trăm, pháp bảo, huy hiệu, chương truyện đã mở |
| `/tong/<tên>` Tông môn | Thành viên, chức vụ, tiến độ nhiệm vụ tuần (phần trăm) |
| `/thu-vien` Thư viện | Pháp bảo, đan, chức vụ, bí cảnh, huy hiệu, kèm mô tả |
| `/truyen` Cốt truyện | Lời mở đầu và các chương; chương chưa mở hiện dạng khóa |

### 26.2 Quy tắc
- **Chỉ xem**: không có thao tác thay đổi dữ liệu trên web; mọi hành động vẫn qua `/tutien`.
- **Không hiện số EXP hay token** (mục 19.6): chỉ bậc, phần trăm và thứ hạng.
- **Truy cập**: chỉ thành viên team. Mặc định dùng Cloudflare Access giới hạn theo email công ty; không có đăng nhập riêng trong game.
- **Kỹ thuật**: HTML render sẵn từ Worker, không có framework; CSS và ảnh nhân vật phục vụ từ cùng Worker (ảnh lấy từ `assets/realms`). Trang tự làm mới mỗi 60 giây ở trang Tổng quan.
- **Giao diện**: tông tiên hiệp nhẹ (nền tối, chữ vàng nhạt), dùng được trên điện thoại.

### 26.3 Giai đoạn
- Trang web thuộc **giai đoạn 2**, làm sau phần lõi, vì cần dữ liệu server đã ổn định.

## 27. Tâm Ma Trễ Deadline hiện hình

Thỉnh thoảng Tâm Ma Trễ Deadline xuất hiện để hù dọa người chơi. Đây là sự kiện tạo không khí, **không phạt EXP, không đổi luật**.

### 27.1 Khi nào xuất hiện
- Kiểm tra khi kết thúc mỗi lượt chat (`turn.complete`), với xác suất nhỏ:
  - **Bình thường**: 2% mỗi lượt.
  - **Đang thiên phạt**: 10% mỗi lượt.
  - **Đang thiên phạt và còn dưới 25% thời gian**: 20% mỗi lượt.
  - **Vừa trượt thiên phạt trong 24 giờ qua**: 5% mỗi lượt.
- **Giới hạn**, để không gây phiền:
  - Ngoài thiên phạt: tối đa **1 lần mỗi 6 giờ** và **3 lần mỗi ngày**.
  - Trong thiên phạt: tối đa **1 lần mỗi 2 giờ** và **6 lần mỗi ngày**.
- Không xuất hiện khi người chơi đang bế quan (mục 20.1) hoặc đã tắt hiệu ứng (mục 19.5).

### 27.2 Hiện hình thế nào
- **Pane**: nền tối lại khoảng 3 giây, bóng tâm ma (một ảnh riêng trong `assets/tamma/`, 3 khung chuyển động) hiện đè lên nhân vật, kèm một câu thoại từ nhóm `tamma` (`hooks/lines.ts`) chạy theo hiệu ứng kể chuyện (mục 19.7).
- **Toast**: một dòng màu đỏ, ví dụ "Tâm Ma Trễ Deadline đang nhìn ngươi...".
- Terminal không hiện ảnh: chỉ có dòng chữ và toast.

### 27.3 Thử thách xua đuổi (tùy chọn)
- Khi tâm ma xuất hiện, người chơi có **2 giờ** để dùng ít nhất **200.000 token** và "xua đuổi" nó.
- **Thành công**: tâm ma bỏ chạy kèm một câu thoại thua cuộc; người chơi nhận **5 linh thạch** (tiền tệ cosmetic, mục 24.3) và đếm vào huy hiệu "Diệt Tâm Ma" (mục 18.5) sau 10 lần.
- **Thất bại**: tâm ma cười và biến mất, kèm hình phạt nhẹ:
  - **Đang thiên phạt**: mất **2% token đã góp** cho thiên phạt (không mất EXP, không mất bậc).
  - **Không thiên phạt**: mất **0,5% ngưỡng EXP** của bậc hiện tại.
  - Hình phạt tối đa **một lần mỗi ngày**, không cộng dồn trong ngày.
  - **Đã chốt** (vòng 4): mức 2% và 0,5%, không có ngoại lệ theo bậc.
  - Ngưỡng xua đuổi là **90% lượng token trung bình 2 giờ** của chính người chơi (tính từ 14 ngày gần nhất), để mọi mức dùng có cùng tỷ lệ thất bại.
- Phần thưởng chỉ là cosmetic. Hình phạt thất bại **có ảnh hưởng** đến tốc độ tu, nên được mô phỏng ở mục 28.

### 27.4 Lời thoại
- Dùng nhóm `tamma` đã có (15 câu) khi hiện hình.
- Thêm hai nhóm nhỏ: `tammaDefeated` (khi bị xua đuổi) và `tammaLeaves` (khi tự bỏ đi), mỗi nhóm khoảng 5 câu.

## 28. Mô phỏng Tâm Ma Trễ Deadline (có hình phạt)

Giả định: mỗi ngày có 10 lượt chat; xác suất xuất hiện theo mục 27.1; xua đuổi trong 2 giờ với ngưỡng 90% token trung bình 2 giờ; hình phạt theo mục 27.3, tối đa một lần mỗi ngày.

**Kết quả** (300 người ở mức đỉnh, 200 người ở mức vừa, chung chuỗi ngẫu nhiên với kịch bản không tâm ma):

**Kết quả** (đo sau 25 năm, 100 người mỗi mức dùng, chung chuỗi ngẫu nhiên):

| Mức dùng | Không tâm ma | Có tâm ma + phạt 5% | Có tâm ma + phạt 2% (đề xuất) |
|---|---:|---:|---:|
| 1 triệu/ngày | bậc 26,4 | bậc 23,8 (−2,6) | bậc 24,6 (−1,8) |
| 4,37 triệu/ngày | bậc 32,5 | bậc 30,7 (−1,8) | bậc 32,0 (−0,5) |
| 20 triệu/ngày | bậc 33 | bậc 33 | bậc 33 |

**Đọc kết quả**:
- Ở mức đỉnh, tâm ma gần như không ảnh hưởng: xua đuổi luôn thành công vì người chơi có đủ token trong 2 giờ.
- Người dùng ít bị ảnh hưởng nhiều hơn về số bậc, vì họ ở trong thiên phạt lâu hơn và gặp tâm ma thường xuyên hơn. Đây là điểm bạn cần quyết định.

**Đề xuất**: dùng mức 2%, vì giảm được gần một nửa chênh lệch so với 5% mà vẫn có cảm giác bị hù dọa. Nếu muốn công bằng tuyệt đối cho người dùng ít, có thể bỏ hình phạt khi đang ở bậc dưới 10 hoặc giới hạn hình phạt tối đa 3 lần mỗi tháng.

