# StockFlow UI — Design Decisions & Token Architecture

**Tài liệu quyết định thiết kế & Hệ thống Token Chuẩn hóa (Mode A Backoffice & Mode B Storefront)**  
_Căn cứ_: `ANTIGRAVITY-UI-REALISM-POLISH.md`, Vercel Web Interface Guidelines, Anthropic Frontend Design Guide, Carbon Design System Data Table, Odoo 19 MRP/Shopfloor/Subcontracting Standards.

---

## 1. Triết lý thiết kế & Định vị sản phẩm (Design Principles)

1. **Ứng dụng Vận hành Công nghiệp (Industrial Operations SaaS)**:
   - Đối tượng sử dụng: Quản lý sản xuất, thủ kho, thợ in ấn, kiểm tra chất lượng (QC), chuyên viên kinh doanh B2B, quản lý đơn hàng.
   - Tránh xa các mẫu thiết kế "AI-generated cliché": Không dùng background kem nhạt tùy tiện, không bo góc tròn quá đà (chỉ dùng `r-sm: 4px` và `r-md: 8px` cho Mode A), không lạm dụng hiệu ứng đổ bóng mờ nhạt, gradient trang trí không mục đích, hay chữ in hoa toàn bộ (ALL-CAPS) cho tiêu đề.
   - Mật độ thông tin (Density): Mode A ưu tiên mật độ cao vừa phải, thông tin cô đọng, hiển thị rõ mã định danh (Code/SKU/Lô), đơn vị tính, số lượng chính xác với `tabular-nums`. Mode B (Storefront / Customer Portal) có độ thoáng rộng hơn, thân thiện với khách hàng.

2. **Quy tắc thực tế — Loại bỏ nghiệp vụ giả lập (Realism First)**:
   - Tuyệt đối loại bỏ `window.alert()`, `window.confirm()`, và `window.prompt()`. Thay thế bằng Modal / Dialog xác nhận chuẩn, inline validation lỗi đỏ ngay cạnh trường nhập, và phiếu in / xem trước trực quan (Printable preview sheet).
   - Mọi giả định demo (như thời gian giữ kho 15 phút, tỷ lệ đặt cọc, phí khuôn in, công thức tính giá) đều được gắn nhãn `Giả định Demo` rõ ràng, không tự ý tuyên bố là chính sách backend đã được phê duyệt.
   - Các tính năng còn tranh chấp phạm vi nghiệp vụ (SCRUM-299/300 giữa Bố cục phòng ốc nội thất trong Jira vs Bản vẽ khuôn bế bao bì 2D) được giữ nguyên mã nguồn dùng lại, nhưng gắn cờ trạng thái `CHỜ QUYẾT ĐỊNH NGHIỆP VỤ`.

3. **Tiêu chuẩn Trợ năng (Accessibility & WCAG 2.2 AA)**:
   - Tương phản màu sắc: Văn bản và biểu tượng đạt tối thiểu 4.5:1 với bề mặt nền.
   - Focus indicator: Mọi nút bấm, input, select, textarea đều có `focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-hidden`.
   - Tránh cạm bẫy chuột: Nút icon đơn lẻ luôn có `aria-label`. Biểu tượng trang trí có `aria-hidden="true"`.
   - Bàn phím: Hỗ trợ Tab, Shift-Tab, Enter gửi lệnh, Escape để đóng modal.

---

## 2. Hệ màu Semantic & Tokens (Color System)

