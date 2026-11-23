# [StockFlowCommerce] Frontend AI System Rules

> File này là **hợp đồng thiết kế (design contract)** cho agent sinh code UI/UX.
> Phạm vi hiện tại: **chỉ UI/UX + mock data**. KHÔNG xử lý form thật, KHÔNG gọi API, KHÔNG business events.
> Tech stack: **Next.js (App Router) · Tailwind CSS · shadcn/ui · Framer Motion · TypeScript**.
> Nguồn sự thật nghiệp vụ: thư mục [`../docs/`](../docs/README.md). Mọi nhãn, trạng thái, hành động đều lấy từ đó.

---

## 0. Nguyên tắc bất di bất dịch (đọc trước tiên)

1. **Documentation-Driven.** Trước khi sinh bất kỳ UI nào, mở module tương ứng trong [`../docs/`](../docs/README.md) và đọc 2 bảng: **"Trạng thái / Vòng đời"** và **"Ràng buộc nghiệp vụ (Business Rules) & Edge case"**. Đây là nguồn quyết định nút nào `enable`/`disable`.
2. **Xác định mảng trước khi code.** Tính năng thuộc `warehouse/` (mảng A — Back-office) hay `ecommerce/` (mảng B — Storefront)? Mỗi mảng có **design mode** riêng (mục 4 & 5). Không trộn lẫn hai mode trong một màn hình.
3. **Không tự bịa nghiệp vụ.** Logic nào không rõ → tra [`../docs/open-questions/`](../docs/open-questions/README.md). Nếu vẫn chưa chốt → dùng mock data hợp lý và **đánh dấu giả định** bằng comment `// ASSUMPTION (open-question Xn): ...`.
4. **Mock data phải khớp docs.** Số lượng trạng thái, tên trạng thái (kèm tiếng Anh), vòng đời phải **đúng y hệt** bảng trong module. Không rút gọn, không thêm trạng thái không có trong docs.
5. **Token trước, hardcode sau.** KHÔNG bao giờ viết màu hex / px trần trong component. Luôn dùng design token (mục 3) hoặc utility semantic của Tailwind đã map token.
6. **Một trạng thái — một nguồn sự thật.** Mọi badge trạng thái đi qua **một** component `<StatusBadge>` + **một** file map màu (mục 6). Không tạo `OrderBadge`, `PaymentBadge`, `ChatBadge`… rời rạc.

---

## 1. Cấu trúc dự án & quy ước đặt tên

```
src/
├── app/                          # Next.js App Router
│   ├── (backoffice)/             # Mảng A — nhóm route warehouse, dùng BackofficeShell
│   │   ├── purchase-orders/
│   │   ├── receipts/
│   │   ├── warehouse-map/
│   │   └── ...
│   ├── (storefront)/             # Mảng B — nhóm route ecommerce, dùng StorefrontShell
│   │   ├── catalog/
│   │   ├── product/[slug]/
│   │   ├── design/[id]/
│   │   ├── cart/ checkout/
│   │   └── ...
│   └── layout.tsx                # Root layout: <ThemeProvider> + fonts
├── components/
│   ├── ui/                       # shadcn/ui nguyên bản (KHÔNG sửa tay — xem mục 9)
│   ├── shared/                   # Component dùng chung TỰ viết (mục 6) — cả 2 mảng
│   ├── backoffice/               # Component riêng mảng A
│   └── storefront/               # Component riêng mảng B
├── lib/
│   ├── tokens.ts                 # Design token export (mục 3)
│   ├── status-map.ts             # BẢN ĐỒ TRẠNG THÁI → semantic (mục 6) — nguồn sự thật
│   └── utils.ts                  # cn(), formatVND(), formatDate()...
├── mock/                         # Mock data theo module (mục 8)
│   ├── warehouse/  (purchase-orders.ts, receipts.ts, ...)
│   └── ecommerce/  (products.ts, orders.ts, designs.ts, ...)
└── styles/
    └── globals.css               # @theme token, base layer, 2 design mode
```

**Quy ước đặt tên:**

| Loại             | Quy ước                                     | Ví dụ                           |
| ---------------- | ------------------------------------------- | ------------------------------- |
| Component file   | `PascalCase.tsx`                            | `StatusBadge.tsx`               |
| Component export | `PascalCase`                                | `export function StatusBadge()` |
| Mock data file   | `kebab-case.ts`                             | `purchase-orders.ts`            |
| Token / const    | `SCREAMING_SNAKE` hoặc `camelCase` semantic | `STATUS_TONE`, `statusTone`     |
| Route group      | `(kebab-case)`                              | `(backoffice)`                  |
| Variant (CVA)    | `camelCase`                                 | `tone`, `density`, `size`       |

- Mỗi component dùng **`cva` (class-variance-authority)** cho variant, **`cn()`** để merge class. Không nối chuỗi class thủ công.
- Component nhận props **đánh kiểu đầy đủ** (`interface Props`), `children` rõ ràng, không `any`.

---

## 2. Hai design mode (khái niệm cốt lõi)

Toàn bộ hệ thống chạy trên **một bộ token** nhưng có **hai chế độ bề mặt**. Agent chọn mode theo route group và set class trên shell tương ứng.

| Trục            | **Mode A — Backoffice (Kho vận)**                           | **Mode B — Storefront (TMĐT)**                                  |
| --------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| Mật độ          | **Data-dense**: padding `xs`/`sm`, line-height chặt         | **Airy**: padding `lg`/`xl`, nhiều khoảng trắng                 |
| Mục tiêu        | Tối đa dữ liệu nhìn thấy, thao tác nhanh, không cần chuột   | Marketing, ưu tiên hình ảnh, cảm giác thoáng                    |
| Bảng dữ liệu    | DataTable bắt buộc (filter/sort/pagination)                 | Grid card, ít bảng, nhiều ảnh                                   |
| Bo góc          | `sm` (4–6px) — vuông vức, công nghiệp                       | `lg`/`xl` (12–16px) — mềm mại, thân thiện                       |
| Cường độ accent | Tiết chế, chủ yếu dùng cho trạng thái & CTA hành động       | Mạnh ở CTA mua hàng, giá, khuyến mãi                            |
| Typography      | Nhỏ hơn, tabular-nums cho số liệu, đậm ở heading bảng       | Lớn hơn ở heading sản phẩm, thoáng                              |
| Motion          | Tối thiểu, nhanh (120–180ms), tôn trọng reduced-motion      | Mượt, có chủ đích (200–320ms), reveal sản phẩm                  |
| Thiết bị        | Desktop-first (nhân viên kho, văn phòng)                    | **Mobile-first 100%** (khách hàng)                              |
| Shell           | `<BackofficeShell>` — sidebar cố định + topbar + breadcrumb | `<StorefrontShell>` — header mỏng + footer + floating cart/chat |

