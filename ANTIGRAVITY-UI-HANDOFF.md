# ANTIGRAVITY-UI-HANDOFF.md — Biên Bản Bàn Giao Toàn Diện Giao Diện StockFlow

> **Người thực hiện:** Antigravity FE Lead  
> **Thời điểm bàn giao:** 10/10/2026 13:15 (GMT+7)  
> **Thực hiện theo chỉ đạo:** `ANTIGRAVITY-FE-COMPLETION-GATE.md`  
> **Branch tích hợp:** `VoHMinh/integration-lead` (base `origin/develop`, không sửa `develop`, không can thiệp backend, không push/merge Git)  
> **Vị trí thư mục làm việc:** `D:\FPT\KLTN\fe-workspaces\fe-backoffice-stockflow-commerce\integration-lead`  
> **Tiến trình preview:** Next.js 16.3.4 đang hoạt động ổn định trên `http://localhost:3100` (PID active background daemon). Tiến trình gốc trên Port 3000 (PID 47676) được bảo toàn tuyệt đối.

---

## 1. Tuyên Bố Bàn Giao & Đối Soát Danh Mục Task

Sau khi đối soát chi tiết từng dòng với `FE-JIRA-AUDIT-2026-10-09.json` và `ANTIGRAVITY-FE-UI-BRIEF.md`, chúng tôi xác nhận phân định chuẩn xác danh mục 20 nhiệm vụ Frontend được giao:

- **Batch 1 (12 Tasks FE Nghiệp vụ In ấn & Bao bì):** SCRUM-404, SCRUM-406, SCRUM-408, SCRUM-410, SCRUM-412, SCRUM-414, SCRUM-416, SCRUM-417, SCRUM-419, SCRUM-442, SCRUM-449, SCRUM-451.
- **Batch 2 (8 Tasks FE Mở rộng):** SCRUM-248, SCRUM-212, SCRUM-257, SCRUM-258, SCRUM-304, SCRUM-299, SCRUM-300, SCRUM-320.
- **Trạng thái thực tế:**
  - **18 / 20 tasks đạt chuẩn VERIFIED** (Đầy đủ giao diện tương tác, mock repo độc lập, 65/65 test suites và 512 tests passed).
  - **2 / 20 tasks ở trạng thái PENDING DECISION (SCRUM-299 & SCRUM-300):** Giữ nguyên mẫu Bản vẽ bế phẳng hình nón cụt SVG (conical die-cut) và chờ người dùng / PO chính thức phê duyệt định hướng thay thế mô tả nội thất phòng ốc cũ trong Jira.

---

## 2. Báo Cáo 4 Cột Mốc Chất Lượng Kỹ Thuật

| Lệnh Kiểm Thử            | Trạng Thái | Mã Thoát (Exit Code) | Kết Quả Đầu Ra Thực Tế                                                                                                                         |
| :----------------------- | :--------- | :------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **`pnpm run typecheck`** | **PASS**   | `0`                  | `tsc --noEmit` hoàn thành sạch sẽ, **0 lỗi TypeScript** strict mode.                                                                           |
| **`pnpm run lint`**      | **PASS**   | `0`                  | `eslint src --max-warnings 0` hoàn thành sạch sẽ, **0 errors, 0 warnings**.                                                                    |
| **`pnpm run test`**      | **PASS**   | `0`                  | **65/65 test files passed, 512/512 unit & integration tests passed**. Trong đó có 24 tests mới được viết riêng cho các tính năng vừa bàn giao. |
| **`pnpm run build`**     | **PASS**   | `0`                  | `next build` biên dịch thành công trong 7.7s, sinh đủ 31 static/dynamic routes.                                                                |

---

## 3. Khắc Phục Chi Tiết Các Điểm Yếu Cốt Lõi

### A. Sửa triệt để lỗ hổng Barcode `includes(expectedSku)` (SCRUM-410)

- **Tình trạng cũ:** `BlankIssueScanScreen.tsx` chỉ dùng `.includes()` để kiểm tra chuỗi SKU con, dẫn đến việc bất kỳ mã giả mạo nào chứa chuỗi SKU cũng được duyệt.
- **Đã khắc phục:**
  - Xây dựng `INITIAL_BARCODE_REGISTRY` trong `src/features/ui-workshop/mock-repo.ts` liên kết chính xác Mã vạch ↔ SKU ↔ Lô (Lot) ↔ Kệ kho ↔ Số lượng tồn khả dụng.
  - Kiểm tra 5 tầng: (1) Mã vạch tồn tại trong cơ sở dữ liệu, (2) Lô hàng không bị khóa/cách ly/hết hàng, (3) Đúng chính xác SKU phôi LSX, (4) Số lượng xuất không vượt quá tồn lô và định mức LSX (BR-PRD-03), (5) Chống quét lặp <2 giây.
  - **Kiểm thử:** Suite `BlankIssueScanScreen.test.tsx` gồm 9/9 tests pass (thử nghiệm cả mã giả chứa SKU, sai SKU, phôi cạn kiệt, số lượng âm/vượt mức, quét nhanh).

