---
description: Pattern chuẩn cho trang danh sách Mode A — PageHeader, toolbar, config summary, column filter, footer pagination
globs:
  - "src/app/admin/**"
  - "src/app/(backoffice)/**"
  - "src/components/backoffice/**"
  - "src/components/shared/{DataTable,FilterBar,SearchBar,PageHeader}*"
---

# Trang danh sách Mode A — pattern chuẩn

Nguồn: `FRONTEND-AI-RULES.md` §4.2 và §4.2.1. Đây là màn hình chính của back-office —
mọi danh sách chứng từ (PO, Receipt, Invoice, Pick task, Transfer…) dùng chung cấu trúc này.
Làm khác đi sẽ khiến các trang admin lệch nhau.

## Cột bắt buộc của bảng

Mã chứng từ (mono, link tới detail) · đối tượng liên quan · ngày · SL/giá trị ·
`<StatusBadge>` · cột hành động (icon-button hoặc menu).

- Số (SL, tiền) → **căn phải, `tabular-nums`, mono**.
- Row trạng thái "cần chú ý" (Exception, Short, Discrepancy, On Hold) →
  **left border 2px** nền `status.warning` rất nhạt ở mép trái.
- Bulk-select checkbox cho thao tác hàng loạt. Có row được chọn → hiện action phụ cạnh
  nút export. Hành động destructive vẫn phải `<ConfirmDialog>`.

## 1. PageHeader

- `<PageHeader>` với breadcrumb, title, subtitle, actions bên phải.
- Action chính: shadcn `<Button size="sm">`, nền `brand`, icon lucide, **nhãn động từ** rõ ràng.
- Stats **không hiện mặc định** — có nút `Hiện thống kê` / `Ẩn thống kê` trong PageHeader.
- Stats dùng `<StatTile>` + framer-motion. **Không animate `height: auto`** — dùng wrapper
  `gridTemplateRows: 0fr ↔ 1fr` + `min-h-0` + `overflow-hidden` để tránh flicker khi đóng.

## 2. Toolbar

Một hàng data-dense: search input bên trái → icon công cụ → nút export ngoài cùng phải.

- Search input luôn hiện, shadcn `<Input>` nền `bg.surface` trắng, icon `<Search>` màu accent,
  border `border.default`, focus `accent.blue` nhẹ.
- **Không** dùng title/tile lớn trong toolbar — tránh section trống và cao.
- Công cụ bổ trợ dùng `<Popover>` + `<Command>` + `<Checkbox>` + `<Button>`:

| Công cụ                   | Icon           | Tone                                      |
| ------------------------- | -------------- | ----------------------------------------- |
| Lọc trạng thái/facet      | `<Filter>`     | `info`                                    |
| Chọn phạm vi search field | `<ListFilter>` | `special`                                 |
| Ẩn/hiện cột               | `<Columns3>`   | `warning`                                 |
| Xuất Excel                | icon + text    | `positive`, `variant="outline" size="sm"` |
| Xoá/bulk destructive      | —              | `danger`                                  |

- Mặc định button công cụ nền/viền **trung tính**, chỉ icon có màu tone.
- **Active state chỉ bật khi config thật sự khác mặc định** (border tone + bg tone ~10%).
  `open`, `focus-visible`, hover, auto-highlight của `cmdk` **không được** trông như active.

## 3. Config summary

Thanh compact `Cấu hình` dưới toolbar — **không** dùng card lớn nhiều khoảng trống.
Mỗi nhóm là `<Badge variant="outline">` có nút `X` mini để reset riêng nhóm đó.

Phải tách rõ 5 loại (đừng gộp):

| Badge              | Nghĩa                               |
| ------------------ | ----------------------------------- |
| `Search chính`     | query của search bar                |
| `Trường search`    | các field mà search chính đang quét |
| `Search trong cột` | filter nhập từ header từng cột      |
| `Cột hiển thị`     | số cột đang bật / tổng              |
| `Trạng thái`       | facet/status đang chọn              |

Nút `Reset` bên phải reset toàn bộ config của page.

## 4. Search chính vs search trong cột — đừng nhầm

- **Search chính**: input ở toolbar, lọc rộng theo các field trong `Trường search`.
- `Trường search` chỉ là **scope** của search chính. Đừng gọi là "Global search" trong UI —
  dễ nhầm với search trong cột.
- **Search trong cột**: header **không** render input thường trực. Header chỉ có
  label + sort + icon filter nhỏ. Click icon mở `<Popover>` chứa `<Input>` nền trắng + nút `Xoá`.
- Cột có filter → icon filter đổi tone `info`; không có → trung tính.
- **Sort chỉ gắn vào label/sort button**, không gắn lên cả `<TableHead>` — nếu không,
  filter popover và checkbox sẽ trigger sort ngoài ý muốn.

## 5. Footer & pagination

- Số dòng/caption đặt ở **footer**, không đặt trên table header.
- Layout footer: `Dòng/trang` (`<Select>`) → range `Hiển thị x–y / tổng` → pagination góc phải.
- Page size mặc định: `10`, `15`, `20`, `50`. Đổi page size → **reset về trang đầu**.
- \> 10 dòng → table body trong vùng scroll nội bộ (`max-h` ~520px) + header sticky.
  ≤ 10 dòng → không tạo scroll nội bộ.

## 6. Màu & bề mặt

| Vùng                                                | Token                                                   |
| --------------------------------------------------- | ------------------------------------------------------- |
| Page/app shell                                      | `bg.base`                                               |
| Card, table body, item row                          | `bg.surface` (trắng)                                    |
| Sidebar, table header, toolbar, footer, summary bar | `bg.subtle`                                             |
| Hover/selected nhẹ                                  | `bg.muted` hoặc tone alpha thấp                         |
| Border                                              | `border.default` — Mode A ưu tiên border thay vì shadow |

**Không** dùng nền xám đậm cho item phụ dưới table. Item đại diện row/table data →
dùng `bg.surface` cho đồng bộ với table body.

## 7. Command/Popover UX

- Trong `<CommandItem>`, checkbox là tín hiệu chọn **duy nhất** — không thêm dấu check phụ bên phải.
- Tắt/giảm auto highlight của `cmdk` (`data-selected`) để không trông như selected thật.
  Hover dùng `bg.muted` nhẹ.
- Popover title ngắn, rõ chức năng: `Lọc trạng thái`, `Trường tìm kiếm`, `Ẩn hiện cột`.
- Footer popover: reset/mặc định bên trái, áp dụng bên phải.

## State lưu ở đâu

Xem [state-persistence.md](state-persistence.md) — ranh giới URL vs localStorage đã chốt.
Tóm tắt: **filter/search/status/sort/page → URL (nuqs)**;
**column visibility, density, showStats, page size → `usePageConfig`**.

## Bảng lớn

\> 500 dòng (inventory, movements, logs) → `@tanstack/react-virtual`,
giữ nguyên API của `DataTable`.
