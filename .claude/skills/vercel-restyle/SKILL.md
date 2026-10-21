---
name: vercel-restyle
description: Use when converting a Mode A page or module to the Vercel style (surface-soft), building a new back-office page, or when /restyle runs — list/detail/form checklists, InputCombobox, and the traps hit while restyling product.
---

# Chuyển trang Mode A sang style Vercel

Style chuẩn của Mode A từ 2026-10 — xem
[Quyết định thiết kế 2026-10](../../rules/design-tokens.md#quyết-định-thiết-kế-2026-10) và
[3 loại trang](../../rules/mode-a-backoffice.md#3-loại-trang). Mẫu đã làm xong: feature `product`.

## Khi nào dùng

- Chạy `/restyle <module>` (một module = một PR).
- Viết trang `/admin` mới — làm đúng style ngay, không viết kiểu cũ rồi chuyển.
- `/design-check` mục 9 báo trang "chưa chuyển style Vercel".

Khung app (sidebar, topbar, breadcrumb, dot màu) đã toàn cục — **không** đụng.

## Giữ nguyên logic

Chỉ đổi className và cấu trúc hiển thị. Không đổi query, mutation, schema, state, action-gating.
Test truy vấn theo tiêu đề / text cũ → sửa test cho khớp UI mới (`h1` sr-only vẫn cho
`getByRole("heading")`), không đổi hành vi được test.

## Trang danh sách

Mẫu: `features/product/components/ProductList.tsx`.

- [ ] Bọc component trang bằng `<div className="surface-soft">`.
- [ ] Bỏ `<PageHeader>` → `<h1 className="sr-only">{tên trang}</h1>`; nhánh loading/error cũng vậy.
- [ ] Nút tạo mới + `Hiện thống kê` → `<ListToolbar actions={<>…</>}>`, mỗi nút
      `cn(…, TOOLBAR_ACTION_CLASS)`; nút phụ `border-border-default bg-bg-surface text-ink-primary`,
      icon `text-dot-info`.
- [ ] `<DataTable stickyHeader …>` cho bảng chính.
- [ ] Toolbar tự viết (không dùng `ListToolbar`): ô/nút dùng `h-(--control-h)` /
      `size-(--control-size)` `rounded-(--control-radius)` `shadow-(--control-shadow)`, không khung bao.
- [ ] Icon công cụ / nút 14px (`size-3.5`), màu tone qua `text-dot-*`.

## Trang chi tiết

Mẫu: `features/product/components/ProductDetail.tsx`, `ProductSection.tsx`, `ProductInfoSections.tsx`.

- [ ] Bọc `<div className="surface-soft surface-compact">`.
- [ ] Bỏ `<PageHeader>` và nút `Quay lại` (breadcrumb đã có link) → `h1` sr-only bằng tên bản ghi.
- [ ] Tên / tên phụ của bản ghi chuyển thành `InfoRow` đầu thẻ "Thông tin chung" (nhãn lấy từ constants).
- [ ] Card: `rounded-[var(--card-radius)] … shadow-(--card-shadow)`; vạch dòng `divide-y divide-(--table-line)`.
- [ ] Icon tiêu đề mục `size-3.5`.
- [ ] Nút thẻ hành động: `h-(--action-h) rounded-(--action-radius)` (thay `py-2 rounded-[var(--r-sm)]`).

## Form / wizard

Mẫu: `features/product/components/ProductWizardView.tsx`, `create/ProductWizardBottomBar.tsx`.

- [ ] Như trang chi tiết (`surface-soft surface-compact`, `h1` sr-only, bỏ nút quay lại).
- [ ] Khối form `<section>`: `rounded-(--section-radius) … shadow-(--card-shadow)`.
- [ ] Thanh dưới cố định: nút `h-(--action-h) rounded-(--action-radius) px-(--action-px)`.
- [ ] Stepper: vạch `border-(--table-line)`, bước đang chọn `rounded-[var(--r-md)]`.
- [ ] Ô nhập giữ nguyên 4px (`FORM_INPUT_CLASS`).

## Combobox

Popover + `Command` có `CommandInput` bên trong (ô tìm trong popover) → `<InputCombobox>`
(`components/shared/InputCombobox.tsx`). Mẫu: `purchase-order/.../SupplierCombobox.tsx` (lọc ở
client), `supplier/.../InventorySkuCombobox.tsx` (BE lọc: `shouldFilter={false}` + `search` /
`onSearchChange`). Item `className={COMBOBOX_ITEM_CLASS}`. Test: `toHaveValue(...)` thay
`toHaveTextContent(...)` trên combobox.

## Verify — một lần khi xong module

1. Build mock rồi xem từng loại trang (không tắt dev server của người dùng):
   `USE_MOCK=true pnpm run build`, chạy `set USE_MOCK=true&& pnpm exec next start -p 3200` qua
   config tạm trong `.claude/launch.json`, đăng nhập tài khoản demo; xong thì xoá config tạm.
2. `pnpm run validate`. Test fail → `git stash -u`, chạy `pnpm run test` trên HEAD sạch, so số
   lượng; chỉ sửa lỗi mình gây ra. Test hay timeout có sẵn: `DescriptiveEditorDialog`,
   `ProductCreate.axes`, `LoadList`, `ShipmentList`, `ReceiptDetail`.

## Bẫy đã gặp

- `prettier --write` trên cả thư mục đổi CRLF của file không liên quan → chỉ format file đã sửa.
- `Button` shadcn có `shrink-0` → nút đứng cạnh nút khác trong flex bị tràn khung; thêm `shrink`
  / `min-w-0 flex-1` cho phần cần co.
- `sticky` trong `<Table>` shadcn không chạy (wrapper `overflow-x-auto` là khung cuộn gần nhất) →
  dùng `DataTable`, đừng bọc thêm.
- `bg.subtle` (`#F7F8FA`) **sáng hơn** nền `#F6F6F6` → khối nổi dùng `bg.surface` + bóng, không
  dùng `bg.subtle` làm nền khối.
- Chữ trên nền `--dot-*`: không đủ tương phản → dot chỉ cho chấm / icon, chữ dùng status gốc.
- commitlint `subject-case`: subject không bắt đầu bằng chữ hoa.
