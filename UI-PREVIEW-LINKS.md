# StockFlow UI Preview & Delivery Directory (Production Print & Packaging)

> **Antigravity FE Lead Delivery — Reconciled Release**  
> **Date:** 10/10/2026 13:15 (GMT+7)  
> **Server Status:** Next.js 16.3.4 running on `http://localhost:3100` (PID active background daemon)  
> **Base Branch:** `origin/develop` (Commit `69733fa` preserved untouched)  
> **Integration Branch:** `VoHMinh/integration-lead`  
> **Physical Path:** `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\integration-lead`  
> **Preserved System:** Port 3000 (PID 47676) được bảo vệ nguyên vẹn.  
> **Chất lượng kiểm chuẩn:** 65 test files, 512 tests passed, 0 typecheck errors, 0 lint warnings, Next.js build 31 routes pass.

---

## 1. Quick Navigation (Live Clickable URLs on Port 3100)

| Nhóm Màn Hình                             | Direct Clickable URL                                                                                       | Nhiệm Vụ Jira [FE] Phụ Trách                                                       |    Trạng Thái Tổng Thể     |
| :---------------------------------------- | :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :------------------------: |
| **Preview Hub**                           | [http://localhost:3100/ui-preview](http://localhost:3100/ui-preview)                                       | Toàn bộ 20 tasks (12 Batch 1 + 8 Batch 2)                                          |         **ACTIVE**         |
| **Group A: Yêu Cầu Mẫu & Nền Tảng LSX**   | [http://localhost:3100/ui-preview/samples-production](http://localhost:3100/ui-preview/samples-production) | SCRUM-404, SCRUM-406, SCRUM-408, SCRUM-414                                         |        **VERIFIED**        |
| **Group B: Vận Hành Xưởng & In Ấn**       | [http://localhost:3100/ui-preview/workshop](http://localhost:3100/ui-preview/workshop)                     | SCRUM-410, SCRUM-416, SCRUM-417, SCRUM-419, SCRUM-412                              |        **VERIFIED**        |
| **Group C: Gia Công Ngoài (Subcontract)** | [http://localhost:3100/ui-preview/subcontract](http://localhost:3100/ui-preview/subcontract)               | SCRUM-442 (Split dialog, send-out, tracking)                                       |        **VERIFIED**        |
| **Group D: B2B Commerce & Báo Giá Bậc**   | [http://localhost:3100/ui-preview/b2b](http://localhost:3100/ui-preview/b2b)                               | SCRUM-449, SCRUM-451                                                               |        **VERIFIED**        |
| **Group E: Gói Mở Rộng Batch 2**          | [http://localhost:3100/ui-preview/batch2](http://localhost:3100/ui-preview/batch2)                         | SCRUM-248, 212, 257, 258, 304, 320 (Verified); SCRUM-299, 300 (Chờ chốt nghiệp vụ) | **6 VERIFIED / 2 PENDING** |

---

## 2. Direct Deep-Links to Every Specific Component View

### Group A: Samples & Production Orders

- **SCRUM-404 (Yêu cầu mẫu & Khách duyệt mẫu portal):**  
  [http://localhost:3100/ui-preview/samples-production?tab=samples](http://localhost:3100/ui-preview/samples-production?tab=samples)
- **SCRUM-406 (Danh sách LSX phân trang & Bộ lọc Hạn giao Due-Date):**  
  [http://localhost:3100/ui-preview/samples-production?tab=production-orders](http://localhost:3100/ui-preview/samples-production?tab=production-orders)
- **SCRUM-408 & 414 (Chi tiết LSX, Prepress Artifacts, Hủy & Tạm dừng có lý do):**  
  [http://localhost:3100/ui-preview/samples-production?tab=production-detail](http://localhost:3100/ui-preview/samples-production?tab=production-detail)

### Group B: Workshop Floor & QC

- **SCRUM-416 (Dashboard xưởng in phân quyền 4 vai trò):**  
  [http://localhost:3100/ui-preview/workshop?tab=dashboard](http://localhost:3100/ui-preview/workshop?tab=dashboard)
- **SCRUM-410 (Bàn quét mã vạch phôi Exact Registry & Chống xuất vượt):**  
  [http://localhost:3100/ui-preview/workshop?tab=scan](http://localhost:3100/ui-preview/workshop?tab=scan)
- **SCRUM-417 (Bảng Kanban xưởng in & Ghi nhận phế phẩm):**  
  [http://localhost:3100/ui-preview/workshop?tab=kanban](http://localhost:3100/ui-preview/workshop?tab=kanban)
- **SCRUM-419 (Trạm QC đối chiếu mẫu duyệt Side-by-Side BR-PRD-04):**  
  [http://localhost:3100/ui-preview/workshop?tab=qc](http://localhost:3100/ui-preview/workshop?tab=qc)
- **SCRUM-412 (Bàn giao LSX hoàn thành sang đóng gói PACKING):**  
  [http://localhost:3100/ui-preview/workshop?tab=handoff](http://localhost:3100/ui-preview/workshop?tab=handoff)

### Group C: Subcontracting

- **SCRUM-442 (Cây phả hệ LSX cha - con & Tách công đoạn gia công):**  
  [http://localhost:3100/ui-preview/subcontract?tab=parent-child](http://localhost:3100/ui-preview/subcontract?tab=parent-child)
- **SCRUM-442 (Xuất phôi gia công & In Dispatch Note Odoo):**  
  [http://localhost:3100/ui-preview/subcontract?tab=send-out](http://localhost:3100/ui-preview/subcontract?tab=send-out)
- **SCRUM-442 (Theo dõi nhận lại hàng gia công & Kiểm soát hao hụt):**  
  [http://localhost:3100/ui-preview/subcontract?tab=returns](http://localhost:3100/ui-preview/subcontract?tab=returns)

### Group D: B2B Commerce & Quotes

- **SCRUM-449 (Báo giá B2B bậc thang & Quản lý hợp đồng in):**  
  [http://localhost:3100/ui-preview/b2b?tab=quotes](http://localhost:3100/ui-preview/b2b?tab=quotes)
- **SCRUM-449 (Portal B2B duyệt báo giá kèm Guard BR-PRD-08):**  
  [http://localhost:3100/ui-preview/b2b?tab=quote-portal](http://localhost:3100/ui-preview/b2b?tab=quote-portal)
- **SCRUM-451 (Onboarding khách hàng B2B):**  
  [http://localhost:3100/ui-preview/b2b?tab=customers](http://localhost:3100/ui-preview/b2b?tab=customers)
- **SCRUM-451 (Trang kích hoạt tài khoản đối tác B2B qua Token):**  
  [http://localhost:3100/ui-preview/b2b?tab=activation](http://localhost:3100/ui-preview/b2b?tab=activation)

### Group E: Batch 2 Deliverables

- **SCRUM-248 (Sales Order Lifecycle Timeline):**  
  [http://localhost:3100/ui-preview/batch2?tab=timeline](http://localhost:3100/ui-preview/batch2?tab=timeline)
- **SCRUM-212 (Storefront Stock Reservation 15-min Countdown & Release):**  
  [http://localhost:3100/ui-preview/batch2?tab=checkout](http://localhost:3100/ui-preview/batch2?tab=checkout)
- **SCRUM-257 (Customer RMA Request Portal kèm ảnh bằng chứng):**  
  [http://localhost:3100/ui-preview/batch2?tab=rma-customer](http://localhost:3100/ui-preview/batch2?tab=rma-customer)
- **SCRUM-258 (Backoffice RMA Approval Queue & Cấp mã thu hồi):**  
  [http://localhost:3100/ui-preview/batch2?tab=rma-admin](http://localhost:3100/ui-preview/batch2?tab=rma-admin)
- **SCRUM-304 (Live Customization Price Calculator Engine):**  
  [http://localhost:3100/ui-preview/batch2?tab=pricing](http://localhost:3100/ui-preview/batch2?tab=pricing)
- **SCRUM-299 & SCRUM-300 (Packaging 2D Die-Cut Canvas vs Furniture Jira — Nguyên mẫu demo):**  
  [http://localhost:3100/ui-preview/batch2?tab=designer](http://localhost:3100/ui-preview/batch2?tab=designer)  
  _(Lưu ý: Đang ở trạng thái Nguyên mẫu chờ người dùng/PO phê duyệt chính thức thay thế)_
- **SCRUM-320 (Storefront Floating Live Chat Widget):**  
  [http://localhost:3100/ui-preview/batch2?tab=chat](http://localhost:3100/ui-preview/batch2?tab=chat)

---

## 3. Hướng Dẫn Vận Hành Môi Trường Preview

1. **Trạng thái máy chủ preview:**
   - Server Next.js preview đang hoạt động tại cổng `http://localhost:3100`.
   - Lệnh khởi động độc lập: `pnpm exec next dev -p 3100 -H localhost`.
   - Cổng 3000 được bảo toàn nguyên vẹn.
2. **Quyền truy cập không cần login:**
   - Toàn bộ các route tại `/ui-preview/*` đều cho phép xem và thao tác trực tiếp trên trình duyệt mà không cần tài khoản đăng nhập hay kết nối backend thật (`NEXT_PUBLIC_USE_MOCK=true`).
   - Có cơ chế guard bảo vệ tự động trả về 404 nếu build ở môi trường `NODE_ENV === "production"`.
