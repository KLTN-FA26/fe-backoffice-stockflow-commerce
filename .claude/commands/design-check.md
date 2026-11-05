---
description: Audit vi phạm design system — trộn theme, hex trần, bỏ StatusBadge, sai density
argument-hint: [đường dẫn hoặc feature, bỏ trống = quét toàn bộ src]
allowed-tools: Grep, Glob, Read, Bash(git diff:*), Bash(git status:*)
---

Audit `${1:-src}` xem có vi phạm design system không. **Read-only — chỉ báo cáo, không tự sửa.**

Đối chiếu `.claude/rules/design-tokens.md` (gồm _Quyết định thiết kế 2026-10_), `mode-a-backoffice.md`,
`data-table-mode-a.md`, `mode-b-storefront.md`.

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

- Mode A phải (style Vercel): khối/card/nút hành động bo 8px qua `--section-radius` /
  `--card-radius` / `--action-radius`, viền + bóng `--card-shadow`; ô nhập, badge 4px; card padding 16px.
  Bo 8px + bóng nhẹ ở Mode A là **đúng**, không báo.
- Mode B phải: radius `lg`/`xl`, card padding 24px, được dùng shadow.
- Cờ đỏ: `rounded-xl` trong back-office, `shadow-md`/`shadow-lg` cho khối Mode A (chỉ `--card-shadow`),
  `rounded-sm` cho card sản phẩm storefront, `p-6` trong bảng mode A, `p-4` cho card mode B.

**6. `!important`** — cấm.

**7. Z-index tự bịa**: số không thuộc `50/100/800/900/1000/1100/1200/1300`.

**8. Số liệu thiếu tabular-nums**: cột tiền/số lượng/mã trong bảng mà không có
`tabular-nums`, mã định danh (SKU/PO/AWB) không dùng font mono.

**9. Chưa chuyển style Vercel** — mức **nhẹ nhất**, ghi "nợ migrate" (không phải lỗi; chuyển bằng
`/restyle <module>`). Chỉ xét `src/app/admin/**` và `src/features/**/components/**`:

- Component gốc của trang (được `page.tsx` render) **không** có `surface-soft`:
  `grep -rL "surface-soft"` trên các file component trang.
- `<PageHeader` còn render title hiển thị: `grep -rn "<PageHeader" src/features src/app/admin`.
- Khối/card bo 4px: `grep -rnE "<section[^>]*rounded-\[var\(--r-sm\)\]"` và class card có
  `rounded-[var(--r-sm)] border`.
- Combobox kiểu cũ: file có cả `PopoverContent` và `CommandInput` (ô tìm nằm trong popover)
  **và không có `Checkbox`** — popover lọc nhiều lựa chọn có checkbox (`ListToolbar`,
  `TaskListToolbar`) là công cụ lọc, không phải combobox, không báo.

Gộp theo feature: `feature — số trang chưa chuyển — danh sách file`. Feature đã sạch thì ghi
"đã chuyển". Đừng báo trang dùng `surface-soft` chỉ vì component con còn `rounded-[var(--r-sm)]`
cho ô nhập/badge — 4px cho ô nhập là đúng.

## Báo cáo

Liệt kê mỗi vi phạm dạng `file.tsx:42 — mô tả — token đúng phải dùng`.
Xếp theo mức nặng: trộn theme > hex trần > thiếu StatusBadge > density > còn lại > chưa chuyển
style Vercel (mục 9, liệt kê riêng ở cuối dưới tiêu đề "Nợ migrate").
Nếu sạch thì nói rõ đã quét những gì và không thấy vi phạm.
