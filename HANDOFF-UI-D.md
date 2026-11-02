# Bàn giao Giao diện Nhóm D: Khách hàng B2B & Báo giá bậc (Worker D)

- **Nhóm phụ trách:** Worker D
- **Cổng xem trước (Dev Port):** `:3104` (hoặc tích hợp `:3100`)
- **Tập tin sở hữu:** `src/features/ui-b2b/**` & `src/app/ui-preview/b2b/**`
- **Mã nguồn cơ sở:** `develop` (commit `69733fa`)

---

## 1. Bảng đối chiếu Task Jira & Màn hình hoàn thành

| Mã Jira | Phân hệ / Nghiệp vụ | Tên màn hình / Trạng thái tương tác | Đường dẫn Preview nội bộ |
|---|---|---|---|
| **SCRUM-449** | Sales báo giá bậc số lượng | Danh sách báo giá B2B (Sales Backoffice): hiển thị bậc số lượng (Tier pricing), chiết khấu %, hạn hiệu lực, điều khoản công nợ (Net 15/30/60/COD), nút gửi khách / lập bản sửa | `/ui-preview/b2b` (Tab: DS Báo Giá) |
| **SCRUM-449 (Portal)** | Portal khách duyệt báo giá | Màn hình Portal khách duyệt báo giá: tính năng chặn chấp thuận nếu thiết kế mới chưa được duyệt mẫu (Sample approval required — BR-PRD-08), chấp thuận lên đơn hoặc yêu cầu sửa kèm phản hồi | `/ui-preview/b2b` (Tab: Portal Khách Duyệt Giá) |
| **SCRUM-451** | Quản lý khách B2B & Thư mời | Danh sách khách hàng pháp nhân: mã số thuế, hạn mức công nợ, người liên hệ, form tạo khách mới, nút gửi / gửi lại thư mời kích hoạt portal | `/ui-preview/b2b` (Tab: Hồ Sơ Khách B2B) |
| **SCRUM-451 (Kích hoạt)** | Kích hoạt tài khoản Portal | Màn hình khách hàng kích hoạt từ link mời: thanh công cụ mô phỏng 3 trạng thái (Token hợp lệ, Token hết hạn > 7 ngày, Token đã sử dụng), loại bỏ guest checkout | `/ui-preview/b2b` (Tab: Kích Hoạt Portal) |

---

## 2. Quy tắc nghiệp vụ (Business Rules) đã mã hóa

1. **BR-PRD-08 & SCRUM-449 Guard:** Chặn hành động chấp thuận báo giá chuyển thành Đơn Bán Hàng nếu tồn tại dòng sản phẩm có `isNewDesign: true` mà `sampleApproved: false`. Hiển thị cảnh báo trực quan yêu cầu duyệt mẫu trước.
2. **Tier Pricing Logic:** Đơn giá tự động điều chỉnh theo các mốc số lượng đặt hàng tối thiểu (MOQ) và hiển thị chiết khấu % tương ứng.
3. **No Guest Checkout (SCRUM-450/451):** Toàn bộ giao dịch B2B yêu cầu tài khoản pháp nhân được thiết lập bởi Sales, kích hoạt qua token có thời hạn 7 ngày.

---

## 3. Kết quả kiểm tra & Độ ổn định

- **TypeScript Strict:** `tsc --noEmit` đạt 0 lỗi (Exit code 0).
- **Mô phỏng đa kịch bản:** Cho phép kiểm thử tức thì cả 3 tình huống token kích hoạt chỉ bằng 1 cú click trên thanh công cụ.

---

## 4. Danh sách API Backend cần tích hợp trong tương lai (Contract TODOs)

- `GET /api/v1/b2b/quotes`: Danh sách báo giá phân trang và lọc theo trạng thái.
- `POST /api/v1/b2b/quotes`: Tạo báo giá mới có các bậc số lượng.
- `POST /api/v1/b2b/quotes/{id}/send`: Gửi email thông báo cho khách hàng.
- `POST /api/v1/customer-portal/quotes/{id}/accept`: Khách duyệt báo giá (tự động tạo Sales Order nếu thỏa mãn điều kiện mẫu duyệt).
- `POST /api/v1/customer-portal/quotes/{id}/request-changes`: Khách yêu cầu chỉnh sửa giá/số lượng.
- `GET /api/v1/b2b/customers`: Danh sách khách hàng doanh nghiệp B2B.
- `POST /api/v1/b2b/customers`: Tạo hồ sơ pháp nhân mới.
- `POST /api/v1/b2b/customers/{id}/invite`: Gửi email kích hoạt tài khoản.
- `POST /api/v1/customer-portal/activate`: Kích hoạt tài khoản từ token và đặt mật khẩu.
