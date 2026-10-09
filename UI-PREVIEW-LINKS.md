# StockFlow UI Preview & Delivery Directory (Batch 1 - 12 Tasks)

> **Antigravity FE Lead Delivery**  
> **Date:** 09/10/2026  
> **Server Status:** Next.js 16.3.4 (Turbopack) running on `http://localhost:3100`  
> **Base Branch:** `origin/develop` (Commit `69733fa`)  
> **Integration Branch:** `VoHMinh/integration-lead`  
> **Storage Path:** `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\integration-lead` (Preserving C: drive)  
> **Existing Process:** Port 3000 (PID 47676) untouched and running safely.

---

## 1. Quick Navigation (Live Clickable Links)

| Preview Module                      | Direct Clickable URL                                                                                       | Scope Tasks                   | Core Interactions                                                                                                                                                    |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preview Hub**                     | [http://localhost:3100/ui-preview](http://localhost:3100/ui-preview)                                       | All 12 Tasks                  | Central dashboard, task metrics, module routing                                                                                                                      |
| **Group A: Samples & Production**   | [http://localhost:3100/ui-preview/samples-production](http://localhost:3100/ui-preview/samples-production) | SCRUM-404, 406, 408, 414      | Lọc & tìm kiếm mẫu, Tạo phiếu may mẫu mới (modal), Drawer chi tiết duyệt mẫu & prepress file, Báo cáo Recharts lead-time & tỷ lệ duyệt                               |
| **Group B: Workshop Management**    | [http://localhost:3100/ui-preview/workshop](http://localhost:3100/ui-preview/workshop)                     | SCRUM-410, 417, 419, 412, 416 | Điều độ chuyền cắt/may/hoàn thiện, Cập nhật sản lượng may tốt/hỏng/làm lại, Cảnh báo tắc nghẽn & lỗi công đoạn, Cấp phát NPL BOM, Bàn giao BTP & nhập kho thành phẩm |
| **Group C: Subcontract Processing** | [http://localhost:3100/ui-preview/subcontract](http://localhost:3100/ui-preview/subcontract)               | SCRUM-442                     | Tách lô gia công cha-con, Chọn đối tác gia công, Phiếu xuất giao hàng, Theo dõi tiến độ trả hàng, Biên bản nghiệm thu & quyết toán chi phí                           |
| **Group D: B2B Commerce & Credit**  | [http://localhost:3100/ui-preview/b2b](http://localhost:3100/ui-preview/b2b)                               | SCRUM-449, 451                | Báo giá B2B nhiều bậc giá/MOQ, Quản lý phiên bản & gửi duyệt, Đơn hàng B2B, Kiểm tra hạn mức tín dụng / công nợ, Kích hoạt tài khoản & mời đối tác sỉ                |

---

## 2. Detailed Task Coverage Matrix (12 Jira Tasks)

### Nhóm A: Samples & Production Foundation (Port 3101)

- **Feature Directory:** `src/features/ui-samples-production/`
- **Route:** `src/app/ui-preview/samples-production/`
- **Link:** [http://localhost:3100/ui-preview/samples-production](http://localhost:3100/ui-preview/samples-production)

| Jira ID       | Tên công việc / Yêu cầu nghiệp vụ                             | Trạng thái UI & Tương tác Mock                                                                                                                                                                                                           |
| :------------ | :------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCRUM-404** | **Quản lý danh sách Phiếu may mẫu & Lệnh sản xuất mẫu**       | Bảng danh sách chuẩn Mode A với tìm kiếm theo mã phiếu/tên mẫu/khách hàng, bộ lọc trạng thái (DRAFT, IN_PROGRESS, APPROVED, REJECTED), phân trang, sắp xếp.                                                                              |
| **SCRUM-406** | **Modal / Form Tạo mới & Chỉnh sửa Phiếu may mẫu**            | Form tạo phiếu may mẫu với thông tin Tech Pack, BOM sơ bộ, bảng size (S/M/L/XL), định mức vải, ngày hẹn hoàn thành. Form validation đầy đủ theo chuẩn BR-SAMP-01 và BR-SAMP-02.                                                          |
| **SCRUM-408** | **Drawer Chi tiết Phiếu mẫu, Prepress files & Lịch sử duyệt** | Slide-over drawer chi tiết: File đính kèm kỹ thuật (PDF/AI/DXF), luồng chuyển trạng thái Odoo-style (`Tạo mẫu` → `Chờ duyệt Tech Pack` → `May mẫu` → `Fit Review` → `Duyệt/Từ chối`), nút Tạm dừng (Hold) / Tiếp tục (Resume) kèm lý do. |
| **SCRUM-414** | **Dashboard & Báo cáo Tỷ lệ duyệt mẫu & Lead-time may mẫu**   | 4 thẻ KPI động (Tổng phiếu, Tỷ lệ duyệt First-Fit %, Lead-time trung bình ngày, Phiếu đang may) + 2 biểu đồ Recharts (Xu hướng duyệt mẫu theo tháng & Tỷ lệ nguyên nhân từ chối mẫu).                                                    |

---

### Nhóm B: Workshop Operations & Quality (Port 3102)

- **Feature Directory:** `src/features/ui-workshop/`
- **Route:** `src/app/ui-preview/workshop/`
- **Link:** [http://localhost:3100/ui-preview/workshop](http://localhost:3100/ui-preview/workshop)

| Jira ID       | Tên công việc / Yêu cầu nghiệp vụ                            | Trạng thái UI & Tương tác Mock                                                                                                                                                      |
| :------------ | :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCRUM-410** | **Điều độ Phân xưởng & Kế hoạch sản xuất các Chuyền**        | Bảng điều độ chuyền (Chuyền Cắt, Chuyền May 1-3, Chuyền Hoàn thiện). Phân bổ lệnh sản xuất vào từng chuyền, hiển thị công suất ca/ngày và tiến độ thực tế so với mục tiêu.          |
| **SCRUM-417** | **Cập nhật tiến độ may & Sản lượng công đoạn theo Chuyền**   | Giao diện ghi nhận sản lượng realtime theo ca/chuyền: Nhập số lượng đạt (Good), số lượng hỏng (Scrap), số lượng sửa lại (Rework). Tự động cập nhật tổng lũy kế và tỷ lệ hoàn thành. |
| **SCRUM-419** | **Bảng Cảnh báo tắc nghẽn chuyền & Tỷ lệ lỗi công đoạn**     | Hệ thống cảnh báo tự động: phát hiện chuyền có tồn ứ WIP vượt ngưỡng an toàn, tỷ lệ lỗi may vượt định mức cảnh báo đỏ, gợi ý điều chuyển nhân công cân bằng chuyền.                 |
| **SCRUM-412** | **Phân bổ nguyên phụ liệu cho Phân xưởng (BOM Requisition)** | Quản lý phiếu xuất cấp phát nguyên phụ liệu (vải chính, vải lót, chỉ may, cúc, khóa kéo) từ kho tổng sang kho xưởng theo định mức BOM đơn hàng. Xác nhận xuất/nhận kho 2 bước.      |
| **SCRUM-416** | **Bàn giao bán thành phẩm & Nhập kho thành phẩm xưởng**      | Phiếu bàn giao BTP giữa các công đoạn (Cắt → May → Hoàn thiện) và biên bản kiểm đếm nhập kho thành phẩm may mặc. In phiếu bàn giao & tạo barcode lô hàng.                           |

---

### Nhóm C: Subcontract Processing & Settlement (Port 3103)

- **Feature Directory:** `src/features/ui-subcontract/`
- **Route:** `src/app/ui-preview/subcontract/`
- **Link:** [http://localhost:3100/ui-preview/subcontract](http://localhost:3100/ui-preview/subcontract)

| Jira ID       | Tên công việc / Yêu cầu nghiệp vụ                            | Trạng thái UI & Tương tác Mock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :------------ | :----------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SCRUM-442** | **Quản lý Đơn gia công ngoài & Quyết toán chi phí gia công** | Quy trình gia công ngoài trọn vẹn: <br>1. **Tách lô gia công:** Dialog chia nhỏ lệnh sản xuất gốc thành các lô gia công cha-con (in thêu, giặt wash, may gia công).<br>2. **Chọn đối tác & Lập phiếu xuất:** Chọn đơn vị gia công, đơn giá khoán, lập phiếu xuất bán thành phẩm + NPL đi kèm.<br>3. **Theo dõi trả hàng & Nghiệm thu:** Ghi nhận đợt hàng về, kiểm tra số lượng giao so với số lượng nhận, ghi nhận hao hụt.<br>4. **Quyết toán chi phí:** Tính tổng tiền gia công, khấu trừ hao hụt ngoài định mức, xuất biên bản quyết toán công nợ. |

---

### Nhóm D: B2B Quotations & Wholesale Credit (Port 3104)

- **Feature Directory:** `src/features/ui-b2b/`
- **Route:** `src/app/ui-preview/b2b/`
- **Link:** [http://localhost:3100/ui-preview/b2b](http://localhost:3100/ui-preview/b2b)

| Jira ID       | Tên công việc / Yêu cầu nghiệp vụ                     | Trạng thái UI & Tương tác Mock                                                                                                                                                                                                                                            |
| :------------ | :---------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SCRUM-449** | **Báo giá B2B & Bảng giá theo cấp khách hàng**        | Quản lý báo giá sỉ với chính sách giá bậc thang (Tiered pricing theo MOQ 100/500/1000 pcs), chiết khấu theo cấp đại lý (Vàng, Bạc, Đồng), quản lý version báo giá (v1, v2) và thời hạn hiệu lực báo giá. Khách hàng xem và gửi yêu cầu điều chỉnh giá.                    |
| **SCRUM-451** | **Quản lý Đơn hàng B2B & Hạn mức tín dụng / Công nợ** | Quản lý hợp đồng đơn hàng sỉ: Thẩm định hạn mức tín dụng (Credit Limit check), cảnh báo khi đơn hàng mới vượt trần công nợ cho phép, quy trình duyệt ngoại lệ tín dụng, hồ sơ pháp lý doanh nghiệp (MST, GPKD) và luồng gửi thư mời / kích hoạt tài khoản khách hàng B2B. |

---

## 3. Orca Workspaces & Branch Directory

Các workspace độc lập được khởi tạo và lưu trữ an toàn trên ổ `D:`:

| Tên Workspace Orca              | Nhánh Git cục bộ                      | Thư mục vật lý trên ổ D:                                                                 | Mục đích & Trách nhiệm                                                      |
| :------------------------------ | :------------------------------------ | :--------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **integration-lead**            | `VoHMinh/integration-lead`            | `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\integration-lead`            | Tích hợp toàn diện, Server Preview Port 3100, Điều hướng tổng, Layout chung |
| **worker-a-samples-production** | `VoHMinh/worker-a-samples-production` | `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\worker-a-samples-production` | Phát triển Nhóm A (Phiếu may mẫu, Duyệt mẫu, Dashboard)                     |
| **worker-b-workshop**           | `VoHMinh/worker-b-workshop`           | `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\worker-b-workshop`           | Phát triển Nhóm B (Điều độ xưởng, Chuyền may, Cấp phát NPL, Tắc nghẽn)      |
| **worker-c-subcontract**        | `VoHMinh/worker-c-subcontract`        | `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\worker-c-subcontract`        | Phát triển Nhóm C (Đơn gia công ngoài, Tách lô, Quyết toán gia công)        |
| **worker-d-b2b**                | `VoHMinh/worker-d-b2b`                | `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\worker-d-b2b`                | Phát triển Nhóm D (Báo giá sỉ B2B, Hạn mức tín dụng, Kích hoạt đại lý)      |

---

## 4. Kiểm định Chất lượng & Tiêu chuẩn Kỹ thuật

- **Typecheck:** `pnpm run typecheck` đạt **0 lỗi** trên toàn bộ 4 module.
- **Unit & Integration Tests:** Chạy `pnpm run test` đạt **486/486 passed** (61 test suites xanh 100%).
- **Auth Guard:** Toàn bộ route `/ui-preview/...` được cấu hình độc lập, không xâm lấn hoặc vô hiệu hóa middleware xác thực của backoffice hay storefront.
- **Mock State:** Sử dụng stateful in-memory repository (không gọi mạng API thật, không nhập trực tiếp file `mock-data.ts` toàn cục vào UI).
- **Design System:** Tuân thủ 100% StockFlow Mode A (tone Enterprise Indigo/Slate, mật độ compact, badge trạng thái chuẩn Odoo, hiển thị rõ ràng trên Desktop và Tablet).
- **Zero Push / No BE Changes:** Tuyệt đối không can thiệp code Backend, không commit/push lên remote GitHub origin, không thay đổi trạng thái Jira.
