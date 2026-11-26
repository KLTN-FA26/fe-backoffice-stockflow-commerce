---
description: Back-office ERP UI — bố cục trang danh sách / chi tiết, lọc, ô nhập, tab (chuẩn từ nhóm trang Sản phẩm)
globs:
  - "src/app/admin/**"
  - "src/components/backoffice/**"
  - "src/components/shared/**"
  - "src/features/**"
---

# Back-office ERP UI

Chuẩn giao diện chốt từ nhóm trang **Sản phẩm** (Sản phẩm & SKU, Từ điển thuộc tính, Thương hiệu &
danh mục, Hồ sơ hàng tồn). Trang mới hoặc trang sửa lại theo đúng các luật dưới; trang cũ chưa sửa thì
áp dần, không refactor hàng loạt khi không được yêu cầu. Đọc cùng [mode-a-backoffice.md](mode-a-backoffice.md)
và [data-table-mode-a.md](data-table-mode-a.md).

## A. Trang danh sách

1. **Nút tạo mới trên thanh breadcrumb** — bọc trong `HeaderActions`, dùng `HeaderCreateButton`
   (`components/shared/HeaderActions.tsx`): nút ghost, dấu "+" và chữ "Tạo mới" (không ghi tạo gì);
   `tooltip` (Tooltip shadcn) nói rõ tạo gì, hoặc lý do khi bị khoá vì thiếu quyền; `aria-label` chứa
   chữ "Tạo mới" + đối tượng. Không đặt nút tạo mới trong toolbar.
2. **Hàng tìm kiếm** chỉ còn ô tìm + nút xuất (Excel…) + "Xoá đã chọn" khi có dòng chọn; các nút cùng
   cỡ ô tìm (`TOOLBAR_ACTION_CLASS`).
3. **Thanh cấu hình kiểu Vercel** — `ListToolbar controlsIn="summary"`: không khung, không chữ "Cấu
   hình"; đầu hàng là nút "Bộ lọc" + "Ẩn hiện cột" (bo tròn, có chữ, icon giữ màu: lọc xanh, cột cam),
   tiếp theo các viên viền nét đứt "Nhãn **Giá trị**", "Đặt lại" bên phải. Popover "Bộ lọc" và "Ẩn hiện
   cột" mở từ mép trái nút.
4. **Bảng "Bộ lọc"** (`filterPanel`) — mỗi nhóm lọc là một cột nằm ngang `ListFilterColumn` (tiêu đề
   đậm, ô tìm, danh sách ô tick).
5. **Lọc trên header từng cột** (`ColumnDef.headerFilter` / `withHeaderFilters`):
   - cột chữ → `ColumnFilterButton` (gõ, bỏ dấu khi so khớp);
   - cột giá trị cố định → `HeaderOptionFilter` (chọn một) hoặc `HeaderMultiOptionFilter` (chọn nhiều) —
     **giữ đúng logic nghiệp vụ** chọn một / chọn nhiều của tham số BE;
   - cột thời gian → `HeaderDateRangeFilter` (từ ngày – đến ngày, giờ Asia/Ho_Chi_Minh);
   - mỗi lọc cột một khoá URL riêng (nuqs), **không ghi đè ô tìm chính**; "Đặt lại" / "Bỏ bộ lọc" xoá
     cả lọc cột; đổi lọc thì về trang 1;
   - BE không có tham số lọc → không giả lọc server: hoặc bỏ lọc cột đó, hoặc chỉ lọc trang đang xem và
     caption nói rõ phạm vi ("Lọc trong trang đang xem"); so khớp chữ dùng `textIncludes` (`lib/text-match.ts`).
6. **Cột thao tác** — tiêu đề "Thao tác"; không đưa vào danh sách "Ẩn hiện cột" (không ẩn được). Mọi thao tác
   của dòng gom vào MỘT nút "⋯" (`RowActionsMenu` / `rowActionsColumn`, `components/shared/RowActionsMenu.tsx`): bấm mở
   menu — mỗi mục có **icon + chữ** (`icon` lucide; "Xem chi tiết", "Sửa…", việc nguy hiểm chữ đỏ ở cuối); thao tác bị
   khoá vẫn hiện kèm lý do. Không đặt nút icon / nút chữ rời trong ô. Cột luôn **ghim mép phải** khi bảng cuộn ngang —
   `DataTable` tự ghim cột key `actions` hoặc tiêu đề "Thao tác", không cần khai `sticky`.
7. **Không có kết quả / chưa có dữ liệu** — giữ bảng và header (để còn bỏ lọc ở cột), thông báo nằm
   trong thân bảng qua `DataTable.emptyState` (`EmptyState` bỏ khung: `rounded-none border-0
   bg-transparent whitespace-normal`). Không thay cả bảng bằng khối trống. Danh sách phân trang server dùng
   `ServerTableBody emptyInTable`, không chép lại component.