> **Quy tắc:** KHÔNG dùng class tiện ích của mode này bên trong màn hình mode kia. Density/radius/spacing lấy từ token theo mode.

---

## 3. Design Tokens (nguồn sự thật cho màu/kích thước)

Token định nghĩa một lần trong `globals.css` (`@theme`) + `lib/tokens.ts`. Tailwind class sinh ra từ đây.

### 3.1 Bảng màu — hai theme tách biệt (đã chốt)

Hệ thống dùng **hai theme độc lập** cho hai mảng (đã chốt với người dùng):

- **Mảng A (Kho vận / Back-office):** theme **Ink + Blue** — lạnh, nghiêm túc, data-dense. CTA = ink đen, thông tin/tiến trình = blue.
- **Mảng B (Storefront / TMĐT):** theme **Caramel** — ấm áp, thân thiện, **đối lập có chủ đích** với A. CTA = caramel nâu ấm, nền kem ấm.

Hai theme dùng **chung bộ semantic trạng thái** (positive/info/warning/danger/neutral/muted/special) — không đổi. Không trộn token của mảng này vào mảng kia.

**Nền & bề mặt (trung tính ấm nhẹ, không phải xám chết):**

| Token            | Light     | Dark      | Vai trò                                           |
| ---------------- | --------- | --------- | ------------------------------------------------- |
| `bg.base`        | `#F3F4F6` | `#0E0F11` | nền trang, app shell                              |
| `bg.surface`     | `#FFFFFF` | `#17181B` | card, panel, table body                           |
| `bg.subtle`      | `#F7F8FA` | `#1F2124` | nền phụ trắng lạnh, sidebar, header bảng, toolbar |
| `bg.muted`       | `#EEF0F3` | `#2A2C30` | hover, selected nhẹ, disabled, divider đậm        |
| `border.default` | `#DADDE1` | `#2E3034` | viền card, ô nhập                                 |
| `border.strong`  | `#C5CAD1` | `#3D4045` | viền focus, divider                               |

**Chữ (ink):**

| Token           | Light     | Dark      | Vai trò             |
| --------------- | --------- | --------- | ------------------- |
| `ink.primary`   | `#1A1B18` | `#F4F4F1` | chữ chính, heading  |
| `ink.secondary` | `#5C5E58` | `#A8AAA3` | mô tả, phụ đề       |
| `ink.tertiary`  | `#8A8C85` | `#76786F` | placeholder, meta   |
| `ink.inverse`   | `#FFFFFF` | `#1A1B18` | chữ trên nền accent |

**Brand — Mảng A (Ink + Blue):**

| Token         | Giá trị                              | Vai trò                                          |
| ------------- | ------------------------------------ | ------------------------------------------------ |
| `brand.ink`   | `#1A1B18`                            | CTA back-office (nút nghiêm túc, tương phản cao) |
| `accent.blue` | `#1E88E5` (light) · `#4EA6F0` (dark) | tiến trình, thông tin, link phụ                  |

**Brand — Mảng B (Caramel, ấm):**

| Token                | Light     | Dark      | Vai trò                               |
| -------------------- | --------- | --------- | ------------------------------------- |
| `brand.caramel`      | `#A9682F` | `#C98D4E` | **Brand chính**, CTA storefront, link |
| `brand.caramelHover` | `#8C5526` | `#D89E60` | hover CTA                             |
| `bg.warm`            | `#F7F2EB` | `#17130F` | nền trang storefront (kem ấm)         |
| `card.warm`          | `#FFFDFB` | `#211A14` | card sản phẩm storefront              |
| `ink.warm`           | `#2A211A` | `#F3EBE1` | chữ chính storefront                  |
| `ink2.warm`          | `#6E6055` | `#BBA996` | mô tả storefront                      |
| `ink3.warm`          | `#9C8C7C` | `#8A7866` | meta storefront                       |
| `line.warm`          | `#E6DCCC` | `#322820` | viền storefront                       |

**Semantic (trạng thái — dùng cho StatusBadge, alert, validation):**

| Token             | Giá trị   | Ý nghĩa                                      |
| ----------------- | --------- | -------------------------------------------- |
| `status.positive` | `#1F9D55` | thành công, hoàn tất, còn hàng               |
| `status.info`     | `#2B7FC4` | đang tiến hành, thông tin                    |
| `status.warning`  | `#D98207` | cảnh báo, chờ, sắp hết                       |
| `status.danger`   | `#D23B3B` | lỗi, huỷ, hết hàng, thất bại                 |
| `status.neutral`  | `#6B6E68` | nháp, trung tính                             |
| `status.muted`    | `#9A9C95` | đã đóng, terminal, ẩn                        |
| `status.special`  | `#7C5CBF` | hoàn tiền, sản xuất/in (tách biệt trực quan) |

> Mỗi semantic token có 3 sắc thái khi render badge: `bg` (nền nhạt ~12% alpha), `fg` (chữ/icon = màu gốc), `border` (~24% alpha). Xem mục 6.

### 3.2 Thang khoảng cách (spacing scale)

Dùng scale 4px. Token đặt tên theo mức, KHÔNG gọi thẳng `p-4` trong component — gọi qua biến density của mode.

| Token       | px  | Tailwind | Dùng khi                           |
| ----------- | --- | -------- | ---------------------------------- |
| `space.2xs` | 2   | `0.5`    | gap icon-chữ nhỏ                   |
| `space.xs`  | 4   | `1`      | padding mode A ô chặt              |
| `space.sm`  | 8   | `2`      | padding mode A chuẩn               |
| `space.md`  | 12  | `3`      | padding mode B ô nhỏ               |
| `space.lg`  | 16  | `4`      | padding card mode A                |
| `space.xl`  | 24  | `6`      | padding card mode B                |
| `space.2xl` | 32  | `8`      | section gap mode B                 |
| `space.3xl` | 48  | `12`     | hero / khoảng trắng lớn storefront |

