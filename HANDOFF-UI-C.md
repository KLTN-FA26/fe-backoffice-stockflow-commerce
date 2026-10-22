# Bàn giao Giao diện Nhóm C: Quản lý Gia công ngoài (Worker C)

- **Nhóm phụ trách:** Worker C
- **Cổng xem trước (Dev Port):** `:3103` (hoặc tích hợp `:3100`)
- **Tập tin sở hữu:** `src/features/ui-subcontract/**` & `src/app/ui-preview/subcontract/**`
- **Mã nguồn cơ sở:** `develop` (commit `69733fa`)

---

## 1. Bảng đối chiếu Task Jira & Màn hình hoàn thành

| Mã Jira | Phân hệ / Nghiệp vụ | Tên màn hình / Trạng thái tương tác | Đường dẫn Preview nội bộ |
|---|---|---|---|
| **SCRUM-442** | Tách LSX gia công | Hộp thoại Tách LSX (Split Dialog): nhập số lượng gia công, chọn NCC đối tác, chọn chế độ (Trọn gói vs Chỉ in), nhập đơn giá, kiểm tra hạn giao (không được trễ hơn đơn cha) | `/ui-preview/subcontract` (Tab: Cây Cha — Con & Tách Lệnh) |
| **SCRUM-442 (Cây)** | Phân cấp Cha — Con | Giao diện hiển thị phân cấp Lệnh sản xuất cha, số lượng giữ lại sản xuất nội bộ vs số lượng ủy thác gia công, danh sách các lệnh con `SCO-2026-xxxx`, huy hiệu `SUBCONTRACTED` | `/ui-preview/subcontract` (Tab: Cây Cha — Con & Tách Lệnh) |
| **SCRUM-442 (Phiếu)** | Xuất phôi & Phiếu giao hàng | Màn hình xuất phôi và tạo Phiếu xuất kho gia công ngoài (Dispatch Note) chuẩn in ấn (`window.print()`), đầy đủ thông tin tài xế, số xe, bảng hàng hóa, 4 khối chữ ký | `/ui-preview/subcontract` (Tab: Xuất Phôi & Phiếu Giao Hàng) |
| **SCRUM-442 (Trả)** | Theo dõi nhận lại & QC | Màn hình theo dõi các đợt nhận hàng từ xưởng gia công, thanh tiến độ %, biên bản ghi nhận số lượng đạt chuẩn QC vs phế phẩm hao hụt trừ công nợ | `/ui-preview/subcontract` (Tab: Theo Dõi Nhận Lại & QC) |

---

## 2. Quy tắc nghiệp vụ (Business Rules) đã mã hóa

1. **BR-PRD-11..16 (Subcontract guards):**
   - Số lượng ủy thác gia công không được vượt quá số lượng nội bộ khả dụng của lệnh cha.
   - Hạn giao của xưởng gia công bắt buộc phải trước hoặc bằng hạn giao của đơn hàng cha.
   - Khi tách lệnh, trạng thái của lệnh sản xuất cha được gắn nhãn `SUBCONTRACTED`.
2. **Dispatch Note Compliance:** Phiếu xuất kho chứa mã phiếu truy vết, căn cứ đơn cha, phân định rõ hình thức gia công (Trọn gói tự mua phôi hay Kho StockFlow cấp phôi).
3. **Partial & Completed Returns:** Theo dõi tiến độ hoàn trả lũy kế nhiều đợt; chuyển trạng thái `RECEIVED_PARTIAL` hoặc `RECEIVED_COMPLETED`.

---

## 3. Kết quả kiểm tra & Độ ổn định

- **TypeScript Strict:** `tsc --noEmit` đạt 0 lỗi (Exit code 0).
- **In ấn thực tế:** Hỗ trợ xem trước và in trực tiếp Phiếu xuất kho theo chuẩn biểu mẫu kế toán & kho vận.

---

## 4. Danh sách API Backend cần tích hợp trong tương lai (Contract TODOs)

- `GET /api/v1/subcontract/partners`: Danh sách đối tác xưởng gia công phụ trợ.
- `POST /api/v1/production-orders/{id}/split-subcontract`: Tách lệnh cha tạo lệnh gia công con.
- `POST /api/v1/subcontract-orders/{id}/dispatch`: Xuất phôi và sinh mã phiếu xuất kho `PXK-GC`.
- `POST /api/v1/subcontract-orders/{id}/return`: Ghi nhận nhận hàng và kết quả QC thành phẩm gia công.
- `GET /api/v1/subcontract-orders`: Danh sách và trạng thái các đơn ủy thác gia công.
