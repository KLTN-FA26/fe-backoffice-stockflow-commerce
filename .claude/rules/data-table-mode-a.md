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

| Công cụ                       | Icon           | Tone                                                |
| ----------------------------- | -------------- | --------------------------------------------------- |
| Lọc trạng thái/facet          | `<Filter>`     | icon `--dot-info`                                   |
| Chọn phạm vi tìm (`Tìm theo`) | `<ListFilter>` | icon `--dot-special`                                |
| Chọn cột hiển thị             | `<Columns3>`   | icon `--dot-warning`                                |
| Xuất Excel                    | icon + text    | nền trắng, chữ `ink.primary`, icon `--dot-positive` |
| Xoá/bulk destructive          | —              | `danger`                                            |

- **Ít lựa chọn thì hiện sẵn, không giấu sau biểu tượng** (WF4 UX S01-4): lọc trạng thái có 2–4 giá trị → nút chọn
  nhanh nằm trên thanh (`ListToolbar` tự làm, `LIST_TOOLBAR_LIMITS.statusInlineMax`); lọc hai trạng thái kiểu "Chỉ cảnh
  báo" → `ToolbarSwitch` trong `tools`. Danh sách chọn (trạng thái / `Tìm theo` / cột) chỉ có ô "Tìm…" khi > 10 mục.
- Mặc định button công cụ nền/viền **trung tính**, chỉ icon có màu tone (thang tươi `--dot-*`).
- **Active state chỉ bật khi config thật sự khác mặc định** (border tone + bg tone ~10%).
  `open`, `focus-visible`, hover, auto-highlight của `cmdk` **không được** trông như active.

## 3. Config summary

Thanh compact `Cấu hình` dưới toolbar (`ListConfigSummary`) — **vẫn là khung có viền**: nền
`--summary-bg` (trắng), bo `--section-radius`, bóng `--card-shadow`. Không dùng card lớn nhiều khoảng trống.

**Chỉ hiện khi có gì đang bật** (WF4 UX S01-3): `resetDisabled` = không có lọc / sắp xếp / cột đổi so với mặc định →
thanh **không vẽ**. Khi hiện, chỉ có chip của nhóm **đang bật** (`active: true`) — không còn dòng "Chưa dùng / Chưa nhập /
Tất cả / 6/6". Mỗi chip là `<Badge variant="outline">` nền `bg.subtle` có nút `X` mini để bỏ riêng nhóm đó.

Nhãn chip dùng tiếng Việt, không chữ kỹ thuật (`Search`, `field`, `table`, `Void`):

| Chip             | Nghĩa                                |
| ---------------- | ------------------------------------ |
| `Tìm kiếm chính` | query của ô tìm ở toolbar            |
| `Tìm trong cột`  | filter nhập từ header từng cột       |
| `Cột hiển thị`   | số cột đang bật / tổng (chỉ khi đổi) |
| `Trạng thái`…    | facet/status đang chọn               |

Nút `Đặt lại` bên phải reset toàn bộ config của page (chữ đậm `--dot-info`, nền `--dot-info` ~10%).
Thông tin chỉ để đọc (vd phạm vi tìm của ô tìm kiếm) **không** thành chip — nằm ở công cụ `Tìm theo`.

## 4. Search chính vs search trong cột — đừng nhầm

- **Search chính**: input ở toolbar, lọc rộng theo các thông tin trong `Tìm theo`.
- `Tìm theo` chỉ là **phạm vi** của search chính. Đừng gọi là "Global search" trong UI —
  dễ nhầm với search trong cột.
- **Search trong cột**: header **không** render input thường trực. Header chỉ có
  label + sort + icon filter nhỏ. Click icon mở `<Popover>` chứa `<Input>` nền trắng + nút `Xoá`.
- Cột có filter → icon filter đổi tone `info`; không có → trung tính.
- **Sort chỉ gắn vào label/sort button**, không gắn lên cả `<TableHead>` — nếu không,
  filter popover và checkbox sẽ trigger sort ngoài ý muốn.

### 4.1 Lọc trên header cột — component & quy tắc

Mẫu: `features/production-order/components/schedule/` (Lịch sản xuất — mọi bộ lọc nằm trên header,
toolbar chỉ còn search chính). **Không tự viết popover lọc** — dùng `components/shared/ColumnHeaderFilter.tsx`,
gắn vào cột bằng `withHeaderFilters(columns, { [COLUMN_KEY]: <…/> })` (hoặc `ColumnDef.headerFilter`):

| Loại lọc                          | Component                                   | Ví dụ                                                         |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Chữ (mã, số đơn, tên)             | `ColumnFilterButton` — ô input, gõ là lọc   | Mã Đơn sản xuất, Đơn bán                                      |
| Chọn MỘT id (BE nhận một giá trị) | `HeaderOptionFilter` — ô gõ tìm + danh sách | Đơn vị sản xuất, Kho                                          |
| Nội dung khác                     | `HeaderFilterPopover` + control bên trong   | Khoảng ngày (2 `DatePicker`), checkbox "Chỉ dòng có cảnh báo" |

- **State trên URL (nuqs)** như mọi filter — kể cả lọc chữ trong cột. Gom vào một hook
  `use<Page>Filters` trả `params` (gửi BE), `hasFilters`, `reset`.
