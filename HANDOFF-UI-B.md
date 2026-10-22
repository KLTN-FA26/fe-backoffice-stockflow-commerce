# Bàn giao Giao diện Nhóm B: Vận hành Xưởng in, QC & Bàn giao (Worker B)

- **Nhóm phụ trách:** Worker B
- **Cổng xem trước (Dev Port):** `:3102` (hoặc tích hợp `:3100`)
- **Tập tin sở hữu:** `src/features/ui-workshop/**` & `src/app/ui-preview/workshop/**`
- **Mã nguồn cơ sở:** `develop` (commit `69733fa`)

---

## 1. Bảng đối chiếu Task Jira & Màn hình hoàn thành

| Mã Jira | Phân hệ / Nghiệp vụ | Tên màn hình / Trạng thái tương tác | Đường dẫn Preview nội bộ |
|---|---|---|---|
| **SCRUM-410** | Quét xuất phôi sản xuất | Bàn quét mã vạch xuất phôi kho (Warehouse Staff scan phôi, chống xuất vượt định mức BR-PRD-03, tự động chuyển `Ready → Material Issued` khi quét đủ) | `/ui-preview/workshop` (Tab: Quét Xuất Phôi) |
| **SCRUM-417** | Kanban xưởng & In ấn | Bảng Kanban theo trạng thái (`Ready`, `Material Issued`, `Printing`, `QC`), thao tác lên máy in, ghi nhận sản lượng tốt & phế phẩm bắt buộc có lý do (BR-PRD-04) | `/ui-preview/workshop` (Tab: Kanban Xưởng) |
| **SCRUM-419** | Trạm QC đối chiếu mẫu duyệt | Màn hình QC đối chiếu trực quan song song (Side-by-side): Mẫu đã duyệt khóa kỹ thuật (Locked Reference Sample) vs Thành phẩm in thực tế; ghi nhận Pass/Fail; đủ chuyển Completed; thiếu kích hoạt vòng in bù (Reprint Loop) | `/ui-preview/workshop` (Tab: Trạm QC Đối Chiếu) |
| **SCRUM-412** | Danh sách hoàn thành & Bàn giao | Danh sách LSX hoàn thành; hộp thoại xác nhận bàn giao thành phẩm sang khu vực Đóng gói (`PACKING`), ghi nhận người bàn giao và ghi chú (BR-PRD-06) | `/ui-preview/workshop` (Tab: Bàn Giao Đóng Gói) |
| **SCRUM-416** | Dashboard & Phân quyền xưởng | Bảng chỉ số vận hành xưởng (Active LSX, Overdue count, Scrap rate %, Mẫu chờ duyệt); Bộ mô phỏng phân quyền menu theo vai trò (Production Staff, QC Staff, Warehouse Staff, Manager) | `/ui-preview/workshop` (Tab: Tổng quan & Quyền) |

---

## 2. Quy tắc nghiệp vụ (Business Rules) đã mã hóa

1. **BR-PRD-03 (Chống xuất phôi vượt định mức):** Kiểm tra chặn ngay trên form quét nếu số lượng phôi quét vượt quá số lượng kế hoạch còn thiếu của LSX.
2. **BR-PRD-04 (Hạch toán phế phẩm minh bạch):** Tổng số in = Đạt + Phế. Bắt buộc nhập lý do lỗi cụ thể cho phế phẩm để tạo giao dịch điều chỉnh kho (Reasoned Inventory Adjustment).
3. **BR-PRD-05 (Đối chiếu chuẩn mẫu duyệt):** QC bắt buộc đối chiếu trực tiếp với bản mẫu đã được khách hàng phê duyệt (Ref Sample) để đảm bảo tính nhất quán của lô hàng.
4. **BR-PRD-06 (Bàn giao hoàn thành):** Chuyển hàng sang phân vùng `PACKING` và kích hoạt sự kiện `ProductionCompleted`.
5. **Reprint Loop:** Trường hợp số lượng đạt QC chưa đủ định mức đơn hàng, hệ thống tự động tăng `reprintRound` và trả LSX về trạng thái `Ready` để xuất thêm phôi in bù.

---

## 3. Kết quả kiểm tra & Độ ổn định

- **TypeScript Strict:** `tsc --noEmit` đạt 0 lỗi (Exit code 0).
- **Phản hồi tương tác:** Mô phỏng quét mã vạch trực quan, kéo chuyển trạng thái qua nút hành động, side-by-side snapshot comparison mượt mà.

---

## 4. Danh sách API Backend cần tích hợp trong tương lai (Contract TODOs)

- `POST /api/v1/production-orders/{id}/issue-blanks`: Quét và xuất kho phôi sang khu vực sản xuất.
- `POST /api/v1/production-orders/{id}/start-print`: Gán máy in và chuyển sang `Printing`.
- `POST /api/v1/production-orders/{id}/record-output`: Ghi nhận sản lượng in và lý do phế phẩm.
- `POST /api/v1/production-orders/{id}/qc-result`: Ghi nhận kết quả QC và kích hoạt in bù nếu thiếu.
- `POST /api/v1/production-orders/{id}/complete-handoff`: Bàn giao thành phẩm sang khu vực PACKING.
- `GET /api/v1/workshop/dashboard`: Lấy các chỉ số KPI vận hành xưởng.