| Token CSS          | Giá trị Mode A (Light) | Giá trị Mode A (Dark) | Ý nghĩa nghiệp vụ                                      |
| :----------------- | :--------------------- | :-------------------- | :----------------------------------------------------- |
| `--bg-base`        | `#f3f4f6`              | `#0e0f11`             | Nền trang tổng thể                                     |
| `--bg-surface`     | `#ffffff`              | `#17181b`             | Bề mặt thẻ, bảng, modal                                |
| `--bg-subtle`      | `#f7f8fa`              | `#1f2124`             | Hàng chẵn bảng, ô input, vùng phụ                      |
| `--bg-muted`       | `#eef0f3`              | `#2a2c30`             | Header bảng, thanh phân cách                           |
| `--border-default` | `#dadde1`              | `#2e3034`             | Viền ngăn cách card, hàng, input                       |
| `--border-strong`  | `#c5cad1`              | `#3d4045`             | Viền hover, viền tab được chọn                         |
| `--ink-primary`    | `#1a1b18`              | `#f2f3f0`             | Tiêu đề, dữ liệu quan trọng, số liệu                   |
| `--ink-secondary`  | `#5c5e58`              | `#a4a79f`             | Nhãn form, mô tả phụ, người thực hiện                  |
| `--ink-tertiary`   | `#8a8c85`              | `#70736c`             | Placeholder, thời gian phụ, icon mờ                    |
| `--brand`          | `#1a1b18`              | `#ffffff`             | Nút hành động chính Mode A (Đen mực)                   |
| `--brand-hover`    | `#000000`              | `#e5e7eb`             | Trạng thái hover của nút chính                         |
| `--accent`         | `#1e88e5`              | `#42a5f5`             | Focus ring, liên kết, tab active, trạng thái đang chọn |
| `--positive`       | `#1f9d55`              | `#22c55e`             | Thành công, đạt QC, hoàn thành, xuất kho đủ            |
| `--warning`        | `#d98207`              | `#f59e0b`             | Cảnh báo quá hạn, hold, sửa chữa, gần hết hàng         |
| `--danger`         | `#d23b3b`              | `#ef4444`             | Lỗi quét, phế phẩm, từ chối RMA, hủy lệnh              |
| `--info`           | `#2b7fc4`              | `#38bdf8`             | Thông tin hướng dẫn, liên kết xem tài liệu             |

### Phân biệt màu sắc trạng thái (Status Semantic Matrix):

- **ORDER CONFIRMED**: Không nhầm lẫn với xác nhận của NCC gia công. Dùng StatusBadge đồng bộ từ `@/constants/statuses`.
- **QC PASSED / FAILED**: Dùng biểu tượng kèm văn bản (`CheckCircle2` / `XCircle`), không bao giờ chỉ dựa vào màu sắc để truyền đạt kết quả kiểm tra.

---

## 3. Quy chuẩn Typography & Xử lý tiếng Việt (Vietnamese Typography)

- **Font Family**: Inter, Segoe UI, -apple-system, sans-serif.
- **Line-height cho tiếng Việt**: Văn bản có dấu tiếng Việt (mũ, móc, nặng, hỏi, ngã) dễ bị cắt chóp hoặc đè dòng nếu `line-height` quá thấp.
  - Tiêu đề: `leading-snug` (1.375) hoặc `leading-tight` (1.25) kèm khoảng đệm thích hợp.
  - Nội dung / Mô tả: `leading-relaxed` (1.625) hoặc `leading-normal` (1.5).
  - Nhãn bảng / Badge: `leading-none` với padding dọc `py-0.5` hoặc `py-1` để tránh lệch trục.
- **Tabular Numbers**: Mọi cột số lượng, đơn giá, mã số, ngày giờ, phần trăm đều áp dụng `font-mono` hoặc `tabular-nums` để số liệu căn thẳng hàng dọc, dễ đối chiếu.

---

## 4. Phân cấp Hành động (Action Hierarchy & Button Layout)

| Cấp bậc                   | Kiểu dáng                                                     | Ví dụ áp dụng                                                 | Quy tắc vị trí                                                                       |
| :------------------------ | :------------------------------------------------------------ | :------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| **Primary (Chính)**       | Nền `bg-[var(--brand)]`, chữ trắng/ngược, shadow nhẹ          | `Xác nhận quét mã`, `Phê duyệt & Cấp mã`, `Lưu & Chuyển bước` | Tối đa 1 hành động chính cho mỗi ngữ cảnh. Nằm ngoài cùng bên phải hoặc góc nổi bật. |
| **Secondary (Phụ)**       | Viền `border-[var(--border-default)]`, nền trong suốt/subtle  | `In nhãn thu hồi`, `Xuất file PDF/DXF`, `Gia hạn 15 phút`     | Đứng cạnh nút chính, nhấn mạnh ít hơn.                                               |
| **Destructive (Phá hủy)** | Nền `bg-rose-50`, viền `border-rose-300`, chữ `text-rose-700` | `Từ chối RMA`, `Hủy LSX`, `Giải phóng giữ kho`                | Tách biệt khỏi nút chính, bắt buộc mở Dialog xác nhận trước khi thực thi.            |
| **Tertiary / Ghost**      | Không viền, text `ink-secondary`, hover có nền                | `Đóng`, `Hủy bỏ`, `Quay lại`                                  | Bên trái footer modal hoặc nút x                                                     |

