---
description: Mode B (Storefront, module 12-18) — theme Caramel, airy, mobile-first
globs:
  - "src/app/(storefront)/**"
  - "src/components/storefront/**"
  - "src/features/{design,catalog,cart,payment,chat,order,customer}/**"
---

# Mode B — Storefront (Sàn TMĐT)

Nguồn: `src/_design/FRONTEND-AI-RULES.md` §2, §5. Module docs 12–18.

**Tinh thần:** ấm áp, thân thiện, **đối lập có chủ đích** với mode A. Người dùng là
khách mua hàng trên điện thoại — ưu tiên khoảng trắng, ảnh lớn, ít thao tác.

## Token của mode này

| Token                | Light     | Dark      | Vai trò                |
| -------------------- | --------- | --------- | ---------------------- |
| `brand.caramel`      | `#A9682F` | `#C98D4E` | brand chính, CTA, link |
| `brand.caramelHover` | `#8C5526` | `#D89E60` | hover CTA              |
| `bg.warm`            | `#F7F2EB` | `#17130F` | nền trang (kem ấm)     |
| `card.warm`          | `#FFFDFB` | `#211A14` | card sản phẩm          |
| `ink.warm`           | `#2A211A` | `#F3EBE1` | chữ chính              |
| `ink2.warm`          | `#6E6055` | `#BBA996` | mô tả                  |
| `ink3.warm`          | `#9C8C7C` | `#8A7866` | meta                   |
| `line.warm`          | `#E6DCCC` | `#322820` | viền                   |

**CẤM blue** (`accent.blue` `#1E88E5`/`#4EA6F0`) và `brand.ink` làm CTA ở mode B.
Đó là token của [mode A](mode-a-backoffice.md). Semantic status vẫn dùng chung.

## Density

- Card padding: `space.xl` (24px)
- Section gap: `space.2xl`–`space.3xl` (32–48px)
- Gap phần tử: `space.md` (12px)
- Radius: `radius.lg` (12px) card sản phẩm/panel · `radius.xl` (16px) modal, sheet, hero
- Elevation: được dùng bóng nhẹ — `shadow.md` cho card và sticky header, `shadow.lg` cho
  modal, sheet, floating cart/chat.

## Responsive

**Mobile-first**, dải 320 → 1440px. Thiết kế từ 320 trước rồi mở rộng lên.

## Phong cách (§5.1)

Minimalist, marketing-focused. Ưu tiên **hình ảnh sản phẩm**. Khoảng trắng `lg`/`xl`.
Caramel mạnh ở CTA mua hàng, giá, khuyến mãi. Target chạm ≥ **44px**.

## Module 12 — Design 2D/3D (màn phức tạp nhất, §5.2)

Layout chia màn hình: desktop 60% viewer (trái) / 40% bảng công cụ (phải).
Mobile xếp dọc, viewer trên, công cụ dưới dạng bottom-sheet/tab.

- **3 lớp guide** trên vùng 2D: `print area` (nét liền) → `safe area` (nét đứt, bên trong)
  → `bleed` (nét chấm đỏ nhạt, ngoài mép). Tràn print area → viền đỏ + toast realtime.
