---
name: status-badge
description: Use when adding a new status value, wiring a status into UI, or debugging wrong badge colors in StockFlow — covers the status-map tone priority, Vietnamese labels, and why StatusBadge must never be edited.
---

# StatusBadge & status-map

`<StatusBadge>` là component quan trọng nhất của dự án — một component duy nhất xử lý
**101 trạng thái** trên 26 domain union.

## Quy tắc số một

Thêm trạng thái mới → **chỉ sửa `src/lib/status-map.ts`**.
KHÔNG sửa `src/components/shared/StatusBadge.tsx`.

Component đã generic hoàn toàn: nó tra tone từ map rồi render. Sửa component để xử lý
một trạng thái cá biệt là phá vỡ thiết kế đó.

## Hai file status-map — đừng nhầm

| File                           | Vai trò                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `src/lib/status-map.ts`        | **File canonical.** Chứa `TONE`, `toneOf()`, `STATUS_LABEL_VI`. Sửa ở đây. |
| `src/lib/domain/status-map.ts` | Chỉ re-export. Code mới nên import từ đường dẫn này.                       |

## Cách dùng

```tsx
<StatusBadge domain="order" status="Pending Payment" />
<StatusBadge domain="po" status="Confirmed" size="sm" />
<StatusBadge domain="inventory" status="Quarantine" withIcon />
```

Props: `domain` (StatusDomain), `status` (string), `size` `"sm"|"md"` (mặc định `sm`),
`withIcon` (chấm tròn), `className`.

Lưu ý: `domain` hiện chưa dùng để tra tone (`toneOf` chỉ nhận `status`), nhưng vẫn phải
truyền đúng — nó là phần hợp đồng API và sẽ cần khi có trạng thái trùng tên khác domain.

## Thêm một trạng thái mới — 3 bước

**1. Lấy tên nguyên văn từ docs.** Mở module tương ứng trong `D:\FPTU\Capstone\docs\docs\`,
bảng "Trạng thái / Vòng đời". Chép **chính xác** chuỗi tiếng Anh — không dịch, không đổi
hoa thường, không bỏ dấu cách. `"Pending Approval"` chứ không phải `"PendingApproval"`.

**2. Thêm vào đúng nhóm tone trong `TONE`** (`src/lib/status-map.ts`):

```ts
const TONE: Record<SemanticTone, readonly string[]> = {
  positive: [..., "Trạng thái mới"],
  // ...
};
```

**3. Thêm nhãn tiếng Việt vào `STATUS_LABEL_VI`:**

```ts
"Trạng thái mới": "Nhãn tiếng Việt",
```

Badge hiển thị nhãn Việt, `title` tooltip hiện `"Nhãn Việt — English Original"` để người
dùng đối chiếu được với docs và với backend.

## Chọn tone nào — thứ tự ưu tiên

Khi một trạng thái có vẻ hợp nhiều tone, áp dụng thứ tự:

```
special > danger > positive > warning > info > muted > neutral
```

| Tone       | Ý nghĩa                                                          | Ví dụ                                            |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| `special`  | hoàn tiền, sản xuất/in — tách khỏi positive/info để dễ phân biệt | Refunded, Partially Refunded, In Production      |
| `danger`   | lỗi, huỷ, hết hàng, thất bại                                     | Cancelled, Rejected, Failed, Out of stock        |
| `positive` | thành công, hoàn tất, còn hàng                                   | Confirmed, Approved, Completed, Delivered        |
| `warning`  | cảnh báo, chờ, sắp hết                                           | Pending Approval, On Hold, Quarantine, Low stock |
| `info`     | đang tiến hành, thông tin                                        | In Progress, In Transit, Shipped                 |
| `muted`    | đã đóng, terminal, ẩn                                            | Closed, Inactive, Archived, Voided               |
| `neutral`  | nháp, trung tính                                                 | Draft, Created, Pending, New                     |

Phân biệt hay nhầm: `Closed` là `muted` (kết thúc bình thường) còn `Cancelled` là `danger`
(kết thúc bất thường). `Pending` là `neutral` nhưng `Pending Approval` là `warning` — vì
nó đang chặn một luồng công việc, cần người xử lý.

## Debug badge sai màu

1. Trạng thái có trong `TONE` không? Không có → `toneOf()` trả về fallback.
2. Chuỗi khớp **chính xác** chưa? Sai hoa thường hoặc thừa dấu cách là không khớp.
3. Trạng thái có bị liệt kê ở **hai** nhóm tone không? Nhóm đầu tiên thắng — xoá bản trùng.
4. Màu render từ CSS var (`--positive`, `--danger`…) qua `color-mix`. Var chưa định nghĩa
   trong `globals.css` → badge mất màu.

## Cấm

- Tự tô màu trạng thái bằng `bg-green-100 text-green-700` thay vì dùng StatusBadge.
- Viết badge riêng cho một module.
- Dịch tên trạng thái trong code hoặc trong docs-facing text — nhãn Việt chỉ sống ở
  `STATUS_LABEL_VI`, chuỗi gốc luôn là tiếng Anh theo docs.
