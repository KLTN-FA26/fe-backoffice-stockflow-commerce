---
description: Audit vi phạm design system — trộn theme, hex trần, bỏ StatusBadge, sai density
argument-hint: [đường dẫn hoặc feature, bỏ trống = quét toàn bộ src]
allowed-tools: Grep, Glob, Read, Bash(git diff:*), Bash(git status:*)
---

Audit `${1:-src}` xem có vi phạm design system không. **Read-only — chỉ báo cáo, không tự sửa.**

Đối chiếu `.claude/rules/design-tokens.md`, `mode-a-backoffice.md`, `mode-b-storefront.md`.

## Cần tìm

**1. Hex trần** (chỉ `globals.css` và `lib/tokens.ts` được phép chứa hex):
grep `#[0-9a-fA-F]{6}` trong `src/app`, `src/components`, `src/features`.

**2. Trộn theme — lỗi nặng nhất**

- Caramel lọt vào Mode A: tìm `A9682F`, `C98D4E`, `8C5526`, `bg.warm`, `card.warm`,
  `ink.warm`, `line.warm`, `caramel` trong `src/app/admin`, `src/components/backoffice`,
  và các feature 01–11.
- Blue/ink lọt vào Mode B làm CTA: tìm `1E88E5`, `4EA6F0`, `accent.blue`, `brand.ink`
  trong `src/components/storefront` và feature 12–18.

**3. Màu hồng/magenta** ở bất kỳ đâu — cấm tuyệt đối. Tìm `pink`, `magenta`, `fuchsia`, `#FF00FF`.

**4. Không dùng StatusBadge**: JSX render trạng thái mà tự tô màu/tự viết badge thay vì
`<StatusBadge domain status>`. Tìm className có `bg-green`, `bg-red`, `bg-yellow`, `text-green`…
cạnh biến tên `status`.

**5. Sai density theo mode**

- Mode A phải: radius `sm`, card padding 16px, ưu tiên border hơn shadow.
- Mode B phải: radius `lg`/`xl`, card padding 24px, được dùng shadow.
- Cờ đỏ: `rounded-xl` trong back-office, `rounded-sm` cho card sản phẩm storefront,
  `p-6` trong bảng mode A, `p-4` cho card mode B.

**6. `!important`** — cấm.

**7. Z-index tự bịa**: số không thuộc `50/100/800/900/1000/1100/1200/1300`.

**8. Số liệu thiếu tabular-nums**: cột tiền/số lượng/mã trong bảng mà không có
`tabular-nums`, mã định danh (SKU/PO/AWB) không dùng font mono.

## Báo cáo

Liệt kê mỗi vi phạm dạng `file.tsx:42 — mô tả — token đúng phải dùng`.
Xếp theo mức nặng: trộn theme > hex trần > thiếu StatusBadge > density > còn lại.
Nếu sạch thì nói rõ đã quét những gì và không thấy vi phạm.
