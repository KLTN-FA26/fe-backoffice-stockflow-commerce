---
description: Pattern chuẩn cho trang danh sách Mode A (style Vercel) — tiêu đề ẩn, toolbar, config summary, column filter, footer pagination
globs:
  - "src/app/admin/**"
  - "src/app/(backoffice)/**"
  - "src/components/backoffice/**"
  - "src/components/shared/{DataTable,FilterBar,SearchBar,PageHeader}*"
---

# Trang danh sách Mode A — pattern chuẩn

Nguồn: `FRONTEND-AI-RULES.md` §4.2 và §4.2.1, **đã ghi đè** bởi
[Quyết định thiết kế 2026-10](design-tokens.md#quyết-định-thiết-kế-2026-10) (style Vercel).
Trang danh sách là loại "Danh sách" trong [3 loại trang](mode-a-backoffice.md#3-loại-trang) —
bọc `surface-soft`, mẫu `features/product/components/ProductList.tsx`. Đây là màn hình chính của back-office —
mọi danh sách chứng từ (PO, Receipt, Invoice, Pick task, Transfer…) dùng chung cấu trúc này.
Làm khác đi sẽ khiến các trang admin lệch nhau.

## Cột bắt buộc của bảng

Mã chứng từ (mono, link tới detail) · đối tượng liên quan · ngày · SL/giá trị ·
`<StatusBadge>` · cột hành động (icon-button hoặc menu).

- Số (SL, tiền) → **căn phải, `tabular-nums`, mono**.
- Row trạng thái "cần chú ý" (Exception, Short, Discrepancy, On Hold): **không** tô viền trái /
  nền riêng (đã bỏ — chốt 2026-10-21). Tín hiệu nằm ở chính ô `<StatusDot>` (tone warning/danger) và
  dòng lý do nếu có. `flagRow` của `DataTable` chỉ gắn `data-flagged` cho test, không đổi giao diện.
- Bulk-select checkbox cho thao tác hàng loạt. Có row được chọn → hiện action phụ cạnh
  nút export. Hành động destructive vẫn phải `<ConfirmDialog>`.

## 1. Tiêu đề & nút hành động

- **Không** title/subtitle hiển thị — tên trang là breadcrumb ở topbar. Giữ
  `<h1 className="sr-only">` cho screen reader. Không dùng `<PageHeader>` ở trang danh sách.
- Mọi nút hành động của trang (tạo mới, `Hiện thống kê` / `Ẩn thống kê`) truyền vào
  `<ListToolbar actions={…}>`, nằm sau nút xuất, cùng cỡ qua `TOOLBAR_ACTION_CLASS`.
- Action chính: shadcn `<Button>`, nền `brand`, icon lucide, **nhãn động từ** rõ ràng.
- Nút phụ (thống kê): nền `bg.surface`, viền `border.default`, chữ `ink.primary`, icon `--dot-info`.
- Stats **không hiện mặc định**.
- Stats dùng `<StatTile>` + framer-motion. **Không animate `height: auto`** — dùng wrapper
  `gridTemplateRows: 0fr ↔ 1fr` + `min-h-0` + `overflow-hidden` để tránh flicker khi đóng.

## 2. Toolbar

Một hàng data-dense: search input bên trái → icon công cụ → nút export → `actions` ngoài cùng phải.

- **Không khung bao** quanh toolbar. Mỗi ô/nút tự có nền `bg.surface`, viền `border.default`,
  bo `--control-radius` 8px, bóng `--control-shadow`, cao 40px (`--control-h` / `--control-size`).
- Search input luôn hiện, **kéo dài** chiếm phần còn trống (`--toolbar-search-max: none`),
  chữ 14px, icon `<Search>` màu accent, focus viền `brand`.
- **Không** dùng title/tile lớn trong toolbar — tránh section trống và cao.
- Công cụ bổ trợ dùng `<Popover>` + `<Command>` + `<Checkbox>` + `<Button>`:

| Công cụ                   | Icon           | Tone                                                |
| ------------------------- | -------------- | --------------------------------------------------- |
| Lọc trạng thái/facet      | `<Filter>`     | icon `--dot-info`                                   |
| Chọn phạm vi search field | `<ListFilter>` | icon `--dot-special`                                |
| Ẩn/hiện cột               | `<Columns3>`   | icon `--dot-warning`                                |
| Xuất Excel                | icon + text    | nền trắng, chữ `ink.primary`, icon `--dot-positive` |
| Xoá/bulk destructive      | —              | `danger`                                            |

- Mặc định button công cụ nền/viền **trung tính**, chỉ icon có màu tone (thang tươi `--dot-*`).
- **Active state chỉ bật khi config thật sự khác mặc định** (border tone + bg tone ~10%).
  `open`, `focus-visible`, hover, auto-highlight của `cmdk` **không được** trông như active.

## 3. Config summary

Thanh compact `Cấu hình` dưới toolbar (`ListConfigSummary`) — **vẫn là khung có viền**: nền
`--summary-bg` (trắng), bo `--section-radius`, bóng `--card-shadow`. Không dùng card lớn nhiều khoảng trống.
Mỗi nhóm là `<Badge variant="outline">` nền `bg.subtle` có nút `X` mini để reset riêng nhóm đó.

Phải tách rõ 5 loại (đừng gộp):

| Badge              | Nghĩa                               |
| ------------------ | ----------------------------------- |
| `Search chính`     | query của search bar                |
| `Trường search`    | các field mà search chính đang quét |
| `Search trong cột` | filter nhập từ header từng cột      |
| `Cột hiển thị`     | số cột đang bật / tổng              |
| `Trạng thái`       | facet/status đang chọn              |

Nút `Đặt lại` bên phải reset toàn bộ config của page. Khi **bấm được** (config khác mặc định):
chữ đậm `--dot-info`, nền `--dot-info` ~10% để người dùng thấy ngay; không có gì để đặt lại → xám mờ.

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
- Trang danh sách chính bật `<DataTable stickyHeader>`: thân bảng cuộn trong khung cao gần bằng
  màn hình, header luôn dính. Bảng phụ (trong card chi tiết): > 10 dòng → scroll nội bộ
  (`max-h` ~520px) + header sticky; ≤ 10 dòng → không scroll.
- `DataTable` tự quản khung cuộn — **không** bọc thêm `<Table>` shadcn (wrapper `overflow-x-auto`
  của nó làm `sticky` không chạy).

## 6. Màu & bề mặt

| Vùng                                   | Token                                   |
| -------------------------------------- | --------------------------------------- |
| Page/app shell                         | `bg.base`                               |
| Card, table body, item row             | `bg.surface` (trắng)                    |
| Table header, footer bảng, chip config | `bg.subtle`                             |
| Sidebar                                | `bg.sidebar`                            |
| Hover/selected nhẹ                     | `bg.muted` hoặc tone alpha thấp         |
| Border khối                            | `border.default` + bóng `--card-shadow` |
| Vạch dòng bảng / `divide-y` trong card | `--table-line` (mờ 55%)                 |

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