**Ánh xạ density:**

- Mode A: card padding `space.lg`, gap giữa phần tử `space.sm`, row bảng `space.xs`–`space.sm`.
- Mode B: card padding `space.xl`, section gap `space.2xl`–`space.3xl`, gap phần tử `space.md`.

### 3.3 Bo góc (radius)

| Token         | px   | Dùng                             |
| ------------- | ---- | -------------------------------- |
| `radius.sm`   | 4    | mode A: nút, ô nhập, badge, card |
| `radius.md`   | 8    | mặc định shared                  |
| `radius.lg`   | 12   | mode B: card sản phẩm, panel     |
| `radius.xl`   | 16   | mode B: modal, sheet, hero card  |
| `radius.full` | 9999 | pill, avatar, badge tròn         |

### 3.4 Typography

**Font family (Next.js `next/font`, tự host):**

- **Sans (UI + body):** `Inter` — trung tính, đọc tốt ở cỡ nhỏ, hợp data-dense.
- **Display (heading lớn, số liệu nổi bật):** dùng **Inter Tight** (cùng họ, khác width/optical) cho heading storefront & số KPI. KHÔNG dùng 2 họ font khác biệt — một họ, hai biến thể, rõ ràng khác nhau.
- **Mono (mã, SKU, số vận đơn, tabular data):** `JetBrains Mono` — cho SKU, PO number, AWB, giá trị cần canh cột.

**Type scale (rem / line-height / weight):**

| Token           | Size           | Line-height | Weight | Vai trò                          |
| --------------- | -------------- | ----------- | ------ | -------------------------------- |
| `text.display`  | 2.5rem (40)    | 1.1         | 700    | hero storefront, tiêu đề lớn     |
| `text.h1`       | 1.875rem (30)  | 1.2         | 700    | tiêu đề trang                    |
| `text.h2`       | 1.5rem (24)    | 1.25        | 650    | tiêu đề section                  |
| `text.h3`       | 1.25rem (20)   | 1.3         | 600    | tiêu đề card / nhóm              |
| `text.body`     | 0.9375rem (15) | 1.6         | 400    | chữ thường                       |
| `text.bodySm`   | 0.875rem (14)  | 1.5         | 400    | mô tả, secondary                 |
| `text.label`    | 0.8125rem (13) | 1.4         | 500    | nhãn form, cột bảng              |
| `text.caption`  | 0.75rem (12)   | 1.4         | 450    | meta, timestamp, badge           |
| `text.overline` | 0.6875rem (11) | 1.3         | 600    | eyebrow, đơn vị (dùng sparingly) |

**Quy tắc typography:**

- Số liệu tài chính / tồn kho / SL / mã: luôn `font-variant-numeric: tabular-nums` + font mono khi là mã định danh.
- Giá tiền storefront: `text.h2`/`text.display`, weight 700, tabular-nums.
- KHÔNG dùng all-caps cho label thường (chỉ `overline` cho eyebrow thật cần).
- Độ dài dòng body ≤ 75 ký tự (`max-w-[68ch]`).

### 3.5 Bóng đổ (elevation)

| Token         | Dùng                                         |
| ------------- | -------------------------------------------- |
| `shadow.none` | mode A phần lớn bề mặt (dùng viền thay bóng) |
| `shadow.sm`   | card mode A, dropdown                        |
| `shadow.md`   | card mode B, sticky header                   |
| `shadow.lg`   | modal, sheet, floating cart/chat             |

> Back-office ưu tiên **viền (border)** hơn bóng để tách lớp — cảm giác công cụ, không phải SaaS-card mềm. Storefront được dùng bóng nhẹ.

### 3.6 Z-index (cố định, không tự bịa)

`dropdown: 50 · sticky: 100 · overlay: 900 · modal: 1000 · drawer/sheet: 1100 · toast: 1200 · tooltip: 1300 · floating(cart/chat): 800`

---

## 4. Kỹ năng UI — Mảng A: Kho vận (Back-office)

Áp dụng cho route nhóm `(backoffice)`, module `01`–`11`.

### 4.1 Phong cách

- **Data-dense.** Tối đa diện tích hiển thị dữ liệu. Padding `xs`/`sm`. Một màn hình thấy nhiều dòng nhất có thể.
- Bo góc `sm`, bóng tối giản, tách lớp bằng **viền**.
- Layout: **sidebar điều hướng cố định (trái) + topbar (breadcrumb, tìm kiếm toàn cục, kho đang chọn, user) + vùng nội dung**.
- Màu accent tiết chế; màu chủ yếu phục vụ **trạng thái** và **nút hành động chính**.

### 4.1.1 Quy chuẩn shadcn-first cho Back-office