- **BE có tham số** → đưa vào `params` của query. **BE không có tham số tìm** → lọc phía FE trên dòng
  đã tải, KHÔNG đưa vào `params` (gõ chữ không được gọi lại API — có test kiểm số lần gọi). Hàm lọc
  thuần đặt ở `selectors.ts` (trim, không phân biệt hoa thường `toLocaleLowerCase("vi")`) + unit test.
  Danh sách bị cắt (`truncated`) phải vẫn có cảnh báo — lọc FE chỉ thấy dòng đã tải.
- `HeaderOptionFilter` chỉ hiện khi có lựa chọn (đọc được danh mục). URL đang lọc theo id mà danh mục
  không có (thiếu quyền / đang tải) → **vẫn hiện**, thêm option mã rút gọn (`withCurrent`) — không để màn
  bị lọc ngầm mà không chỗ bỏ.
- **Header luôn hiện khi rỗng**: truyền EmptyState qua `<DataTable emptyState>` thay vì `return empty`,
  nếu không lọc ra 0 dòng là mất luôn nút lọc để chỉnh lại.
- `hasFilters` gồm **cả** lọc trong cột + search chính → đúng loại empty ("Không tìm thấy kết quả" +
  "Bỏ bộ lọc", [api-conventions.md](api-conventions.md) §8); `reset` / "Bỏ bộ lọc" / "Đặt lại" xoá cả chúng.
- Hai bảng trên một trang cùng chịu một bộ lọc BE (kho, khoảng ngày…) → nút lọc hiện ở cột tương ứng
  của **cả hai** bảng, chung một state.
- Mỗi bộ lọc đang bật có **chip** trong thanh `Cấu hình` (§3) với nút X bỏ riêng; lọc chữ trong cột gom
  vào chip `Tìm trong cột` (vd `Đơn sản xuất “0002”, Đơn bán “SO-…”`). Ngày trên URL sai định dạng
  → chip hiện nguyên chữ (`formatDate` ném lỗi với ngày không hợp lệ).
- Nhãn, placeholder (`columnSearch(label)`) vào `constants/labels-*.ts`; key cột lấy từ `*_COLUMNS`.

### 4.2 Chọn cột hiển thị

Mọi trang danh sách có > 5 cột dữ liệu phải có công cụ `Columns3` (`Chọn cột hiển thị`) của `ListToolbar`.
Mẫu: `schedule/useScheduleColumns.ts`, `receipt/.../ReceiptList.tsx`.

- Truyền `ListToolbar` đủ bộ: `columnOptions` · `selectedColumns` · `defaultColumns` · `lockedColumns` ·
  `visibleColumnCount` · `onToggleColumn` · `onResetColumns` · `hasColumnConfig`. Lọc `columns` theo
  `visibleColumns` trước khi đưa vào `DataTable`.
- **Lưu `usePageConfig`** (localStorage, key `STORAGE_KEYS.admin<Page>Config` = `stockflow:<route>:config`) —
  sở thích cá nhân, **không** lên URL ([state-persistence.md](state-persistence.md)).
- **Cột khoá** (`lockedColumns`): cột mã/link sang chi tiết và cột thao tác — luôn hiện, toggle bỏ qua.
- Hàm `merge` của config: bỏ key cột lạ (cột đã gỡ), thêm lại cột khoá, rỗng → mặc định, giữ đúng
  thứ tự cột gốc.
- Chip `Cột hiển thị: x/y` (đếm không tính cột thao tác) chỉ hiện khi cột đã đổi, có X về mặc định; `Đặt lại` reset cả cột;
  `resetDisabled` chỉ khi **không** có filter **và** cột đang mặc định.
- Ẩn cột đang có lọc → bộ lọc vẫn áp, vẫn còn chip để bỏ.

### 4.3 Test bắt buộc khi thêm lọc cột / ẩn hiện cột

- Lọc chữ trong cột thu hẹp dòng + hiện chip + **không** gọi lại API.
- Lọc từ link (URL) không khớp → header vẫn hiện, chip X trả lại dòng.
- `HeaderOptionFilter` chọn option → gửi đúng tham số BE.
- Tắt một cột → `columnheader` biến mất, chip `x/y`, X trả lại; config đã lưu có key lạ → bỏ, giữ cột khoá.
- Popover dùng `getByPlaceholderText` cho ô tìm của `HeaderOptionFilter` (cmdk ghi đè `aria-label`);
  `afterEach` xoá `localStorage`.

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
- Popover title ngắn, rõ chức năng: `Lọc trạng thái`, `Tìm theo`, `Chọn cột hiển thị`.
- Footer popover: reset/mặc định bên trái, áp dụng bên phải.

## State lưu ở đâu

Xem [state-persistence.md](state-persistence.md) — ranh giới URL vs localStorage đã chốt.
Tóm tắt: **filter/search/status/sort/page → URL (nuqs)**;
**column visibility, density, showStats, page size → `usePageConfig`**.

## Bảng lớn

\> 500 dòng (inventory, movements, logs) → `@tanstack/react-virtual`,
giữ nguyên API của `DataTable`.
