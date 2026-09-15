---
description: Bảng token màu/spacing/radius/z-index và các lệnh cấm khi viết style
globs: ["src/**/*.tsx", "src/**/*.css", "src/lib/tokens.ts"]
---

# Design Tokens

Nguồn gốc: `src/_design/FRONTEND-AI-RULES.md` §3. File này là bảng tra nhanh — khi cần
chi tiết (typography scale, elevation) mở §3.4–3.6 của file gốc.

Token định nghĩa **một lần** trong `globals.css` (`@theme`) + `lib/tokens.ts`.
Tailwind class sinh ra từ đó. Không khai báo màu ở nơi khác.

## Cấm tuyệt đối

- **Không dùng gradient** (`bg-gradient-*`, `linear-gradient`, `radial-gradient`) ở bất kỳ
  đâu — cả Mode A lẫn Mode B. Nền dùng màu phẳng từ token; muốn tạo chiều sâu thì dùng
  glow/blur (blob mờ), pattern (grid/dot), hoặc border/shadow thay vì gradient.

- **Không hex trần** trong `src/app`, `src/components`, `src/features`. CI grep chặn:
  `! grep -rnE "#[0-9a-fA-F]{6}" src/app src/components src/features`
  Hex chỉ được xuất hiện trong `globals.css` và `lib/tokens.ts`.
- **Không màu hồng/magenta** ở bất kỳ đâu.
- **Không `!important`**.
- Không trộn token hai mode — xem [mode-a-backoffice.md](mode-a-backoffice.md) và
  [mode-b-storefront.md](mode-b-storefront.md).

## Nền & bề mặt

| Token            | Light     | Dark      | Vai trò                       |
| ---------------- | --------- | --------- | ----------------------------- |
| `bg.base`        | `#F3F4F6` | `#0E0F11` | nền trang, app shell          |
| `bg.surface`     | `#FFFFFF` | `#17181B` | card, panel, table body       |
| `bg.subtle`      | `#F7F8FA` | `#1F2124` | sidebar, header bảng, toolbar |
| `bg.muted`       | `#EEF0F3` | `#2A2C30` | hover, selected nhẹ, disabled |
| `border.default` | `#DADDE1` | `#2E3034` | viền card, ô nhập             |
| `border.strong`  | `#C5CAD1` | `#3D4045` | viền focus, divider           |

## Chữ (ink)

| Token           | Light     | Dark      | Vai trò             |
| --------------- | --------- | --------- | ------------------- |
| `ink.primary`   | `#1A1B18` | `#F4F4F1` | chữ chính, heading  |
| `ink.secondary` | `#5C5E58` | `#A8AAA3` | mô tả, phụ đề       |
| `ink.tertiary`  | `#8A8C85` | `#76786F` | placeholder, meta   |
| `ink.inverse`   | `#FFFFFF` | `#1A1B18` | chữ trên nền accent |

## Semantic — dùng chung cả hai mode, KHÔNG đổi

| Token             | Giá trị   | Ý nghĩa                        |
| ----------------- | --------- | ------------------------------ |
| `status.positive` | `#1F9D55` | thành công, hoàn tất, còn hàng |
| `status.info`     | `#2B7FC4` | đang tiến hành, thông tin      |
| `status.warning`  | `#D98207` | cảnh báo, chờ, sắp hết         |
| `status.danger`   | `#D23B3B` | lỗi, huỷ, hết hàng, thất bại   |
| `status.neutral`  | `#6B6E68` | nháp, trung tính               |
| `status.muted`    | `#9A9C95` | đã đóng, terminal, ẩn          |
| `status.special`  | `#7C5CBF` | hoàn tiền, sản xuất/in         |

Badge render mỗi semantic thành 3 sắc thái: `bg` (nền nhạt ~12% alpha),
`fg` (chữ/icon = màu gốc), `border` (~24% alpha).

**Thứ tự ưu tiên khi một trạng thái hợp nhiều tone:**

