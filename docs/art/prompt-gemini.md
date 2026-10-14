# Prompt cho Gemini (tạo và sửa ảnh) — Tu Tiên Ký

## Cách dùng (đọc trước)

1. Mở một cuộc trò chuyện **mới** trong Gemini, dành riêng cho bộ ảnh này.
2. Dán toàn bộ **Prompt chính** (mục A) vào tin nhắn đầu tiên.
3. Gemini mạnh ở **sửa ảnh có sẵn**. Vì vậy quy trình là: vẽ một ảnh gốc cho mỗi lớp, rồi tạo các bậc bằng cách **sửa ảnh gốc** (thêm hào quang, thêm trang trí). Cách này giữ nhân vật nhất quán hơn vẽ lại từ đầu.
4. Mỗi lần chỉ yêu cầu **một ảnh**. Tải về, đặt tên đúng như cột `file` trong `docs/art/realm-prompts.csv`.
5. Luôn sửa từ **ảnh bậc 1** của lớp đó, không sửa nối tiếp từ ảnh bậc trước, để lỗi không cộng dồn.

---

## A. Prompt chính (dán một lần ở đầu cuộc trò chuyện)

```
You are the pixel artist for a cultivation (xianxia) mini game called "Tu Tiên Ký". In this conversation you will create and then edit character sprites, one image per message. Apply these rules to every image unless I say otherwise.

STYLE RULES
- Pixel art game sprite, square, target 96x96 pixels (if you must output larger, keep a strict pixel grid so it can be downscaled with nearest-neighbor without blur).
- Chibi proportions, front-facing, full body, standing neutral pose, centered. Head top around 1/5 from the top, feet around 1/8 above the bottom.
- Hard crisp pixels, limited palette, 1-pixel dark outline, no anti-aliasing, no soft painterly lighting, no blur.
- Identical pose, scale and framing across the whole set.
- Background: pure flat green #00FF00 over the entire canvas. No floor, no cast shadow, no lighting or vignette on the background, no gradient. Never use #00FF00 on the character.
- No text, letters, numbers, watermark, logo or border, except the one deliberate class detail described below. No Chinese or Japanese characters at all.

IDENTITY RULES
- Each class has one fixed character design. Every image of a class must be recognizably the same person: same face, hair color, main outfit colors and signature prop.
- Female and male versions of a class share outfit, prop, palette and aura; only body shape and hairstyle change. Outfits stay modest and elegant.

CLASSES (fixed designs)
1. Kiếm Tu — sword cultivator: white and teal robes, high ponytail, slim sword whose blade is engraved with the word "refactor" (the only allowed text). Palette white, teal, silver.
2. Đan Sư — alchemist: brown and orange robes, small bronze alchemy furnace at the hip, pouches of pills. Palette brown, orange, bronze.
3. Trận Pháp Sư — formation master: deep indigo and violet robes, bagua compass in hand, faint cyan formation lines under the feet. Palette indigo, violet, cyan.
4. Luyện Khí Sư — artifact smith: steel-grey tunic, leather apron, small hammer, half-repaired magic tools on the belt. Palette steel grey, leather brown, ember orange.
5. Phù Tu — talisman cultivator: red and gold robes, fan of yellow paper talismans covered in red abstract squiggles that resemble regular expressions (symbols, not real letters). Palette red, gold, paper yellow.
6. Thể Tu — body cultivator: sleeveless earth-brown tunic, wrapped forearms, strong build, bare fists. Palette earth brown, sand, bronze.
7. Ma Tu — demonic cultivator: black and crimson robes, dark smoke wisps, glowing red eyes, confident smirk. Palette black, crimson, smoke grey.

REALMS (33 levels = 11 major realms × 3 stages)
Stages: early = faint thin aura; middle = clearly visible aura; late = bright strong aura.
1–3 Luyện Khí: thin pale-green mist at the feet; plain outfit.
4–6 Trúc Cơ: one faint pale-green ring of light; simple outfit with small trims.
7–9 Kim Đan: warm golden halo plus a small glowing golden orb at the belly; refined outfit with subtle embroidery.
10–12 Nguyên Anh: two lavender rings plus a faint translucent child-like spirit floating behind; ornate outfit with gold trim.
13–15 Hóa Thần: orange spirit flames around the shoulders; ornate outfit.
16–18 Luyện Hư: violet void ripples around the body; luxurious layered robes.
19–21 Hợp Thể: blue-and-earth-brown ring representing heaven and earth; luxurious layered robes.
22–24 Đại Thừa: large pink lotus halo behind the back; celestial outfit with floating silk.
25–27 Độ Kiếp: small crackling blue lightning bolts around the body and small dark clouds above; celestial outfit.
28–30 Chân Tiên: radiant pale-gold light rays spreading outward; divine outfit with radiant accents.
31–33 Tiên Đế: glowing golden crown on the head and brilliant golden rays; divine outfit. Realm 33 is the most impressive image in the set.
The aura stays inside the canvas and never touches the edges.

COMMANDS I WILL USE
- "BASE <class> <gender>": create the realm-1 sprite for that class and gender from scratch.
- "EDIT TO REALM <number>" with a base image attached: edit the attached image only by adding that realm's aura, stage brightness and outfit detail. Do not change the face, hair, pose, palette, prop, framing or background.
After each image, write one short line: class, gender, realm.

Reply "Ready" and list the 7 classes in one line. Do not create an image yet.
```