### B. Chuẩn hóa Tokens & StatusBadge Mode A

- Tạo component dùng chung `<StatusBadge status={...} />` tại `src/components/shared/StatusBadge.tsx` kết nối trực tiếp vào `toneOf()` trong `src/lib/status-map.ts`.
- Thay thế toàn bộ badge inline hardcode trong `ProductionOrderList`, `ProductionOrderDetail`, `SampleRequestList`, `SubcontractParentChildView`, `B2BQuoteList`.

### C. Tối ưu Navigation & Loại bỏ Engineering Clutter

- `PreviewNav.tsx` co giãn đáp ứng linh hoạt, không còn thanh cuộn ngang ở màn hình laptop (1024px+).
- Gỡ bỏ hoàn toàn nhãn kỹ thuật nội bộ `(Port 3101)` và nhãn worker nội bộ khỏi giao diện người dùng.
- Thêm `whitespace-nowrap` trên tất cả các ô ngày tháng và mã định danh trên toàn bộ các bảng danh sách.

### D. Triển khai Toàn Diện UI Batch 2

- **SCRUM-248:** Dòng thời gian vòng đời đơn bán (`SalesOrderTimelineView.tsx`) với modal ghi nhận sự kiện tiến độ mới.
- **SCRUM-212:** Khóa giữ tồn kho khi checkout (`ReserveStockCheckoutView.tsx`) với đồng hồ đếm ngược trực tiếp 15 phút TTL, gia hạn (+5m) và giải phóng hàng.
- **SCRUM-257 & SCRUM-258:** Cổng khách gửi yêu cầu RMA đổi trả kèm ảnh bằng chứng (`RmaRequestPortalView.tsx`) & Hàng đợi Backoffice thẩm định duyệt cấp mã thu hồi Return Auth Code + nhãn vận chuyển PDF (`RmaApprovalBackofficeView.tsx`).
- **SCRUM-304:** Động cơ tính giá tùy biến in ấn thời gian thực (`CustomizationPriceCalculator.tsx`) theo công nghệ in, số màu mực, gia công bề mặt và chiết khấu 5 bậc sản lượng. Độc lập với báo giá B2B 449.
- **SCRUM-299 & SCRUM-300:** Bản vẽ khuôn bế trải phẳng 2D SVG (`PackagingDesignCanvas.tsx`) cho ly/tô giấy kèm nhập kích thước mm, vùng Bleed 3mm, điều khiển vị trí logo.
  - _Lưu ý quan trọng:_ Đây là nguyên mẫu thử nghiệm giải quyết cho bài toán in ấn bao bì. Do mô tả trong Jira là nội thất phòng ốc ("furniture/room outline"), tính năng này được giữ ở trạng thái **PENDING DECISION** chờ người dùng/PO chốt định hướng nghiệp vụ chính thức.
- **SCRUM-320:** Widget chat tư vấn nổi trên storefront (`StorefrontChatWidget.tsx`) với drawer trượt, gợi ý câu hỏi và phản hồi tự động thông minh.

### E. Nâng cấp Chuyên sâu Nghiệp vụ Thực tế & Polish UX (Realism Pass)

Theo yêu cầu từ `ANTIGRAVITY-UI-REALISM-POLISH.md` và 3 skills (`web-design-guidelines`, `frontend-design`, `webapp-testing`):