---

## 5. Chuẩn hóa Bảng Dữ liệu (Data Table Standards — Carbon Design System)

1. **Toolbar Tìm kiếm & Bộ lọc**:
   - Ô tìm kiếm linh hoạt với icon kính lúp, hỗ trợ tìm theo Mã, Khách hàng, Tên sản phẩm.
   - Bộ lọc trạng thái dạng Dropdown hoặc Tabs có đếm số lượng bản ghi `(N)`.
2. **Căn lề cột (Column Alignment)**:
   - Cột văn bản (Tên, Mã, Người thực hiện): Căn trái (`text-left`).
   - Cột trạng thái / Badge: Căn giữa hoặc trái theo độ rộng nhãn.
   - Cột số lượng, tiền tệ, ngày giờ: Căn phải (`text-right`) kèm `font-mono tabular-nums`.
3. **Trạng thái bảng (Table States)**:
   - _Bình thường_: Hiển thị danh sách có phân trang và hover từng hàng.
   - _Lọc không có kết quả (Filtered Empty)_: Nêu rõ "Không tìm thấy kết quả phù hợp điều kiện lọc" kèm nút "Đặt lại bộ lọc".
   - _Dữ liệu rỗng hoàn toàn (Empty State)_: Lời mời hành động rõ ràng (ví dụ "Chưa có lượt quét nào trong phiên").

---

## 6. Tiêu chuẩn Xử lý Form & Thông báo (Inline Validation & Modal Feedback)

1. **Thay thế Alert bằng Inline Feedback**:
   - Khi trường bắt buộc bị thiếu hoặc sai quy tắc (ví dụ: số lượng <= 0, mã vận đơn rỗng, lý do từ chối thiếu):
     - Hiển thị khối cảnh báo lỗi màu đỏ ngay dưới ô nhập liệu hoặc ngay trên thanh nút bấm.
     - Tự động di chuyển con trỏ focus (`input.focus()`) về trường gây lỗi.
2. **Phiếu in nhãn vận chuyển (RMA Shipping Label Sheet)**:
   - Khi bấm "In nhãn thu hồi", hiển thị modal Xem trước nhãn in vận chuyển chuẩn gồm:
     - Mã vạch Code 128 / QR thu hồi chứa mã `RMA-AUTH-xxxx`.
     - Địa chỉ người gửi (Khách hàng) và người nhận (Trung tâm xử lý đổi trả StockFlow).
     - Hướng dẫn đóng gói và thời hạn gửi hàng.
     - Nút "In nhãn thực tế" kích hoạt `window.print()` với media query `@media print`.

---

## 7. Trạng thái Quyết định Nghiệp vụ (Business Decision Traceability)

- **SCRUM-299 / SCRUM-300**: Giữ bản vẽ khuôn bế hộp giấy 2D phục vụ quy trình in ấn bao bì thực tế (phù hợp với toàn bộ hệ thống xưởng in offset/flexo của StockFlow), đồng thời ghi chú rõ ràng rằng mô tả Jira gốc đề cập đến "bố cục nội thất phòng ốc", đang chờ Product Owner / Giảng viên chốt định hướng cuối cùng.
- **TTL 15 phút (SCRUM-212)**: Được dán nhãn `Demo Assumption` (Thời gian cấu hình thử nghiệm, backend có thể tùy chỉnh theo từng chiến dịch bán lẻ).
- **Phí khuôn in & Đơn giá bậc (SCRUM-304 & SCRUM-449)**: Công thức áp dụng bảng giá định mức mẫu cho xưởng in bao bì công nghiệp (Offset 4 màu / Flexo 2 màu).
