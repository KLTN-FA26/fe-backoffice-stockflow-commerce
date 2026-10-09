# Bàn giao Giao diện Nhóm A: Mẫu thử & Nền tảng Lệnh Sản Xuất (Worker A)

- **Nhóm phụ trách:** Worker A
- **Cổng xem trước (Dev Port):** `:3101` (hoặc tích hợp `:3100`)
- **Tập tin sở hữu:** `src/features/ui-samples-production/**` & `src/app/ui-preview/samples-production/**`
- **Mã nguồn cơ sở:** `develop` (commit `69733fa`)

---

## 1. Bảng đối chiếu Task Jira & Màn hình hoàn thành

| Mã Jira | Phân hệ / Nghiệp vụ | Tên màn hình / Trạng thái tương tác | Đường dẫn Preview nội bộ |
|---|---|---|---|
| **SCRUM-404** | Sales tạo mẫu & Khách duyệt mẫu | Danh sách Yêu cầu mẫu (Sample Requests), tạo mới mẫu thử, chi tiết quy cách in, dòng lịch sử vòng duyệt | `/ui-preview/samples-production` (Tab: Quản lý Mẫu) |
| **SCRUM-404 (Portal)** | Customer Portal phê duyệt mẫu | Màn hình Khách duyệt mẫu (Mode B styling): xem ảnh chụp thực tế, specs in, nút Phê duyệt (Lock Design) hoặc Yêu cầu sửa mẫu kèm lý do | `/ui-preview/samples-production` (Tab: Portal Khách Duyệt Mẫu) |
| **SCRUM-406** | Danh sách Lệnh sản xuất (LSX) | Danh sách LSX phân trang, lọc theo Loại (`SAMPLE` / `ORDER`), trạng thái lifecycle, tìm kiếm mã LSX / khách hàng | `/ui-preview/samples-production` (Tab: Danh sách LSX) |
| **SCRUM-408** | Chi tiết LSX & Prepress | Màn hình chi tiết LSX: tải & xem trước file in, đối chiếu checksum SHA256 (BR-PRD-02), kiểm định Prepress Đạt (Ready) / Hỏng (Hold) | `/ui-preview/samples-production` (Tab: Chi tiết LSX) |
| **SCRUM-414** | Tạm dừng & Hủy LSX | Hộp thoại Tạm dừng (On Hold) có lý do, Tiếp tục lệnh (Resume); Hộp thoại Hủy LSX kèm tính toán chính sách hủy (BR-PRD-10) | `/ui-preview/samples-production` (Hành động trong Chi tiết LSX) |

---

## 2. Quy tắc nghiệp vụ (Business Rules) đã mã hóa

1. **BR-PRD-01 (1 LSX per line):** Khi yêu cầu mẫu được gửi sang sản xuất, tự động khởi tạo đúng 1 LSX kiểu `SAMPLE` với mã nguồn liên kết `sourceId`.
2. **BR-PRD-02 (Prepress checksum check):** Kiểm tra đối chiếu mã băm SHA256 của tệp in với thiết kế mẫu đã duyệt. Prepress pass chuyển sang `Ready`; fail tự động đẩy sang `On Hold`.
3. **BR-PRD-08 (Design Lock):** Khách hàng phê duyệt mẫu sẽ khóa thiết kế (bản chụp snapshot + phôi SKU) làm chuẩn mực đối chiếu cho sản xuất sau này.
4. **BR-PRD-10 (Cancellation policy outcome):** 
   - Hủy trước khi in (`Pending Prepress`, `Ready`, `Material Issued`): Hoàn nhập phôi về kho 100%, không tính phí in.
   - Hủy khi đang in (`Printing`, `QC`): Tính toàn bộ chi phí dở dang và phế phẩm vào đơn hàng.

---

## 3. Kết quả kiểm tra & Độ ổn định

- **TypeScript Strict:** `tsc --noEmit` đạt 0 lỗi (Exit code 0).
- **Bộ dữ liệu giả định:** Dữ liệu mẫu tiếng Việt gắn nhãn minh bạch, không gọi API mạng thật.
- **Tương tác In-memory:** Toàn bộ thao tác tạo mới, chuyển trạng thái, gửi bưu tá, khách duyệt, prepress pass/fail, hold, resume, hủy đều cập nhật tức thời trên giao diện.

---

## 4. Danh sách API Backend cần tích hợp trong tương lai (Contract TODOs)

- `GET /api/v1/sample-requests`: Danh sách yêu cầu mẫu (phân trang, lọc theo status, customerId).
- `POST /api/v1/sample-requests`: Tạo yêu cầu mẫu mới.
- `POST /api/v1/sample-requests/{id}/submit`: Gửi sang sản xuất.
- `POST /api/v1/sample-requests/{id}/send-to-customer`: Ghi nhận bưu tá và tracking code.
- `POST /api/v1/customer-portal/samples/{id}/approve`: Khách hàng duyệt mẫu và publish `SampleApproved`.
- `POST /api/v1/customer-portal/samples/{id}/request-changes`: Khách yêu cầu sửa mẫu và tăng round.
- `GET /api/v1/production-orders`: Danh sách LSX (phân trang, lọc type, status, date).
- `GET /api/v1/production-orders/{id}`: Chi tiết LSX và artifact file in.
- `POST /api/v1/production-orders/{id}/prepress-check`: Ghi nhận kết quả prepress.
- `POST /api/v1/production-orders/{id}/hold`: Tạm dừng lệnh kèm lý do.
- `POST /api/v1/production-orders/{id}/resume`: Tiếp tục lệnh từ trạng thái cũ.
- `POST /api/v1/production-orders/{id}/cancel`: Hủy lệnh và tính toán phí theo chính sách.