- Mặc định mọi control tương tác phải dùng shadcn/ui hoặc shared component đã chuẩn hoá. Không viết raw `<button>`, `<input>`, `<select>`, `<textarea>`, custom dropdown, custom modal/dialog hoặc chip tự chế trong page-level code nếu shadcn/shared đã đáp ứng.
- Mapping bắt buộc: raw `button` → `<Button>`; raw `input` → `<Input>`; raw `textarea` → `<Textarea>`; raw `select`/dropdown đơn → `<Select>`; multi-select/filter dropdown → `<Popover>` + `<Command>` + `<Checkbox>`; modal/confirm → `<Dialog>` hoặc `<ConfirmDialog>`; table → `<DataTable>`; status → `<StatusBadge>`; tag/chip cấu hình → `<Badge>` + mini `<Button>` khi cần xoá.
- Ngoại lệ raw/native chỉ được phép trong `src/components/ui/*` khi đang bọc Radix/native primitive, element semantic/layout không có hành vi control, hidden/file input đặc thù, Next `<Link>/<Image>`, SVG/icon, hoặc primitive của thư viện cần `asChild`.
- Form Mode A dùng density chặt: control cao `h-8`/`h-9`, `rounded-[var(--r-sm)]`, `border-border-default`, `bg-bg-surface`, text `text-[0.8125rem]`, focus `focus-visible:border-accent focus-visible:ring-accent/20`.
- Button tone theo ý nghĩa và theo trạng thái nền gốc: primary/CTA/tạo mới/tiếp tục/gửi duyệt dùng `variant="default"` + `bg-brand !text-ink-inverse hover:bg-brand-hover hover:!text-ink-inverse` trong Mode A; button phụ dùng `variant="outline"`/secondary; control vốn không có nền như tab, row action, icon-only, collapse/sidebar/user-menu mới dùng `variant="ghost"` + `bg-transparent`; destructive/bulk delete dùng `danger`. Không đổi button vốn không nền thành nền đen, nhưng cũng không xoá nền đen của CTA/tạo mới.
- Với stepper/wizard/bảng `Quy trình` Mode A, item active phải luôn giữ nền đen `bg-brand` và chữ `text-ink-inverse`; nếu dùng `Button variant="ghost"` thì bắt buộc thêm `hover:bg-brand hover:text-ink-inverse` cho active state để hover không bị shadcn ghost override. Không dùng hover đổi màu cho active step; hover chỉ áp dụng cho inactive step bằng `hover:bg-bg-muted hover:text-ink-primary`.
- Với shadcn `<Select>`, luôn có label hiển thị bằng mắt gần control và `SelectLabel` trong dropdown nếu danh sách option cần tiêu đề; `SelectLabel` phải nằm trong `SelectGroup`. `aria-label`/`aria-labelledby` chỉ là bổ trợ accessibility, không thay thế visible label. Dùng `value` + `onValueChange`; cast union type tại ranh giới UI, không rename field/status trong mock. Với `<Checkbox>`, luôn convert `checked === true` trước khi ghi state boolean.
- Không cài thêm shadcn component tràn lan. Chỉ thêm khi có nhu cầu thật: `dropdown-menu` cho action menu nhiều item, `tabs` cho tab chuẩn, `alert-dialog` cho destructive confirm riêng, `switch`/`radio-group` khi boolean/choice xuất hiện lặp lại nhiều nơi.

### 4.2 Bảng dữ liệu (bắt buộc)

Mọi danh sách chứng từ (PO, Receipt, Invoice, Pick task, Transfer…) dùng **shadcn DataTable** với:

- **Phân trang** (pagination), **lọc** (filter theo trạng thái, kho, ngày, NCC…), **sắp xếp** (sort) trên cột.
- Cột bắt buộc: mã chứng từ (mono, link tới detail) · đối tượng liên quan · ngày · SL/giá trị · **`<StatusBadge>`** · cột hành động (icon-button hoặc menu).
- Số (SL, tiền) → căn phải, tabular-nums, mono.
- Row có trạng thái "cần chú ý" (Exception, Short, Discrepancy, On Hold) → tô nền `status.warning` rất nhạt ở mép trái (left border 2px).
- Bulk-select (checkbox) cho thao tác hàng loạt (release pick, duyệt nhiều PO). Khi có row được chọn, hiện action phụ cạnh nút export/action phải, ví dụ `Xoá đã chọn`; hành động destructive vẫn cần confirm nếu làm thật. Trong prototype UI-only, chỉ toast và không mutate mock data.

#### 4.2.1 Pattern chuẩn cho trang danh sách Mode A

Các page danh sách quản trị dùng cùng cấu trúc UI sau để đồng bộ:

1. **PageHeader**
   - Dùng `<PageHeader>` với breadcrumb, title, subtitle và actions bên phải.
   - Action chính dùng shadcn `<Button>` `size="sm"`, nền `brand`, icon lucide, nhãn động từ rõ ràng.
   - Stats không show trực tiếp mặc định. Có nút `Hiện thống kê` / `Ẩn thống kê` trong PageHeader.
   - Stats dùng `<StatTile>` và animation `framer-motion`. Không animate `height: auto`; dùng wrapper `gridTemplateRows: 0fr ↔ 1fr`, `min-h-0`, `overflow-hidden` để tránh flicker khi đóng.

2. **Toolbar tìm kiếm & công cụ**
   - Toolbar là một hàng data-dense: search input bên trái, các icon công cụ cạnh search, nút export/action phụ ngoài cùng phải.
   - Search input chính luôn hiển thị mặc định, dùng shadcn `<Input>` nền `bg.surface` trắng, icon `<Search>` màu `accent`, border `border.default`, focus `accent.blue` nhẹ.
   - Không dùng title/tile lớn trong toolbar; tránh làm section trống và cao.
   - Các công cụ bổ trợ dùng shadcn `<Popover>` + `<Command>` + `<Checkbox>` + `<Button>`:
     - Lọc trạng thái/facet: icon `<Filter>`, tone `info`.
     - Chọn phạm vi search field: icon `<ListFilter>`, tone `special`.
     - Ẩn/hiện cột: icon `<Columns3>`, tone `warning`.
   - Mặc định button công cụ phải có nền/viền trung tính, chỉ icon có màu tone để vẫn có tín hiệu màu. Khi config thật sự khác mặc định mới bật active state: border tone + bg tone nhạt (~10%).
   - `open`, `focus-visible`, hover hoặc auto-highlight của `cmdk` không được làm button trông như active config. Active chỉ dựa vào state config thật.
   - Nút export đặt ngoài cùng phải, có icon + text (`Xuất Excel`), tone `positive`, dùng shadcn `<Button variant="outline" size="sm">`.

3. **Config summary section**
   - Bên dưới toolbar có một thanh compact `Cấu hình`, không dùng card lớn nhiều khoảng trống.
   - Dùng shadcn `<Badge variant="outline">` cho từng nhóm config.
   - Summary phải tách rõ loại search:
     - `Tìm kiếm chính`: query của search bar mặc định.
     - `Trường search`: danh sách field mà search chính đang quét.
     - `Search trong cột`: filter nhập từ header từng cột.
     - `Cột hiển thị`: số cột đang bật / tổng cột cấu hình được.
     - `Trạng thái`: facet/status đang chọn.
   - Mỗi badge có nút `X` mini để reset riêng nhóm config khi nhóm đó khác mặc định.
   - Nút `Reset` bên phải reset toàn bộ config của page.
   - Config tạm thời lưu `localStorage` theo từng page; key theo format `stockflow:<route>:config`. Khi đọc localStorage phải merge với `DEFAULT_CONFIG` để không lỗi khi schema config thay đổi.