8. **Tiêu đề cột** — `ink-primary`, semibold (đã đặt trong `DataTable`).
9. **Chân bảng luôn thấy được** — bảng danh sách bật `stickyHeader`: `DataTable` tự đo khoảng còn trống
   tới đáy vùng nội dung (trừ chân phân trang) cho vùng cuộn, nên trang không cuộn cả khối và thanh
   phân trang không bị đẩy khỏi màn. Không đặt `max-h` cứng cho vùng cuộn của bảng.

## B. Trang chi tiết (object page ERP)

10. **Thứ tự trang**: header đối tượng (tên lớn font display, mã mono, trạng thái; nút chuyển trạng
   thái chính bên phải, việc nguy hiểm gom menu "⋯") → khung hồ sơ → bảng dữ liệu chính hiện thẳng →
   tab cho các nhóm ít dùng.
11. **Khung hồ sơ** — một khung: đầu khung là vòng đời nằm ngang (stepper) + nút "Chỉnh sửa" bên phải
    cùng hàng; dưới là lưới thông số 4 cột ngăn bằng vạch mảnh (`gap-px` trên nền `--table-line`); cuối
    là mô tả.
12. **Không gom mọi thứ vào tab** — dữ liệu xem / thao tác thường xuyên (bảng chính) hiện thẳng; nhóm ít
    dữ liệu mà liên quan thì gộp chung một tab; tab không có dữ liệu hoặc không có quyền xem thì ẩn.
12b. **Dựng bằng component chung** — header đối tượng, khung hồ sơ, ô thông số, stepper dùng `ObjectHeader` /
    `ProfileFrame` / `ProfileFact` / `LifecycleSteps` (`components/shared/ObjectPage.tsx`); tab nhóm ít dùng theo mẫu
    `ProductDetailTabs` (lịch sử, chứng từ, yêu cầu… là **bảng** trong tab, không phải danh sách chữ ở cột phụ).
13. **Panel thống nhất** — `DetailPanel` / `FactGrid` / `Fact` (`components/shared/DetailPanel.tsx`):
    thanh tiêu đề (tên, số lượng, một dòng mô tả) + nút
    sửa **bên phải thanh tiêu đề**, không đặt nút dưới nội dung; thông số trong panel dùng `FactGrid`
    (khoảng cách thoáng, không kẻ vạch).
14. **Không khung lồng khung** — bảng tự có khung thì không bọc thêm card; tiêu đề trùng tên tab thì bỏ.
15. **Không đóng / mở mục** — mục chi tiết luôn hiện; `DetailSection` không thu gọn (`bare` khi nội dung
    đã có khung).
16. **Bảng trong trang chi tiết** — `DataTable`: khung cố định, cuộn ngang / dọc, header dính
    (`stickyHeader`), phân trang; cột có `min-w-*` để cuộn ngang thay vì bóp chữ; có lọc header như mục 5.
    BE không có tham số lọc → tải một lần (tối đa `Pages.MAX_PAGE_SIZE` = 200) rồi lọc + phân trang ở FE,
    ghi rõ phạm vi khi tổng vượt giới hạn.
17. **Mã kỹ thuật từ BE** (vd `unit:THUNG`, enum, id) đổi sang chữ người đọc được trước khi hiện
    (vd "Đơn vị: THUNG"); id dài rút gọn, bản đầy đủ ở `title`.

## C. Ô nhập & chọn

18. **Bo góc ô nhập** — mọi input / textarea / select / combobox bo `--field-radius` (8px, bằng card /
    section); đặt qua token + `globals.css`, không sửa `components/ui/*`.
19. **Select là combobox** — dùng `components/shared/combobox-select` (API như shadcn Select): gõ để lọc,
    giao diện như một cột Bộ lọc (tiêu đề đậm, ô tìm, ô tick). Giữ đúng logic chọn một / chọn nhiều. Không
    dùng `<select>` gốc, không import `components/ui/select` ở feature.
20. **Popover lọc header** — cùng dáng cột Bộ lọc: tiêu đề đậm + "Xoá" ở góc phải, không khung lồng.

## D. Chung

21. **Tab** — `PageTabs` kiểu gạch chân, không icon, tab đang chọn trên URL.
22. **Bóng đổ** — giữ mức nhẹ của token (`--sh-*`, `--shadow-*` đã giảm 30%); không thêm bóng đậm lẻ.
23. **Topbar / sidebar** — thanh breadcrumb chỉ chứa nút hành động chính của trang (`HeaderActions`);
    chuông thông báo ở đáy sidebar cạnh tài khoản.