1. **Loại bỏ 100% cửa sổ trình duyệt phi thực tế:** Đã xóa bỏ toàn bộ 17 lệnh `alert()` và `confirm()`. Thay thế bằng các hộp thoại Modal chuyên nghiệp (Shipping Label, Confirmation Modal, Spec Sheet Modal, CAD Export Modal) và hệ thống cảnh báo lỗi nội dòng (inline error validation).
2. **Nghiệp vụ thực tế cho Thủ kho:** Bổ sung chức năng "Hoàn tác lượt quét gần nhất" (Undo last scan) tại `BlankIssueScanScreen.tsx` (SCRUM-410), tự động rollback số lượng phôi đã quét, khôi phục trạng thái lô phôi và ghi nhận lịch sử hoàn tác.
3. **Mẫu tem vận chuyển thu hồi thực tế (SCRUM-258):** Modal in nhãn bưu điện hiển thị mã vạch SVG chuẩn, mã vận đơn, thông tin gửi nhận hai chiều và chỉ dẫn dán kiện hàng thực tế kèm nút in trình duyệt `window.print()`.
4. **Bảng trích xuất thông số kỹ thuật in ấn (SCRUM-304):** Bảng Spec Sheet chi tiết phân rã chi phí phôi, khuôn in, lượt chạy máy, gia công bề mặt, chiết khấu và tổng quyết toán kèm nút sao chép thông số.
5. **Trích xuất bản vẽ khuôn bế CAD SVG (SCRUM-299 & 300):** Modal xem trước các lớp CAD (đường cắt Cut Line, nếp gấp Crease, vùng tràn viền Bleed) và tải trực tiếp file vector SVG thật.
6. **Thư viện chuẩn hóa giao diện Mode A (Design Tokens Gallery):** Tích hợp khu vực Component Gallery trực quan ngay trên Preview Hub (`/ui-preview`) để đối chiếu thẻ trạng thái chuẩn (`StatusBadge`), thứ bậc nút bấm ngữ nghĩa, font số tabular và biểu ngữ thông báo.

---

## 4. Thư Viện Ảnh Chụp Màn Hình Minh Chứng (Screenshots)

Đã chụp bằng Microsoft Edge Headless (1440x1200, 1440x900, 768x1024) và lưu trữ tại thư mục Artifacts:

1. `preview-hub-polished-1440.png`: Hub trung tâm với Thư viện chuẩn hóa Design Tokens & Giao diện Mode A (1440px).
2. `preview-hub-polished-768.png`: Hub trung tâm kiểm thử đáp ứng co giãn trên thiết bị Tablet/Mobile (768px).
3. `scrum-410-undo-scan-1440.png`: Màn hình quét xuất phôi có nút "Hoàn tác lượt quét gần nhất" và log âm (-) hoàn tác.
4. `scrum-258-rma-approval-polished.png`: Modal in nhãn thu hồi RMA có Barcode SVG và địa chỉ hoàn hàng thực tế.
5. `scrum-212-stock-reservation-polished.png`: Modal xác nhận giải phóng tồn kho Mode A cảnh báo mất hàng vào tay khách khác.
6. `scrum-304-customization-pricing-polished.png`: Modal trích xuất thông số kỹ thuật in ấn và bảng phân rã chi phí chi tiết.
7. `scrum-299-diecut-designer-polished.png`: Modal trích xuất bản vẽ CAD khuôn bế SVG và cờ cảnh báo giả định demo.
8. `preview-samples-production-1440.png`: Phân hệ Nhóm A (Yêu cầu mẫu & LSX phân trang).
9. `scrum-419-qc-screen-1440.png`: Trạm QC kiểm tra trực quan đối chiếu Golden Sample.
10. `preview-subcontract-1440.png`: Phân hệ Nhóm C (Tách LSX và phiếu giao hàng gia công ngoài).
11. `preview-b2b-1440.png`: Phân hệ Nhóm D (Báo giá bậc thang B2B và Portal khách hàng).

---

## 5. Danh Sách Đường Dẫn Preview Sẵn Sàng Trải Nghiệm (Port 3100)

Máy chủ preview đang hoạt động tại cổng `http://localhost:3100`:

- **Hub Trung Tâm & Design Tokens Gallery:** [http://localhost:3100/ui-preview](http://localhost:3100/ui-preview)
- **Nhóm A (Mẫu thử & LSX):** [http://localhost:3100/ui-preview/samples-production](http://localhost:3100/ui-preview/samples-production)
- **Nhóm B (Xưởng in & QC):** [http://localhost:3100/ui-preview/workshop](http://localhost:3100/ui-preview/workshop)
- **Nhóm C (Gia công ngoài):** [http://localhost:3100/ui-preview/subcontract](http://localhost:3100/ui-preview/subcontract)
- **Nhóm D (B2B Commerce):** [http://localhost:3100/ui-preview/b2b](http://localhost:3100/ui-preview/b2b)
- **Nhóm E (Batch 2 Mở Rộng):** [http://localhost:3100/ui-preview/batch2](http://localhost:3100/ui-preview/batch2)
