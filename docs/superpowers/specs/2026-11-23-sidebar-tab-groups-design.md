# Chia lại tab sidebar back-office theo docs — 2026-11-23

## Vì sao

Sidebar (`NAV_GROUPS` trong `components/backoffice/BackofficeShell.tsx`) gom trang không theo module
của docs: "Thực hiện đơn" trộn đơn hàng (17), vận chuyển (09) và hàng đợi công nợ (15); bảng giá
khách (13 §4.2) nằm trong "Master data"; hồ sơ hàng tồn (01 §4.7) nằm trong "Kho"; hai nhóm "Kho"
và "Kho & bản đồ" dễ nhầm; "Platform" là tiếng Anh.

## Mục tiêu / không làm

- Mỗi trang nằm ở nhóm của module sở hữu nó (docs 00 §3, mục Actor của từng module).
- Thứ tự nhóm theo luồng end-to-end (docs 00 §4).
- **Không** đổi route, mã quyền, nhãn từng mục, tab theo kho "Kho & bản đồ" (spec 2026-11-22).

## Cách chia (12 nhóm)

| Nhóm                 | Module                     | Mục                                                                                 |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| Tổng quan            | —                          | Tổng quan                                                                           |
| Sản phẩm             | 01                         | Sản phẩm & SKU · Từ điển thuộc tính · Thương hiệu & danh mục · Hồ sơ hàng tồn       |
| Thiết kế             | 12                         | Duyệt thiết kế · Yêu cầu báo giá từ thiết kế                                        |
| Bán hàng             | 13 14 16 18                | Khách hàng · Bảng giá khách · Báo giá · Chat · Câu trả lời mẫu · Báo cáo chat       |
| Đơn hàng             | 17                         | Đơn hàng · Yêu cầu huỷ · Giao thất bại · Yêu cầu trả hàng                           |
| Sản xuất             | 17 §4.3                    | giữ nguyên                                                                          |
| Nhập kho             | 03                         | Phiếu nhận · Nhập hàng hoàn                                                         |
| Kho & bản đồ         | 06 + màn vận hành theo kho | giữ nguyên                                                                          |
| Tồn kho              | 20                         | Tổng quan tồn · Điều chỉnh · Cách ly · Lịch sử biến động                            |
| Vận chuyển           | 09                         | Ước tính tải · Kế hoạch xếp xe · Shipment · Chuyến · Loại xe · Hãng · Sự kiện hãng  |
| Thanh toán & hoá đơn | 15 21                      | Đợt TT · Phiếu thu · Hoàn tiền · Đơn treo công nợ · Hoá đơn ĐT · Bảng kê · Cấu hình |
| Hệ thống             | 00 §2.5                    | Người dùng · Phân quyền                                                             |

## Cách làm đã cân nhắc

1. **Tách "Thực hiện đơn" thành Đơn hàng / Vận chuyển** — người dùng chọn. Bám docs 00 §3,
   mỗi nhóm ≤ 7 mục.
2. Gộp Đơn hàng vào Bán hàng (docs 00 §3 xếp 17 vào nhóm Bán hàng) — bỏ: nhóm Bán hàng lên 10+ mục,
   menu drill-down dài.

**Khác với đề xuất người dùng đã duyệt** — đề xuất viết trên nhánh cũ (`feat/putaway-trips`, sau
`develop` 21 commit). Khi làm trên `develop`, mình tự quyết thêm:

- **Bỏ nhóm "Xuất kho"** (Lấy hàng, Kiểm thùng, Cất lại): trên `develop` ba trang này đã vào tab theo kho.
- **Thêm nhóm "Thiết kế"** cho hai mục mới của `develop` (Duyệt thiết kế, Yêu cầu báo giá từ thiết kế) —
  docs 00 §3 có nhóm "Quản lý thiết kế" riêng (module 12). Người dùng chưa duyệt nhóm này.
- **Câu trả lời mẫu, Báo cáo chat** (mới trên `develop`) để ở Bán hàng cùng Chat (module 16).

Giữ quy tắc **L-6** của `develop` (PR #247): người làm báo giá thấy "Đơn hàng" trong nhóm Bán hàng,
bản ở nhóm Đơn hàng ẩn với họ (`unlessPermission`). Mục **Công nợ** (BO-UX-37) của `develop` nằm ở
Thanh toán & hoá đơn ngay sau Đợt thanh toán.

"Giao thất bại" để ở Đơn hàng vì Sale quyết định (WF-05 GH-1), dù luồng thuộc 09 §4.3.

## Kiểm chứng

`components/backoffice/nav-groups.test.ts` khoá thứ tự nhóm, mục của từng nhóm, mỗi trang đúng
một nhóm, tên nhóm không trùng.