---

## B. Giai đoạn 1: 7 nhân vật gốc (Nam)

Gửi lần lượt:

```
BASE Kiếm Tu male
BASE Đan Sư male
BASE Trận Pháp Sư male
BASE Luyện Khí Sư male
BASE Phù Tu male
BASE Thể Tu male
BASE Ma Tu male
```

Lưu thành `assets/realms/<lớp>/Nam/01.png`.

## C. Giai đoạn 2: 7 nhân vật gốc (Nữ)

Đính kèm ảnh Nam bậc 1 của lớp, rồi gửi:

```
Edit the attached sprite into the female version of the same class: change only body shape and hairstyle to female. Keep outfit, prop, palette, aura, pose, framing and the #00FF00 background exactly the same.
```

Lưu thành `assets/realms/<lớp>/Nữ/01.png`.

## D. Giai đoạn 3: các bậc 2 đến 33 (sửa từ ảnh bậc 1)

Đính kèm **ảnh bậc 1** của đúng lớp và giới, rồi gửi:

```
EDIT TO REALM 7
```

Đổi số bậc từ 2 đến 33. Luôn đính kèm ảnh **bậc 1**, không dùng ảnh bậc trước. Lưu thành `assets/realms/<lớp>/<giới>/NN.png` (ví dụ `07.png`).

**Khi Gemini sửa quá tay** (đổi mặt, đổi màu áo): gửi `Undo that. Only add the aura and small outfit trims; keep everything else identical to the attached image.`

## E. Tâm Ma Trễ Deadline (3 ảnh)

```
Create a separate sprite, not a cultivator, following the same style rules and the flat #00FF00 background.
Subject: "Tâm Ma Trễ Deadline", a large shadowy smoke demon that represents procrastination: dark purple-black smoke body, glowing red eyes, wide grin, distorted melting clocks and flying calendar pages inside the smoke. Slightly comedic, not horror. No digits or text on the clocks and calendars.
This is frame 1: faint, just appearing.
```

Sau đó đính kèm ảnh vừa tạo và gửi `Edit to frame 2: fully visible and laughing.`, rồi `Edit to frame 3: leaning forward menacingly.` Lưu thành `assets/tamma/1.png`, `2.png`, `3.png`.

## F. Kiểm tra trước khi gửi cho tôi

- [ ] Nền xanh lá `#00FF00` phẳng, không bóng, không đổ màu.
- [ ] Ảnh vuông; nếu lớn hơn 96×96 thì vẫn giữ lưới pixel rõ (tôi sẽ thu nhỏ).
- [ ] Không có chữ Trung, Nhật hay chữ lạ.
- [ ] Mỗi lớp nhận ra là cùng một nhân vật qua các bậc.
- [ ] Bậc 33 có vương miện.

## G. Sau khi có ảnh (tôi làm, hoặc bạn tự chạy)

```
python3 scripts/prepare_art.py assets/realms   # xóa nền xanh #00FF00 → trong suốt, thu về 96×96
python3 scripts/prepare_art.py assets/tamma
python3 scripts/build_cells.py                 # sinh ô nửa khối cho chế độ raster
```

Nền xanh lá chỉ dùng khi vẽ. Sau bước `prepare_art.py`, mọi ảnh có nền trong suốt thật.
