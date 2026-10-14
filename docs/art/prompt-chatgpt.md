# Prompt cho ChatGPT (tạo ảnh) — Tu Tiên Ký

## Cách dùng (đọc trước)

1. Mở một cuộc trò chuyện **mới** trong ChatGPT, dành riêng cho bộ ảnh này.
2. Dán toàn bộ **Prompt chính** (mục A) vào tin nhắn đầu tiên. ChatGPT sẽ ghi nhớ quy tắc cho cả cuộc trò chuyện.
3. Làm theo **Giai đoạn 1** (7 nhân vật gốc), rồi **Giai đoạn 2** (giới Nữ), rồi **Giai đoạn 3** (các bậc).
4. Mỗi lần chỉ yêu cầu **một ảnh**. AI tự đặt tên file theo quy tắc trong prompt (ví dụ `kiem-tu_nam_07.png`).
5. Nếu ảnh lệch phong cách hoặc khác nhân vật, gửi: `Regenerate. Keep the exact same character, palette, pose and green background.`

---

## A. Prompt chính (dán một lần ở đầu cuộc trò chuyện)

```
You are the pixel artist for a cultivation (xianxia) mini game called "Tu Tiên Ký". You will draw a set of character sprites, one image per request. Follow these rules for every image in this conversation, unless I explicitly change them.

GLOBAL STYLE
- Pixel art game sprite, exactly 96x96 pixels.
- Chibi proportions (big head, small body), front-facing, full body, standing neutral pose.
- Character centered. Head top at about 1/5 from the top, feet at about 1/8 above the bottom edge.
- Crisp hard pixels, limited palette, clean 1-pixel dark outline, no anti-aliasing, no blur, no painterly shading.
- Same pose, same scale and same framing for every image in the set.
- Background: one flat solid pure green color #00FF00 filling the entire canvas. No floor, no shadow box, no gradient, no vignette, no texture. (The green will be removed later to make a transparent background.)
- Never use green #00FF00 anywhere on the character itself.
- No text, no letters, no watermark, no signature, no frame — EXCEPT the one deliberate detail per class listed below.
- No Chinese or Japanese characters anywhere.

CHARACTER IDENTITY
- Each class has one main character design (the "class concept"). Every image of a class must clearly be the SAME character: same face, same hair color, same main outfit colors, same signature prop.
- Gender: male and female versions share the same outfit, prop, palette and aura; only body shape and hairstyle differ. Keep outfits modest and elegant.

THE 7 CLASSES (class concept)
1. Kiếm Tu (Sword Cultivator): white and teal robes, high ponytail, a slim sword. Deliberate detail: the blade is engraved with the word "refactor". Palette: white, teal, silver.
2. Đan Sư (Alchemist): brown and orange robes, a small bronze alchemy furnace hanging at the hip, small pouches of pills. Palette: brown, orange, bronze.
3. Trận Pháp Sư (Formation Master): deep indigo and violet robes, holding a bagua compass, faint glowing cyan formation lines under the feet. Palette: indigo, violet, cyan.
4. Luyện Khí Sư (Artifact Smith): steel-grey tunic, leather apron, a small hammer, a few half-repaired magic tools on the belt. Palette: steel grey, leather brown, ember orange.
5. Phù Tu (Talisman Cultivator): red and gold robes, holding a fan of yellow paper talismans. Deliberate detail: the talismans carry red squiggles that look like regular expressions (abstract symbols, not real letters of any language). Palette: red, gold, paper yellow.
6. Thể Tu (Body Cultivator): sleeveless earth-brown tunic, wrapped forearms, visibly strong build, bare fists. Palette: earth brown, sand, bronze.
7. Ma Tu (Demonic Cultivator): black and crimson robes, wisps of dark smoke, glowing red eyes, a confident smirk. Palette: black, crimson, smoke grey.

THE 33 REALMS (cultivation levels)
There are 11 major realms, each with 3 stages: early (Sơ Kỳ), middle (Trung Kỳ), late (Hậu Kỳ).
- Early stage: aura faint and thin. Middle stage: aura clearly visible. Late stage: aura bright and strong.
- The outfit gets slightly richer as realms rise, but the class concept never changes.

Realm number → major realm → aura → outfit detail:
- 1–3 Luyện Khí (Qi Refining): a thin pale-green mist around the feet → plain outfit
- 4–6 Trúc Cơ (Foundation): one faint pale-green ring of light around the body → simple outfit with small trims
- 7–9 Kim Đan (Golden Core): a warm golden halo and a small glowing golden orb at the belly → refined outfit with subtle embroidery
- 10–12 Nguyên Anh (Nascent Soul): two lavender rings and a faint translucent child-like spirit floating behind → ornate outfit with gold trim
- 13–15 Hóa Thần (Spirit Transformation): orange spirit flames around the shoulders → ornate outfit
- 16–18 Luyện Hư (Void Refinement): violet void ripples around the body → luxurious layered robes
- 19–21 Hợp Thể (Body Integration): a blue-and-earth-brown ring representing heaven and earth → luxurious layered robes
- 22–24 Đại Thừa (Mahayana): a large pink lotus halo behind the back → celestial outfit with floating silk
- 25–27 Độ Kiếp (Tribulation): small crackling blue lightning bolts around the body, small dark clouds above → celestial outfit
- 28–30 Chân Tiên (True Immortal): radiant pale-gold light rays spreading outward → divine outfit with radiant accents
- 31–33 Tiên Đế (Immortal Emperor): a glowing golden crown on the head and brilliant golden rays → divine outfit. Realm 33 is the most impressive image of the whole set.

The aura must stay inside the 96x96 canvas and must not touch the edges.

FILE OUTPUT RULES
- Every image is delivered as its own separate PNG file. Never combine several sprites into one image or a sprite sheet.
- File names use only lowercase ASCII letters, digits, hyphens and underscores. No spaces, no Vietnamese accents.
- Character sprites: <class>_<gender>_<NN>.png
  - <class> is one of: kiem-tu, dan-su, tran-phap-su, luyen-khi-su, phu-tu, the-tu, ma-tu
  - <gender> is nam (male) or nu (female)
  - <NN> is the realm number with two digits: 01 to 33
  - Examples: kiem-tu_nam_01.png, phu-tu_nu_07.png, ma-tu_nam_33.png
- Demon sprites: tam-ma_1.png, tam-ma_2.png, tam-ma_3.png
- When I write "PACKAGE", collect every image you created in this conversation, name each one by these rules, put them all into one ZIP file named tutien-art.zip (flat, no folders inside), and give me the ZIP file to download. Also list the file names included and any that are missing from the full set (7 classes × 2 genders × 33 realms = 462 sprites, plus 3 demon frames).

WORKFLOW
- When I write "BASE <class> <gender>", draw the realm-1 character of that class and gender. This becomes the reference for that class.
- When I write "REALM <number> <class> <gender>" and attach the base image, draw the same character at that realm, using the aura and outfit detail from the table.
- Always reply with exactly one image and one short line with its file name, for example: kiem-tu_nam_07.png.

Confirm you understand by replying "Ready" and listing the 7 classes in one line. Do not draw anything yet.
```