4. **Tìm kiếm chính vs search trong cột**
   - Tìm kiếm chính là input ở toolbar, lọc rộng theo các field được chọn trong `Trường search`.
   - `Trường search` chỉ là scope của search chính; không gọi nó là `Global search` trong UI vì dễ nhầm với search trong cột.
   - Search trong cột không render input thường trực trong header. Header chỉ hiển thị label + sort + icon filter nhỏ.
   - Click icon filter cột mở shadcn `<Popover>` chứa `<Input>` nền trắng và nút `Xoá`.
   - Khi cột có filter, icon filter cột đổi tone `info`; nếu không có filter, icon trung tính.
   - Sort chỉ gắn vào label/sort button, không gắn lên toàn bộ `<TableHead>`, để filter popover và checkbox không trigger sort.

5. **Table footer & pagination**
   - Caption/số dòng không đặt trên table header. Đưa xuống footer table.
   - Footer layout: đầu hàng là chọn `Dòng/trang` bằng shadcn `<Select>`, kế tiếp là range `Hiển thị x–y / tổng`, pagination nằm góc phải.
   - Page size options mặc định: `10`, `15`, `20`, `50`. Khi đổi page size, reset về trang đầu.
   - Nếu current page có hơn 10 dòng, table body phải nằm trong vùng scroll nội bộ (`max-h` khoảng 520px) và header sticky. Nếu 10 dòng trở xuống, table không tạo scroll nội bộ.

6. **Màu và bề mặt cho data-table Mode A**
   - Page/app shell dùng `bg.base`.
   - Card/table body/item row dùng `bg.surface` trắng.
   - Sidebar, table header, toolbar, footer table, summary bar dùng `bg.subtle` trắng lạnh nhẹ.
   - Hover/selected nhẹ dùng `bg.muted` hoặc tone alpha thấp.
   - Border dùng `border.default`; Mode A ưu tiên border thay vì shadow.
   - Không dùng nền xám đậm cho item phụ bên dưới table; nếu item đại diện row/table data thì dùng `bg.surface` để đồng bộ với table body.
   - Tone semantic cho toolbar: `info` = filter/facet, `special` = field scope, `warning` = column visibility, `positive` = export/success, `danger` = xoá/bulk destructive.

7. **Command/Popover UX**
   - Trong `<CommandItem>`, checkbox là tín hiệu chọn duy nhất; không thêm dấu check phụ bên phải nếu đã có checkbox.
   - Tắt/giảm auto highlight của `cmdk` (`data-selected`) để không nhìn như selected thật; hover có thể dùng `bg.muted` nhẹ.
   - Popover title ngắn, mô tả rõ chức năng: `Lọc trạng thái`, `Trường tìm kiếm`, `Ẩn hiện cột`.
   - Footer popover dùng shadcn `<Button>`: reset/mặc định bên trái, áp dụng bên phải.

### 4.3 Trải nghiệm thao tác (operation-friendly)

- **Ưu tiên không cần chuột:** tự focus ô input đầu tiên khi mở form/dialog; `Enter` submit, `Esc` đóng; điều hướng bảng bằng phím mũi tên; shortcut quét barcode (input luôn sẵn sàng nhận ký tự từ máy quét).
- **Màn quét (scan):** module 03/05/07/08/10/11 — ô nhập barcode nổi bật, luôn focus, feedback tức thì (âm thanh/flash màu) khi quét đúng/sai.
- **Action-gating (cực kỳ quan trọng):** đọc bảng "Chuyển tiếp cho phép" của module → nút hành động chỉ `enable` khi trạng thái hiện tại cho phép. Ví dụ PO: `Draft`→[Submit, Cancel]; `Pending Approval`→[Approve, Reject] (chỉ role Approver); sau `Confirmed`→khoá sửa nội dung, thay bằng [Create Revision]. Trạng thái terminal (`Closed`/`Cancelled`/`Paid`/`Completed`)→ẩn mọi nút mutating.
- **Nút hành động chính** ("Lấy hàng", "Đóng gói", "Nhận hàng", "Xác nhận") → tương phản cao, đặt góc phải-trên vùng nội dung hoặc cuối form, nhãn động từ rõ ràng.
- **Override luôn cần lý do:** khi người dùng ghi đè gợi ý (slotting, vị trí putaway) → bắt buộc chọn **reason code** qua picker trước khi cho lưu.
- **Validate realtime:** SL nhận ≤ SL đặt×(1+dung sai), SL lấy ≤ phân bổ, kiểm đơn 100%, kho nguồn ≠ kho đích, hạn dùng > ngày nhận, unique SKU/số hoá đơn → báo lỗi inline ngay ô nhập, disable nút submit tới khi hợp lệ.

### 4.4 Màn hình đặc thù mảng A (cần component riêng)

- **Warehouse Map 2D/3D** (module 06): canvas phân cấp Kho→Zone→Aisle→Rack→Level→Bin, **heatmap độ lấp đầy**, click bin xem chi tiết. Lưu ý BR: map 3D **không phải nguồn sự thật tồn** → luôn kèm nhãn "chỉ mang tính trực quan".
- **Ranked slotting suggestion** (05, 06): list vị trí gợi ý + điểm số + lý do ("gần dock, cùng SKU, còn 60% chỗ"), nút accept #1 / chọn khác / override + reason.
- **Three-way matching diff** (04): so sánh PO ↔ Receipt ↔ Invoice theo dòng, highlight variance (quantity/price/tax) bằng màu.
- **Pick list + route** (07): danh sách lấy hàng theo lộ trình tối ưu.
- **Tracking timeline** (09): dòng thời gian trạng thái vận đơn.
- **KPI dashboard** (06): utilization %, honeycombing, số vị trí quá tải.
- **Form nhiều bước + variant matrix** (01): lưới SKU sinh từ Size × Color.

---

## 5. Kỹ năng UI — Mảng B: Sàn TMĐT (Storefront)

Áp dụng cho route nhóm `(storefront)`, module `12`–`18`.

### 5.1 Phong cách