- Upload ảnh: validate định dạng/dung lượng/**DPI** — DPI thấp thì cảnh báo "ảnh mờ".
- **Live 3D Preview** bắt buộc kèm disclaimer: _"Màu sắc hiển thị có thể sai lệch so với
  thành phẩm in thật"_. Fallback: WebGL lỗi → ảnh tĩnh render server; model lỗi →
  preview 2D phẳng + nhãn "preview 3D không khả dụng".
- **Preflight Report**: `Pass`(xanh)/`Warning`(vàng)/`Fail`(đỏ) kèm lý do.
  `Fail` → **chặn nút Confirm**. `Warning` → cho qua kèm xác nhận rủi ro.
- **Action-gating**: nút "Thêm vào giỏ" **chỉ enable khi Design = `Confirmed`**.
  Sản phẩm tuỳ chỉnh KHÔNG thêm thẳng vào giỏ.
- Đổi variant → print area có thể đổi → kiểm tra lại layout, cảnh báo phần tử không hợp lệ.

## Module 13 — Catalog (§5.3)

- **PLP**: grid `<ProductCard>`, `<FilterPanel>` sidebar desktop / **drawer** mobile,
  `<SortDropdown>`. Empty state → gợi ý từ khoá + nút "bỏ bớt bộ lọc" + sản phẩm phổ biến.
- Facets: loại/danh mục · màu (swatch) · chất liệu · giá (slider) · đánh giá (sao).
- **PDP**: gallery ảnh lớn, `<VariantSelector>`. Chọn variant → cập nhật **giá + tình trạng
  còn hàng realtime**. Variant hết hàng → swatch mờ/gạch + nhãn "hết hàng" (disabled).
- **CTA phân nhánh**: sản phẩm thường → "Thêm vào giỏ"; sản phẩm tuỳ chỉnh →
  "Bắt đầu thiết kế" (sang module 12).
- `Unpublished` + khách có link → trang "sản phẩm không còn khả dụng" + gợi ý tương tự.

## Module 14 — Cart & Checkout (§5.4)

Wizard `<CheckoutStepper>`: Cart → Voucher → Ước tính ship/thuế → Thông tin & địa chỉ →
Phương thức vận chuyển → Chốt tổng → Giữ hàng & chọn thanh toán.

`<OrderTotals>` minh bạch: subtotal + ship + thuế − giảm giá = tổng.

**Edge case bắt buộc xử lý:**

- Dòng hết tồn → **chặn checkout**, cho giảm SL/xoá/đổi variant.
- Giá đổi giữa giỏ ↔ checkout → yêu cầu xác nhận giá mới.
- Voucher hết lượt → bỏ + tính lại.
- Sale giảm vượt hạn mức → đơn treo "chờ duyệt ưu đãi".

## Module 15 — Payment (§5.5)

- `<PaymentMethodSelector>` radio-card có logo (gateway/ví/thẻ/chuyển khoản/COD/đặt cọc).
- Chuyển khoản thủ công → panel thông tin tài khoản + nội dung = mã đơn + **nút copy**,
  trạng thái `Awaiting Confirmation`.
- **KHÔNG lưu dữ liệu thẻ (PCI-DSS)** — chỉ hiện 4 số cuối + thương hiệu thẻ.

## Module 16 — Sales Chat (§5.6)

- `<ChatBubble>` 2 phía, avatar, timestamp.
- **Internal note** (chỉ Sale thấy) → tách biệt rõ (nền vàng nhạt + icon "internal"),
  **không render phía khách**. Làm sai chỗ này là rò rỉ dữ liệu nội bộ cho khách.
- SLA indicator: quá hạn → badge đỏ/amber + sort lên đầu hàng đợi.
- Offline/ngoài giờ → thời gian phản hồi dự kiến + form thu email.

## Module 17/18 — Order & Customer (§5.7)

**Order amendment gating** — theo trạng thái:

| Trạng thái                     | Được sửa gì                                              |
| ------------------------------ | -------------------------------------------------------- |
| `Pending Payment`              | sửa tự do                                                |
| `Confirmed` / `In Production`  | đổi địa chỉ/SL kèm thu thêm/hoàn bớt (khi chưa in)       |
| `Ready to Fulfill` / `Picking` | hạn chế                                                  |
| `Packed` / `Shipped`           | **disable sửa nội dung**, chỉ qua carrier/luồng trả hàng |

Nút "Huỷ" **disable sau `Shipped`**.

Module 18: sổ địa chỉ **VN 3 cấp tỉnh/huyện/xã** (cascading select); email là khoá định danh;
saved payment chỉ brand+last4; consent marketing lưu mốc thời gian;
privacy actions (xuất/sửa/xoá dữ liệu).

## Chung

- Trạng thái vẫn qua `<StatusBadge domain status>` — semantic token dùng chung hai mode.
- Giá tiền qua `lib/format/money.ts`, không tự `toLocaleString` rải rác.
- 3D (`three`/`@react-three/fiber`) và canvas (`konva`/`fabric`) phải **lazy load**
  qua `next/dynamic`, luôn có fallback.
- Motion mode B: **200–320ms** — reveal sản phẩm, transition giữa bước checkout,
  hover card nâng nhẹ. Luôn `useReducedMotion()`.