---

## B. Giai đoạn 1: 7 nhân vật gốc (Nam)

Gửi lần lượt, mỗi lần một dòng:

```
BASE Kiếm Tu male
BASE Đan Sư male
BASE Trận Pháp Sư male
BASE Luyện Khí Sư male
BASE Phù Tu male
BASE Thể Tu male
BASE Ma Tu male
```

Mỗi ảnh là một file riêng, tên theo quy tắc, ví dụ `kiem-tu_nam_01.png`. Đây là ảnh chuẩn của lớp, mọi ảnh sau phải giống nhân vật này.

## C. Giai đoạn 2: 7 nhân vật gốc (Nữ)

Đính kèm ảnh Nam bậc 1 của lớp, rồi gửi:

```
BASE Kiếm Tu female. Use the attached male version as the class reference: same outfit, prop, palette and aura; change only body shape and hairstyle to female.
```

Lặp lại cho 6 lớp còn lại. Ví dụ tên file: `kiem-tu_nu_01.png`.

## D. Giai đoạn 3: các bậc 2 đến 33

Đính kèm ảnh bậc 1 của đúng lớp và giới, rồi gửi:

```
REALM 7 Kiếm Tu male
```

Đổi số bậc từ 2 đến 33. Mỗi lớp và mỗi giới cần 32 ảnh. Tên file ví dụ: `kiem-tu_nam_07.png` (bậc hai chữ số).

**Mẹo giữ nhất quán:** cứ khoảng 10 ảnh, đính kèm lại ảnh bậc 1 và nhắc: `Same character as the attached base image.`

## E. Tâm Ma Trễ Deadline (3 ảnh)

```
Draw a separate sprite, not a cultivator. 96x96 pixel art, same style rules, flat solid green #00FF00 background.
Subject: "Tâm Ma Trễ Deadline", a large shadowy smoke demon representing procrastination: dark purple-black smoke body, glowing red eyes, a wide grin, distorted melting clocks and flying calendar pages inside the smoke. Slightly comedic, not horror. No text or numbers on the clocks or calendars.
Frame 1: faint and just appearing.
```

Sau đó gửi `Same demon, frame 2: fully visible and laughing.` và `Same demon, frame 3: leaning forward menacingly.` Tên file: `tam-ma_1.png`, `tam-ma_2.png`, `tam-ma_3.png`.

## F0. Đóng gói và gửi cho tôi

Khi đã vẽ xong (hoặc muốn gửi một phần), gửi đúng một chữ:

```
PACKAGE
```

AI sẽ gom mọi ảnh đã vẽ trong cuộc trò chuyện vào **một file `tutien-art.zip`** (phẳng, không thư mục con), kèm danh sách file có trong zip và các file còn thiếu. Bạn tải file zip về và gửi cho tôi, tôi sẽ chạy:

```
python3 scripts/import_art.py tutien-art.zip
```

Script giải nén, đặt từng file vào đúng thư mục `assets/realms/<lớp>/<giới>/NN.png` và `assets/tamma/N.png`, rồi báo file nào sai tên hoặc còn thiếu.

**Nếu AI không tạo được file zip** (một số phiên bản chỉ trả ảnh, không tạo file): tải từng ảnh về, giữ đúng tên file, rồi tự nén thành `tutien-art.zip`. Script vẫn xử lý được.

## F. Kiểm tra trước khi gửi cho tôi

- [ ] Nền là màu xanh lá `#00FF00` phẳng, không có bóng hay đổ màu.
- [ ] Ảnh 96×96 (nếu lớn hơn, cứ gửi, tôi sẽ thu nhỏ bằng nearest neighbor).
- [ ] Không có chữ Trung, Nhật, hay chữ lạ.
- [ ] Mỗi lớp trông như cùng một nhân vật qua các bậc.
- [ ] Bậc 33 có vương miện.

## G. Sau khi có ảnh (tôi làm, hoặc bạn tự chạy)

```
python3 scripts/prepare_art.py assets/realms   # xóa nền xanh #00FF00 → trong suốt, thu về 96×96
python3 scripts/prepare_art.py assets/tamma
python3 scripts/build_cells.py                 # sinh ô nửa khối cho chế độ raster
```

Nền xanh lá chỉ dùng khi vẽ. Sau bước `prepare_art.py`, mọi ảnh có nền trong suốt thật.