- **Minimalist, marketing-focused.** Ưu tiên hình ảnh sản phẩm. Khoảng trắng `lg`/`xl` tạo cảm giác thoáng.
- Bo góc `lg`/`xl`, bóng nhẹ, nhiều không gian thở.
- Accent **caramel** (`brand.caramel`) mạnh ở CTA mua hàng, giá, khuyến mãi.
- **Mobile-first 100%.** Catalog & Cart (13, 14) responsive hoàn chỉnh, tối ưu chạm (target ≥ 44px).

### 5.2 Module 12 — Thiết kế 2D/3D (màn hình phức tạp nhất)

Layout **Canvas chia màn hình**:

- **Desktop:** 60% diện tích cho **Viewer 3D/2D** (trái), 40% cho **bảng công cụ tùy chỉnh** (phải).
- **Mobile:** xếp dọc, viewer trên, công cụ dưới dạng bottom-sheet / tab.
- Vùng làm việc 2D hiển thị **3 lớp guide**: `print area` (nét liền) → `safe area` (nét đứt, bên trong) → `bleed` (nét chấm đỏ nhạt, bên ngoài mép). Cảnh báo realtime (viền đỏ + toast) khi phần tử tràn print area hoặc đè vùng cấm.
- **Toolbar customization:** upload ảnh (validate định dạng/dung lượng/**DPI** → cảnh báo "ảnh mờ" nếu DPI thấp), thêm text (phông trong danh sách cho phép, cỡ, màu, canh lề, hiệu ứng), hình khối/clipart/template, thao tác kéo–thả/xoay/scale/canh.
- **Live 3D Preview:** thay đổi 2D map texture lên model 3D realtime; khách xoay/zoom. **Bắt buộc** hiển thị disclaimer: _"Màu sắc hiển thị có thể sai lệch so với thành phẩm in thật"_. **Fallback:** thiết bị yếu/lỗi WebGL → hạ cấp ảnh tĩnh render server; model lỗi → preview 2D phẳng + nhãn "preview 3D không khả dụng".
- **Preflight Report panel:** `Pass`(xanh)/`Warning`(vàng)/`Fail`(đỏ) kèm lý do. `Fail` → **chặn nút Confirm**. `Warning` → cho qua kèm xác nhận rủi ro.
- **Action-gating:** nút **"Thêm vào giỏ" chỉ enable khi Design = `Confirmed`**. Sản phẩm tùy chỉnh KHÔNG thêm thẳng vào giỏ.
- Đổi variant (màu/size/chất liệu) → print area có thể đổi → kiểm tra lại layout, cảnh báo phần tử không hợp lệ.

### 5.3 Module 13 — Catalog (PLP/PDP)

- **PLP:** grid `<ProductCard>`, sidebar `<FilterPanel>` (desktop) / **drawer** (mobile), `<SortDropdown>`. Empty state khi tìm rỗng → gợi ý từ khoá, nút "bỏ bớt bộ lọc", sản phẩm phổ biến.
- **Bộ lọc (facets):** loại/danh mục · màu (swatch) · chất liệu · giá (slider min/max) · đánh giá (sao). **Sort:** mới nhất · giá (asc/desc) · phổ biến.
- **PDP:** gallery ảnh lớn (ưu tiên hình), mô tả, `<VariantSelector>` (size/màu). Chọn variant → cập nhật **giá + tình trạng còn hàng** của SKU realtime. Variant hết hàng → swatch mờ/gạch + nhãn "hết hàng" (disabled). Sản phẩm liên quan, wishlist, so sánh.
- **CTA phân nhánh:** sản phẩm thường → **"Thêm vào giỏ"**; sản phẩm tùy chỉnh → **"Bắt đầu thiết kế"** (chuyển module 12).
- `Unpublished` + khách có link → trang **"sản phẩm không còn khả dụng"** + gợi ý tương tự.

### 5.4 Module 14 — Cart & Checkout

- **Wizard nhiều bước** `<CheckoutStepper>`: Cart → Voucher → Ước tính ship/thuế → Thông tin & địa chỉ → Phương thức vận chuyển → Chốt tổng → Giữ hàng & chọn thanh toán.
- `<CartLineItem>`: ảnh + variant + **design thumbnail** (nếu tùy chỉnh) + `<QuantityStepper>` + line price + xoá.
- `<OrderTotals>` minh bạch: subtotal + ship + thuế − giảm giá = tổng.
- **Edge case UI:** dòng hết tồn → **chặn checkout**, hiện lỗi, cho giảm SL/xoá/đổi variant; giá đổi giữa giỏ↔checkout → yêu cầu xác nhận giá mới; voucher hết lượt → bỏ + tính lại; Sale áp giảm vượt hạn mức → đơn treo "chờ duyệt ưu đãi".

### 5.5 Module 15 — Payment

- `<PaymentMethodSelector>`: radio-card có logo phương thức (gateway/ví/thẻ/chuyển khoản/COD/đặt cọc).
- **Chuyển khoản thủ công** → panel thông tin tài khoản + nội dung = mã đơn + **nút copy**, trạng thái `Awaiting Confirmation`.
- **Payment result screen:** success/fail + nút **"Thử lại"**.
- KHÔNG lưu dữ liệu thẻ (PCI-DSS) → chỉ hiển thị **4 số cuối + thương hiệu thẻ**.

### 5.6 Module 16 — Sales Chat

- `<ChatBubble>` 2 phía (khách trái / Sale phải), avatar, timestamp.
- **Rich bubble card** cho link sản phẩm/thiết kế/thanh toán/báo giá.
- **Internal note** (chỉ Sale thấy) → **tách biệt rõ giao diện** (nền vàng nhạt + icon "internal"), không render phía khách.
- **SLA indicator:** hội thoại quá hạn → badge đỏ/amber + sort lên đầu hàng đợi.
- Offline/ngoài giờ → hiện thời gian phản hồi dự kiến + form thu email. Masking thông tin nhạy cảm trong ô nhập.
- Mobile: `<ChatComposer>` dạng bottom-sheet.

### 5.7 Module 17 — Order Management & Module 18 — Customer

- `<OrderTimeline>` + `<TrackingProgress>` (Shipped→In Transit→Delivered) cho khách.
- **Order amendment gating:** `Pending Payment`→sửa tự do; `Confirmed`/`In Production`(chưa in)→đổi địa chỉ/SL kèm thu thêm/hoàn bớt; `Ready to Fulfill`/`Picking`→hạn chế; `Packed`/`Shipped`→**disable nút sửa nội dung**, chỉ qua carrier/luồng trả hàng. Nút "Huỷ" disable sau `Shipped`.
- Module 18 form: định danh (họ tên*, email* là khoá định danh, SĐT*, loại khách cá nhân/doanh nghiệp → hiện mã số thuế), **sổ địa chỉ VN 3 cấp tỉnh/huyện/xã** (cascading select), saved payment (brand+last4), security (đổi mật khẩu, 2FA, thu hồi phiên), consent marketing (toggle + lưu mốc), dữ liệu phái sinh read-only (lịch sử đơn, tổng chi, loyalty tier, segment), privacy actions (xuất/sửa/xoá dữ liệu).

---

## 6. Bộ shared components dùng chung

Đặt trong `src/components/shared/`. Đây là **bắt buộc dùng lại**, không viết lại ở từng màn hình.

### 6.1 `<StatusBadge>` — component QUAN TRỌNG NHẤT

Một component generic duy nhất xử lý **~69 trạng thái** toàn hệ thống. Nhận `status` + `domain`, tự tra `status-map.ts` → semantic tone → màu.

```tsx
<StatusBadge domain="order" status="Pending Payment" />
<StatusBadge domain="po" status="Confirmed" size="sm" />
<StatusBadge domain="inventory" status="Quarantine" withIcon />
```

**7 semantic tone** (đủ phủ mọi trạng thái):

| Tone       | Màu token         | Nhóm trạng thái điển hình                                                                                                                       |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `positive` | `status.positive` | Confirmed, Approved, Completed, Delivered, Packed, Received, Active, Paid, Matched, Accepted, Pass, In stock                                    |
| `info`     | `status.info`     | In Progress, In Transit, Picking, Shipped, Assigned, Released, Published, Authorized, Pre-order                                                 |
| `warning`  | `status.warning`  | Pending Approval, On Hold, Exception, Short, Discrepancy, Quarantine, Blocked, Low stock, Awaiting Confirmation, Verification Failed, Escalated |
| `danger`   | `status.danger`   | Cancelled, Rejected, Failed, Disputed, Delivery Failed, Returned, Suspended, Out of stock, Fail                                                 |
| `neutral`  | `status.neutral`  | Draft, Created, Pending, Suggested, Guest, Label Created                                                                                        |
| `muted`    | `status.muted`    | Closed, Inactive, Hidden, Unpublished, Anonymized, Merged, Voided, Superseded                                                                   |
| `special`  | `status.special`  | Refunded, Partially Refunded, In Production (tách refund/sản xuất khỏi positive/info để dễ phân biệt)                                           |

**Cấu trúc render:** pill `radius.full`, nền = tone@12%, chữ+icon = tone@100%, viền = tone@24%. Hai size: `sm` (caption, mode A) / `md` (bodySm, mode B). Luôn kèm **nhãn tiếng Việt + tiếng Anh gốc trong `title`/tooltip**.

> **Nguồn sự thật:** mọi cặp `(domain, status) → tone` nằm trong `lib/status-map.ts`. Khi thêm module mới, chỉ sửa file này, KHÔNG sửa component. Danh sách trạng thái đầy đủ lấy từ bảng "Trạng thái / Vòng đời" của từng module trong docs.

### 6.2 Danh sách component shared còn lại

**Layout & khung:**

- `<PageHeader>` — tiêu đề trang + breadcrumb + vùng action phải (mode A) / hero title (mode B).
- `<SectionTitle>` — heading section + mô tả + action phụ. Dùng token `text.h2`/`text.h3`.
- `<AppCard>` / `<SurfaceCard>` — card nền `bg.surface`, viền `border.default`, radius theo mode. Biến thể `elevated` (storefront, shadow.md) / `flush` (back-office, border).
- `<BackofficeShell>` — sidebar + topbar + content (mode A).
- `<StorefrontShell>` — header mỏng + content + footer + floating cart/chat (mode B).
- `<PageContainer>` — giới hạn max-width + padding theo mode.

**Dữ liệu & hiển thị:**

- `<DataTable>` — wrapper shadcn table: filter/sort/pagination/bulk-select/column-config (mode A chủ lực).
- `<FilterBar>` / `<FilterPanel>` — bộ lọc facet (drawer trên mobile). Dùng chung cả 2 mảng (back-office lọc chứng từ, storefront lọc catalog).
- `<SortDropdown>` — sắp xếp.
- `<SearchBar>` — tìm kiếm toàn cục / catalog.
- `<StatTile>` / `<KpiCard>` — ô số liệu dashboard (giá trị mono tabular + nhãn + delta).
- `<EmptyState>` — trống + hướng dẫn hành động ("Chưa có đơn nào — tạo đơn đầu tiên").
- `<MoneyText>` — format tiền VND (`formatVND`), tabular-nums, tùy chọn hiển thị giá khuyến mãi + % giảm.

**Storefront chuyên biệt:**

- `<ProductCard>` · `<ProductGrid>` · `<ImageGallery>` · `<PriceDisplay>` · `<AvailabilityBadge>` (dựa ATP) · `<VariantSelector>` (swatch có disabled/hết hàng) · `<RatingStars>` · `<WishlistButton>` · `<QuantityStepper>`.
- `<CartLineItem>` · `<VoucherInput>` · `<OrderTotals>` · `<CheckoutStepper>` · `<AddressForm>` (VN 3 cấp) · `<ShippingMethodSelector>` · `<PaymentMethodSelector>`.
- `<OrderTimeline>` · `<TrackingProgress>` · `<OrderCard>` · `<ReturnRequestForm>`.
- `<ChatBubble>` · `<ChatComposer>` · `<RichLinkCard>` · `<InternalNote>` · `<SLABadge>` · `<CSATSurvey>`.
- `<DesignCanvas>` · `<CanvasToolbar>` · `<LivePreview3D>` (+fallback) · `<PreflightReport>` · `<DesignVersionList>`.
- `<CustomerProfileCard>` · `<AddressBook>` · `<SavedPaymentMethod>` · `<SegmentBadge>` · `<LoyaltyTierBadge>`.

**Back-office chuyên biệt:**

- `<WarehouseMap>` (2D/3D + heatmap) · `<SlottingSuggestionList>` (ranked) · `<MatchDiffView>` (three-way) · `<PickList>` · `<ScanInput>` (barcode, auto-focus) · `<VariantMatrix>` (Size×Color) · `<ReasonCodePicker>` · `<TimelineEvents>`.

**Phản hồi (feedback):**

- `<Toast>` (sonner/shadcn) · `<ConfirmDialog>` (cho hành động phá huỷ/huỷ) · `<AlertInline>` (warning không chặn, ví dụ ngày giao quá khứ) · `<Skeleton>` (loading) · `<Tooltip>`.

### 6.3 Quy ước dùng chung

- Component shared KHÔNG chứa nghiệp vụ cứng — nhận dữ liệu qua props, nhận `density`/`tone`/`size` làm variant.
- Mọi component hỗ trợ **dark mode** qua token (không hardcode màu).
- Mọi component interactive có **focus-visible** rõ ràng (ring `border.strong` / `accent.blue`) và tôn trọng **`prefers-reduced-motion`**.

---

## 7. Theme (light/dark) & cách áp dụng

- **Hai mảng dùng hai theme tách biệt** (đã chốt): A = Ink + Blue (lạnh), B = Caramel (ấm). Không trộn token của mảng này vào mảng kia.
- **Cả hai theme đều hỗ trợ light + dark.** Token mục 3 đã có cột Light/Dark.
- `<ThemeProvider>` bọc ở root layout; class `dark` trên `<html>`; lưu lựa chọn (in-memory cho demo — KHÔNG dùng localStorage trong artifact preview).
- Dark mode back-office: nền `#0E0F11`, giảm contrast gắt (chữ `#F4F4F1` không phải trắng tuyệt đối), giữ nguyên semantic tone nhưng hạ saturation nhẹ.
- Dark mode storefront: nền `#17130F` (đen ấm), chữ `#F3EBE1` (kem), caramel sáng hơn `#C98D4E`.
- Chuyển light/dark bằng CSS variable, KHÔNG re-render component.
- Mặc định theo `prefers-color-scheme`, có nút toggle ở topbar (A) / header (B).

---

## 8. Mock data (khớp docs, không xử lý logic)

- Mỗi module một file trong `mock/`. Export mảng object **đúng shape** dữ liệu docs mô tả (field tối thiểu agent đã trích xuất: ví dụ PutawayTask có `taskNo, receiptId, warehouseId, status, priority, assignedTo...`).
- **Trạng thái trong mock phải phủ đủ mọi giá trị** của bảng vòng đời (để demo được hết badge màu và action-gating).
- Số lượng hợp lý: list 15–50 dòng (đủ test pagination), 1–3 detail mẫu.
- Tiền tệ **VND**, đơn vị **mét**, địa chỉ **VN (tỉnh/huyện/xã)**, nhãn **song ngữ Việt–Anh** khi là thuật ngữ (lấy từ [`../docs/glossary/`](../docs/glossary/README.md)).
- Dữ liệu suy đoán (phương thức thanh toán, công thức giá tùy chỉnh…) → comment `// ASSUMPTION (open-question Dn)`.
- Mock KHÔNG kèm hàm xử lý nghiệp vụ thật — chỉ dữ liệu tĩnh + (tùy chọn) hàm delay giả lập loading cho skeleton.

---

## 9. Ràng buộc kỹ thuật chung

- **shadcn/ui:** copy component vào `components/ui/`, KHÔNG sửa tay file gốc. Muốn tuỳ biến → bọc ở `components/shared/` hoặc override bằng `className` + token. Nếu buộc phải đổi `components/ui/`, ghi rõ trong PR/comment.
- **Tailwind:** dùng utility sinh từ `@theme` token. KHÔNG hex/px trần. KHÔNG `!important` trừ khi override shadcn bất khả kháng (kèm comment).
- **Framer Motion:** motion có chủ đích. Mode A: 120–180ms, tối giản (fade/slide nhỏ cho dropdown, row xuất hiện). Mode B: 200–320ms, reveal sản phẩm, transition giữa bước checkout, hover card nâng nhẹ. **Tránh** fade-and-slide-up đồng loạt mọi section (trông AI-generated). Luôn `useReducedMotion()`.
- **TypeScript:** `strict`. Không `any`. Props có interface. Status/domain dùng union type lấy từ `status-map.ts`.
- **Accessibility:** contrast ≥ 4.5:1 (chữ) / 3:1 (UI); target chạm ≥ 44px (storefront); nhãn `aria` cho icon-button; bảng có `<caption>`/scope; form có label gắn input.
- **Responsive:** back-office desktop-first (tối thiểu 1024px, có degrade tablet); storefront mobile-first (320px → 1440px).
- **Không giả định nghiệp vụ** — lặp lại: mọi thứ mơ hồ tra `open-questions/` và đánh dấu `ASSUMPTION`.

---

## 10. Checklist trước khi agent hoàn thành một màn hình

- [ ] Đã xác định đúng **mảng** (A/B) và áp đúng **design mode**?
- [ ] Đã đọc bảng **Trạng thái** + **Business Rules** của module trong docs?
- [ ] Mọi trạng thái dùng `<StatusBadge>` + `status-map.ts` (không badge tự chế)?
- [ ] Nút hành động **enable/disable đúng** theo "Chuyển tiếp cho phép"? Trạng thái terminal ẩn nút mutating?
- [ ] Không có **hex/px trần** — tất cả qua token?
- [ ] Hỗ trợ **dark mode** + **focus-visible** + **reduced-motion**?
- [ ] Mock data **phủ đủ trạng thái**, nhãn khớp glossary, giả định có comment `ASSUMPTION`?
- [ ] Responsive đúng mode (A desktop-first / B mobile-first)?
- [ ] Component lặp lại đã **dùng shared**, không viết lại?

---

_File này là nguồn sự thật cho UI/UX. Khi nghiệp vụ trong `docs/` thay đổi (trạng thái mới, rule mới), cập nhật `lib/status-map.ts` và file này trong cùng lượt._
