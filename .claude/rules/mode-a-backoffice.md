---
description: Mode A (Back-office, module 01-11) — theme Ink+Blue, data-dense, desktop-first
globs:
  - "src/app/admin/**"
  - "src/app/(backoffice)/**"
  - "src/components/backoffice/**"
  - "src/features/{product,purchase-order,receipt,invoice,putaway,warehouse-map,picking,packing,shipping,transfer,move,inventory,dashboard}/**"
---

# Mode A — Back-office (Kho vận)

Nguồn: `src/_design/FRONTEND-AI-RULES.md` §2, §4. Module docs 01–11 + inventory + dashboard.

**Tinh thần:** công cụ làm việc, không phải SaaS landing. Lạnh, nghiêm túc, dày đặc dữ liệu.
Người dùng là nhân viên kho ngồi cả ca — ưu tiên tốc độ thao tác hơn khoảng trắng đẹp.

## Token của mode này

| Token         | Giá trị                          | Dùng cho                                    |
| ------------- | -------------------------------- | ------------------------------------------- |
| `brand.ink`   | `#1A1B18`                        | CTA back-office (nút chính, tương phản cao) |
| `accent.blue` | `#1E88E5` light · `#4EA6F0` dark | tiến trình, thông tin, link phụ             |

**CẤM caramel** (`#A9682F`, `#C98D4E`, `bg.warm`, `card.warm`, `ink.warm`, `line.warm`)
lọt vào mode A. Đó là token của [mode B](mode-b-storefront.md).

Mode A dùng `brand.ink` cho CTA, active tab underline/text/count badge và focus border/ring của mọi input/select/textarea. `accent.blue` chỉ dùng cho icon thông tin, progress, link phụ hoặc trạng thái info; không dùng làm focus chính.

## Density

- Card padding: `space.lg` (16px)
- Gap giữa phần tử: `space.sm` (8px)
- Row bảng: `space.xs`–`space.sm` (4–8px)
- Radius: `radius.sm` (4px) cho nút, ô nhập, badge, card
- Elevation: **ưu tiên viền hơn bóng**. `shadow.none` cho phần lớn bề mặt, `shadow.sm`
  cho card và dropdown. Dùng `border.default` để tách lớp — cảm giác công cụ, không phải card mềm.

## Responsive

Desktop-first, tối thiểu **≥1024px**. Không cần tối ưu 320px cho mode A.

## Bảng dữ liệu — màn hình chính của mode A

Pattern đầy đủ nằm ở [data-table-mode-a.md](data-table-mode-a.md) (PageHeader, toolbar,
config summary, column filter, footer pagination). Đọc file đó khi làm trang danh sách.

Tóm tắt: sticky header · cột số canh phải + `tabular-nums` · cột mã dùng mono ·
trạng thái qua `<StatusBadge>` · > 500 dòng thì virtual.
State lưu ở đâu → [state-persistence.md](state-persistence.md).

## Thao tác (operation-friendly — §4.3)

Người dùng là nhân viên kho, tay bận, đeo găng, dùng máy quét. Ưu tiên **không cần chuột**:

- Tự focus ô input đầu tiên khi mở form/dialog. `Enter` submit, `Esc` đóng.
- Điều hướng bảng bằng phím mũi tên; focus-visible rõ ràng.
- **Màn quét** (module 03/05/07/08/10/11): ô barcode nổi bật, **luôn focus**,
  feedback tức thì (âm thanh/flash màu) khi quét đúng/sai. Dùng `use-scan-input`.
- **Nút hành động chính** ("Lấy hàng", "Đóng gói", "Nhận hàng", "Xác nhận"): tương phản cao,
  đặt góc phải-trên vùng nội dung hoặc cuối form, nhãn là **động từ** rõ ràng.
- **Override luôn cần lý do**: ghi đè gợi ý (slotting, vị trí putaway) → bắt buộc chọn
  **reason code** qua `<ReasonCodePicker>` trước khi cho lưu.

### Action-gating — cực kỳ quan trọng

Đọc bảng "Chuyển tiếp cho phép" của module → nút chỉ `enable` khi trạng thái cho phép.

| Trạng thái PO                                      | Nút được phép                                |
| -------------------------------------------------- | -------------------------------------------- |
| `Draft`                                            | Submit, Cancel                               |
| `Pending Approval`                                 | Approve, Reject — **chỉ role Approver**      |
| sau `Confirmed`                                    | khoá sửa nội dung, thay bằng Create Revision |
| terminal (`Closed`/`Cancelled`/`Paid`/`Completed`) | **ẩn mọi nút mutating**                      |

Gate qua `allowedActions(status, role)`, không rải `if/else` trong JSX.
Xem [feature-architecture.md](feature-architecture.md).

### Validate realtime

Báo lỗi inline ngay ô nhập, disable submit tới khi hợp lệ:
SL nhận ≤ SL đặt×(1+dung sai) · SL lấy ≤ phân bổ · kiểm đơn 100% ·
kho nguồn ≠ kho đích · hạn dùng > ngày nhận · unique SKU/số hoá đơn.

## Màn hình đặc thù cần component riêng (§4.4)

| Module | Component                  | Lưu ý                                                                                                                                    |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 06     | `<WarehouseMap>` 2D/3D     | Kho→Zone→Aisle→Rack→Level→Bin, heatmap độ lấp đầy. **BR: map 3D KHÔNG phải nguồn sự thật tồn** → luôn kèm nhãn "chỉ mang tính trực quan" |
| 05, 06 | `<SlottingSuggestionList>` | list ranked + điểm số + lý do ("gần dock, cùng SKU, còn 60% chỗ"), nút accept #1 / chọn khác / override + reason                         |
| 04     | `<MatchDiffView>`          | three-way PO ↔ Receipt ↔ Invoice theo dòng, highlight variance (qty/price/tax) bằng màu                                                  |
| 07     | `<PickList>`               | danh sách lấy hàng theo lộ trình tối ưu                                                                                                  |
| 09     | `<TimelineEvents>`         | dòng thời gian trạng thái vận đơn                                                                                                        |
| 06     | KPI dashboard              | utilization %, honeycombing, số vị trí quá tải                                                                                           |
| 01     | `<VariantMatrix>`          | lưới SKU sinh từ Size × Color, form nhiều bước                                                                                           |

## Motion

Mode A: **120–180ms**, tối giản — fade/slide nhỏ cho dropdown, row xuất hiện.
Tránh fade-and-slide-up đồng loạt mọi section (trông AI-generated). Luôn `useReducedMotion()`.

## shadcn-first (§4.1.1)

Ưu tiên component shadcn có sẵn trong `components/ui/`. Cần biến thể → wrapper trong
`components/shared/` hoặc cva variant. **Không sửa tay `components/ui/*`** — hook
`guard-protected-files.mjs` sẽ chặn.