```
special > danger > positive > warning > info > muted > neutral
```

Trạng thái luôn render qua `<StatusBadge domain status>`, không bao giờ tự tô màu.
Thêm trạng thái mới → chỉ sửa `src/lib/status-map.ts`, xem
[skill status-badge](../skills/status-badge/SKILL.md).

## Spacing (scale 4px)

`2xs`=2 · `xs`=4 · `sm`=8 · `md`=12 · `lg`=16 · `xl`=24 · `2xl`=32 · `3xl`=48

Gọi qua biến density của mode, **không** gọi thẳng `p-4` trong component.

## Radius

`sm`=4 (mode A: nút, ô nhập, badge, card) · `md`=8 (mặc định shared) ·
`lg`=12 (mode B: card sản phẩm, panel) · `xl`=16 (mode B: modal, sheet) · `full`=9999 (pill, avatar)

## Z-index — cố định, không tự bịa

`dropdown:50 · floating(cart/chat):800 · sticky:100 · overlay:900 · modal:1000 · drawer/sheet:1100 · toast:1200 · tooltip:1300`

## Typography — quy tắc hay quên

- Số liệu tài chính / tồn kho / SL / mã: luôn `font-variant-numeric: tabular-nums`,
  dùng font mono khi là mã định danh (SKU, PO number, AWB).
- Giá tiền storefront: `text.h2`/`text.display`, weight 700, tabular-nums.
- KHÔNG all-caps cho label thường (chỉ `overline` cho eyebrow thật cần).
- Độ dài dòng body ≤ 75 ký tự (`max-w-[68ch]`).

**Font:** Inter (UI + body) · Inter Tight (heading storefront, số KPI) ·
JetBrains Mono (SKU, PO number, AWB, số cần canh cột). Một họ font, hai biến thể —
không dùng 2 họ khác biệt.

## Dark mode (§7)

Cả **hai** theme đều phải hỗ trợ light + dark. Bảng token ở trên đã có cột Dark.

- `<ThemeProvider>` bọc ở root layout, class `dark` trên `<html>`.
- Chuyển light/dark bằng **CSS variable**, KHÔNG re-render component.
- Mặc định theo `prefers-color-scheme`, có nút toggle ở topbar (A) / header (B).
- Dark back-office: nền `#0E0F11`, chữ `#F4F4F1` (**không phải trắng tuyệt đối** —
  giảm contrast gắt), semantic tone giữ nguyên nhưng hạ saturation nhẹ.
- Dark storefront: nền `#17130F` (đen ấm), chữ `#F3EBE1` (kem), caramel sáng hơn `#C98D4E`.

## Motion

Có chủ đích, không trang trí:

- Mode A: **120–180ms**, tối giản (fade/slide nhỏ cho dropdown, row xuất hiện).
- Mode B: **200–320ms**, reveal sản phẩm, transition giữa bước checkout, hover card nâng nhẹ.
- **Tránh** fade-and-slide-up đồng loạt mọi section — trông AI-generated.
- Luôn `useReducedMotion()`.

## Accessibility (§9)

- Contrast ≥ **4.5:1** (chữ) / **3:1** (UI).
- Target chạm ≥ **44px** (storefront).
- Icon-button phải có nhãn `aria`.
- Bảng có `<caption>` / `scope`; form có label gắn đúng input.
- Mọi component interactive có focus-visible rõ (ring `border.strong` / `accent.blue`).

## TypeScript & Tailwind (§9)

- `strict`, **không `any`**. Props có interface. Status/domain dùng union type từ `status-map.ts`.
- Tailwind: dùng utility sinh từ `@theme` token. Không hex/px trần.
- `!important` chỉ khi buộc phải override shadcn — kèm comment giải thích.
- shadcn: copy vào `components/ui/`, không sửa tay. Tuỳ biến → bọc ở `components/shared/`
  hoặc override bằng `className` + token.
