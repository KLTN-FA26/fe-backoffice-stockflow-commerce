# Tab làm việc theo kho — design

Ngày: 2026-11-22 · Trạng thái: chờ duyệt

## 1. Ý định

Màn thao tác hằng ngày của nhân viên kho (NV kho) hiện nằm rải ở nhiều nhóm sidebar. Phần lớn màn tự có một ô
chọn kho riêng, lưu ở `?warehouse=` (`PutawayWarehouseSelect`, `WarehouseFilterSelect`, ô kho ở `TripStart`,
`CycleCountCreateDialog`…). Người dùng phải chọn lại kho ở từng màn, và màn nào cũng có trạng thái "chưa chọn kho".
Riêng Di chuyển nội bộ thì không có ô chọn kho: màn này tra tồn theo SKU trên **mọi kho** và làm việc bằng mã vị trí.

Docs nói rõ người dùng phạm vi `WAREHOUSE` (Warehouse Staff, Warehouse Manager) chỉ làm việc trong **các kho được gán**
(00 §phân quyền, 03, 05, 07, 08, 11, 20 BR-19). Vì vậy các màn này được gom vào **một tab chung**: chọn kho một lần
khi vào tab, sau đó mọi màn bên trong luôn chỉ làm việc với kho đó.

Khuôn đã có sẵn: tab "Kho & bản đồ" (module 06) đặt trang theo kho dưới `/admin/warehouse-map/{prefix}`, có panel
sidebar riêng (`WarehouseNavPanel`) và nút đổi kho trên breadcrumb (`WarehouseCrumb`). Thiết kế này mở rộng đúng
khuôn đó.

## 2. Mục tiêu / không làm / phản mục tiêu

**Mục tiêu**

- 7 màn sau chuyển vào tab theo kho, kho nằm trên đường dẫn:
  Cất hàng (05), Chuyến cất hàng (05 §4.5), Lấy hàng (07), Kiểm thùng (08), Cất lại (07 §4.5),
  Di chuyển nội bộ (11), Kiểm kê (20).
- Trong tab không màn nào còn ô chọn kho hay `?warehouse=`; không còn trạng thái "chưa chọn kho" bên trong màn.
- Chỉ vào được **màn vận hành** của kho mình được gán (khi BE trả về). Bản đồ vẫn xem được ở mọi kho (06: bản đồ và
  vị trí không giới hạn theo kho được gán). Người chỉ được gán một kho thì vào thẳng kho đó.
- Link cũ (bookmark, link từ module khác) vẫn chạy: được chuyển hướng sang route mới.

**Không làm**

- Màn quản lý / tổng hợp giữ nguyên chỗ cũ, vẫn lọc kho như hiện nay: Phiếu nhận, Tồn kho tổng quan, Hồ sơ hàng tồn,
  Điều chỉnh tồn, Cách ly, Lịch sử biến động, Chuyến xe, Shipment, Kế hoạch xếp xe. Đây là màn mà role phạm vi `ALL`
  (Sale, Kế toán, Điều phối) cần xem nhiều kho cùng lúc.
- Không dọn `useAppStore.warehouseId` và header `X-Warehouse-Id` (cơ chế cũ của inventory) — để một task riêng.
- Không đổi tên gốc route `/admin/warehouse-map`.

**Phản mục tiêu** (chạy được nhưng vẫn coi là hỏng)

- Một màn trong tab vẫn hiện ô chọn kho, hoặc gọi API với kho khác kho trên URL.
- Sau khi BE trả kho được gán, NV kho vẫn vào được màn vận hành của kho không phải của mình.
- Quản lý kho không mở được bản đồ của kho chưa gán cho mình (vd kho vừa tạo để thiết lập).
- Link từ module khác rơi vào trang trống / "chưa chọn kho" thay vì đúng màn đúng kho.
- Feature này import feature khác để lấy kho (vi phạm import boundary).

## 3. Ràng buộc

- Prefix kho duy nhất và không đổi (06 BR-10/BR-13), nên dùng được làm khoá trên URL.
- BE chỉ nhận `warehouseId` (UUID); prefix → id phải tra qua danh mục kho (`GET /warehouses`, đã cache).
- NV kho có `warehouse-warehouses:VIEW_PAGE` và `:READ` (baseline seed), nên đọc được danh mục kho. Nhưng
  `GET /warehouses` **không** lọc theo kho được gán.
- `GET /api/v1/identity/me/permissions` (`MyPermissionsResponse`) **đã** trả `dataScope`
  (`OWN | TEAM | WAREHOUSE | ALL`); FE đã parse ở `lib/auth/me-permissions.ts`. Query này refetch khi focus lại, sau
  một lần 403 và khi `authorizationVersion` đổi. Cả `/me` lẫn `/me/permissions` đều **chưa** trả kho được gán, dù BE
  đã có sẵn `CurrentUser.warehouseIds/warehouseCodes` (dùng ở `WarehouseScope`).
- Mỗi NV kho chỉ có **một** chuyến cất hàng đang mở, tính trên mọi kho (`PUTAWAY_TRIP_ALREADY_OPEN`);
  `GET /putaway-trips/current` không lọc theo kho.
- Danh mục kho cũng là nơi tạo và sửa kho (Warehouse Manager có `warehouse-warehouses:CREATE/UPDATE`). Kho vừa tạo
  không tự gán cho người tạo.
- Đổi kho được gán có hiệu lực từ thao tác kế tiếp, không cần đăng nhập lại (00 §tài khoản, mục 6).
- `features/A` không import `features/B`; `page.tsx` ≤ 60 dòng chỉ compose; state "người khác mở link thấy cùng thứ"
  nằm trên URL.
- Gating hiển thị chỉ là UI, BE vẫn re-check (BR-SEC-002 `WarehouseScope`).

## 4. Các cách đã cân nhắc

| Cách                           | Mô tả                                    | Được                                                                                      | Mất                                                                                       | Chọn |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- |
| 1. Kho trên đường dẫn (prefix) | `/admin/warehouse-map/{prefix}/putaway`… | Link/F5 đúng kho; dùng lại breadcrumb đổi kho + panel; không còn trạng thái chưa chọn kho | Chuyển chỗ trang, sửa ~40 link, cần trang chuyển hướng cho route cũ                       | ✅   |
| 2. Kho trong zustand           | Giữ route cũ, tab ghi kho vào store      | Ít đổi file nhất                                                                          | Link không mang kho; 2 tab trình duyệt giẫm nhau; trái luật "kho của tab không áp cả app" | ✗    |
| 3. `?warehouse=` chung         | Giữ route cũ, một hook đọc chung tham số | Nhỏ, vẫn trên URL                                                                         | Mọi link phải nhớ gắn tham số; breadcrumb không thể hiện kho                              | ✗    |

Người dùng chọn **cách 1**.

Nguồn "kho được gán": người dùng chọn **BE trả danh sách kho được gán cho FE**, thay vì FE hiện mọi kho rồi xử lý 403.
Người viết đặt trường này ở `/me/permissions` thay vì `/me` (xem 5.1).

## 5. Thiết kế

### 5.1 BE — `/me/permissions` trả kho được gán (PR riêng, repo `be-backoffice-stockflow-commerce`)

Issue: [KLTN-FA26/be-backoffice-stockflow-commerce#394](https://github.com/KLTN-FA26/be-backoffice-stockflow-commerce/issues/394).
Cùng issue có thêm việc "nên làm": `PutawayTaskResponse` trả `warehouseId`, để trang chuyển hướng `/admin/putaway/{taskId}`
không phải đoán kho từ mã vị trí.

`MyPermissionsResponse` thêm `warehouses`: danh sách `{ id, prefix }` của các kho được gán, lấy từ `CurrentUser`
(`warehouseIds`/`warehouseCodes`). Danh sách rỗng khi người dùng không được gán kho nào. `dataScope` đã có sẵn, không đổi.
Kèm test controller và cập nhật OpenAPI.

Lý do chọn `/me/permissions` thay vì `/me`:

- `/me` chỉ được gọi lúc đăng nhập và bootstrap (qua BFF, schema `authUserSchema` strict), rồi nằm yên trong auth store.
- `/me/permissions` là React Query, tự refetch. Vì vậy đổi kho được gán sẽ có hiệu lực từ thao tác kế tiếp (00 mục 6)
  mà không cần đăng nhập lại.

### 5.2 FE — nền tảng (`lib/`)

- `lib/auth`: `myPermissionsSchema` thêm `warehouses?` (để optional, vì FE phải chạy được cả trước khi BE lên). Hook
  `useAssignedWarehouses()` trả về `{ scope, warehouses }`:
  - `dataScope === "WAREHOUSE"` và có `warehouses` → `"restricted"`;
  - `dataScope === "WAREHOUSE"` nhưng BE chưa trả `warehouses` → `"unknown"` (cho vào, BE chặn 403 như hiện nay);
  - `ALL`, `TEAM`, `OWN` → `"all"`. Các scope này không bị `WarehouseScope` giới hạn theo kho.
- `lib/workspace` (mới): React context `WorkspaceWarehouse = { id, prefix, name }` và hook
  `useWorkspaceWarehouse()`. Feature (putaway, fulfillment, move, inventory) chỉ đọc kho qua hook này, **không**
  import `features/warehouse-map`.
- Hai lớp layout. Route group `(operations)` không đổi URL:
  - `app/admin/warehouse-map/[prefix]/layout.tsx` (mới) compose một component của `features/warehouse-map`, chỉ tra
    prefix → kho:
    - đang tải → khung skeleton;
    - không có kho với prefix đó → not-found;
    - hợp lệ → bọc `children` bằng provider của `lib/workspace`.

    Lớp này **không** kiểm kho được gán, vì bản đồ không giới hạn theo kho được gán (06).

  - `app/admin/warehouse-map/[prefix]/(operations)/layout.tsx` (mới) bọc 7 màn vận hành và Gợi ý vị trí (đọc nhiệm vụ cất
    hàng, mà nhiệm vụ cất hàng giới hạn theo kho — 05, 06). `scope === "restricted"` mà prefix không thuộc kho được gán →
    EmptyState "Bạn không được gán kho này", kèm link sang bản đồ của kho đó và về bước chọn kho. **Không** render màn
    con (không gọi API).

  Trang bản đồ nằm ngoài group. Trang bản đồ và Gợi ý vị trí hiện tự tra prefix; chuyển sang dùng layout ngoài để chỉ
  còn một chỗ tra.

### 5.3 Bước chọn kho

- Vẫn chọn ở trang Danh mục kho (bấm dòng kho), như hiện nay.
- `scope === "restricted"`: danh mục **vẫn hiện đủ** mọi kho, vì Quản lý kho tạo/sửa kho ở đây và kho vừa tạo không
  tự gán cho họ. Dòng kho không được gán có nhãn "Không được gán". Bấm vào vẫn mở **bản đồ** của kho (bản đồ không
  giới hạn theo kho được gán), nhưng panel của kho đó chỉ có nhóm Bản đồ. Thao tác quản lý (sửa, đổi trạng thái…) giữ
  nguyên theo quyền như hiện nay.
- Gốc tab `/admin/warehouse-map`:
  - `restricted` và được gán đúng 1 kho → chuyển hướng thẳng vào kho đó;
  - `restricted` và được gán 0 kho → EmptyState "Bạn chưa được gán kho nào — liên hệ quản trị viên";
  - còn lại → chuyển về Danh mục kho như hiện nay.
- Nút đổi kho trên breadcrumb (`WarehouseCrumb`) liệt kê mọi kho. Kho không được gán có nhãn "Không được gán". Đổi
  sang kho đó khi đang ở màn vận hành → gặp thông báo của lớp `(operations)`, kèm link sang bản đồ.
- Panel sidebar ở kho không được gán (`restricted`): ẩn nhóm Vận hành, giữ nhóm Bản đồ.

### 5.4 Route mới

Thêm vào `ADMIN_ROUTES.warehouseMap` các helper nhận `prefix`:

| Màn                        | Route mới                                                    | Route cũ (giữ làm trang chuyển hướng)                  |
| -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Cất hàng (list / chi tiết) | `/{prefix}/putaway`, `/{prefix}/putaway/{taskId}`            | `/admin/putaway`, `/admin/putaway/{taskId}`            |
| Chuyến cất hàng            | `/{prefix}/putaway/trip`, `/{prefix}/putaway/trips/{tripId}` | `/admin/putaway/trip`, `/admin/putaway/trips/{tripId}` |
| Lấy hàng                   | `/{prefix}/picking`, `/{prefix}/picking/{id}`                | `/admin/picking…`                                      |
| Kiểm thùng                 | `/{prefix}/packing`, `/{prefix}/packing/{id}`                | `/admin/packing…`                                      |
| Cất lại                    | `/{prefix}/put-backs`                                        | `/admin/put-backs`                                     |
| Di chuyển nội bộ           | `/{prefix}/moves`                                            | `/admin/moves`                                         |
| Kiểm kê                    | `/{prefix}/cycle-counts`, `/{prefix}/cycle-counts/{id}`      | `/admin/inventory/cycle-counts…`                       |

(`/{prefix}` = `/admin/warehouse-map/{prefix}`.)

Các tham số lọc khác trên URL (trạng thái, người được gán, `?receipt=` của Cất hàng, text filter…) giữ nguyên;
chỉ bỏ `?warehouse=`.

### 5.5 Chuyển hướng route cũ

Mỗi route cũ trở thành một trang mỏng, chỉ chuyển hướng:

- List có `?warehouse={id}` → tra id → prefix → route mới, giữ các tham số khác.
- List không có kho → gốc tab (theo quy tắc ở 5.3).
- Chi tiết `/{id}` → đọc bản ghi lấy `warehouseId` → route mới. Bản ghi không có kho, hoặc không đọc được → về gốc tab
  kèm thông báo.

Link nội bộ trong code đổi sang helper mới khi chỗ gọi đã biết kho. Chỗ chỉ biết id bản ghi (vd từ Đơn hàng sang task
lấy hàng) được phép trỏ route cũ để trang chuyển hướng lo phần còn lại.

### 5.6 Sidebar

- 7 màn bị **bỏ khỏi** nhóm cũ (Nhập kho, Tồn kho, Bán hàng) trong `NAV_GROUPS`.
- `WarehouseNavPanel` khi đang trong kho có hai nhóm:
  - **Vận hành:** Cất hàng · Chuyến cất hàng · Lấy hàng · Kiểm thùng · Cất lại · Di chuyển nội bộ · Kiểm kê;
  - **Bản đồ:** Bản đồ · Gợi ý vị trí.

  Danh mục kho và Bảng sức chứa vẫn ở cuối, như hiện nay. Mỗi item gate bằng đúng quyền `VIEW_PAGE` hiện có của màn
  đó (`useCan`).

- Thứ tự, icon và tên tab: xem mục 6.

### 5.7 Breadcrumb

`Kho & bản đồ / [BD · Kho Bình Dương ⇅] / Lấy hàng / PT-0012`. `warehouseBreadcrumbTail` xử lý thêm các đoạn sau
trang (id chi tiết, `trip`…). Đổi kho trên trang chi tiết → về **trang list** cùng màn ở kho mới (bản ghi không tồn
tại ở kho khác). Đổi kho trên trang list → giữ nguyên trang, bỏ các tham số lọc gắn với kho (vd người được gán).

### 5.8 Thay đổi trong từng màn

- Đọc kho từ `useWorkspaceWarehouse()`; xoá ô chọn kho, tham số `warehouse` trong các hook state
  (`usePutawayFilters`, `useTaskListState`, `useCartonCheckQueueState`, state Cất lại…), cùng nhánh "chỉ thấy một kho
  thì dùng luôn".
- `TripStart`: kho mở chuyến = kho của tab.
- Chuyến cất hàng đang mở ở **kho khác** (`/putaway-trips/current` trả chuyến có `warehouseId` ≠ kho của tab): không
  render chuyến đó trong tab này. Thay vào đó hiện thông báo "Bạn đang có chuyến mở ở kho {prefix}", kèm link sang
  `/{prefix khác}/putaway/trip`. Không tự chuyển hướng, vì người dùng chủ động vào kho này. Trang chi tiết
  `/{prefix}/putaway/trips/{tripId}` có kho không khớp thì xử lý giống như vậy.
- Di chuyển nội bộ (hiện không có khái niệm kho), giới hạn trong kho của tab:
  - tra tồn theo SKU bằng `GET /warehouses/{id}/stock-items?sku=` thay cho `/inventory/stock-items?sku=` (người làm
    kiểm lại endpoint);
  - Lịch sử gần đây gửi `warehouseId` cho `/inventory/movements`;
  - mã vị trí nguồn/đích có prefix khác kho của tab → báo lỗi inline ngay ô nhập. BE vẫn re-check (11 BR-01).
- `CycleCountCreateDialog`: kho cố định = kho của tab, không cho chọn.
- `AssigneeSelect` / `CreateTaskDialog` (lấy hàng): danh sách người được gán theo kho của tab.
- Các chip `Cấu hình` / `hasFilters` / `reset` bỏ phần kho.

### 5.9 Test

- `lib/workspace` + layout ngoài: prefix hợp lệ → màn con nhận đúng kho; prefix lạ → not-found; `restricted` ngoài
  phạm vi vẫn mở được bản đồ.
- Layout `(operations)`: `restricted` với prefix ngoài phạm vi → thông báo và **không** gọi API màn con; `unknown` →
  vẫn cho vào.
- Gốc tab: được gán 1 kho → chuyển hướng; 0 kho → EmptyState; `all` → Danh mục kho.
- Danh mục kho: `restricted` vẫn hiện đủ kho; kho không được gán có nhãn, bấm vẫn mở bản đồ. Ô đổi kho hiện mọi kho
  kèm nhãn. Panel ở kho không được gán chỉ có nhóm Bản đồ.
- Panel sidebar: đủ 2 nhóm, item ẩn theo quyền (ít nhất 3 role: Warehouse Staff, Warehouse Manager và
  `SYSTEM_ADMIN`. Theo seed, đây là role `ALL` duy nhất có `VIEW_PAGE` trên 7 màn này).
- Chuyến cất hàng mở ở kho khác → thông báo + link, không render chuyến.
- Di chuyển nội bộ: tra tồn và lịch sử gửi kho của tab; mã vị trí khác prefix → lỗi inline.
- Mỗi màn chuyển sang: không còn ô chọn kho; request gửi `warehouseId` của kho trên URL; test lifecycle và
  action-gating cũ vẫn xanh.
- Trang chuyển hướng: list có `?warehouse=` → đúng route mới, giữ tham số khác; chi tiết → đúng kho của bản ghi.
- BE: `/me/permissions` trả `warehouses` đúng cho ba trường hợp: staff có 2 kho, staff có 0 kho, role `ALL`.

### 5.10 Thứ tự PR

1. **BE** — `/me/permissions` thêm `warehouses`.
2. **FE nền** — `lib/auth` schema, `lib/workspace`, `[prefix]/layout.tsx`, bước chọn kho, panel 2 nhóm,
   breadcrumb, route helper. Chưa chuyển màn nào; bản đồ và gợi ý vị trí chuyển sang dùng layout. Không phụ thuộc
   PR 1 (BE chưa trả thì `scope = "unknown"`).
3. **FE Cất hàng + Chuyến cất hàng** (docs 05).
4. **FE Lấy hàng + Kiểm thùng + Cất lại** (docs 07/08).
5. **FE Di chuyển nội bộ + Kiểm kê** (docs 11/20).

PR 3–5 độc lập với nhau, chỉ cần PR 2.

## 6. Quyết định của người viết (người dùng kiểm lại khi đọc)

- Giữ gốc route `/admin/warehouse-map` thay vì đổi sang tên mới: tránh phải chuyển chỗ bản đồ và lệch với
  `route = "/admin/warehouse-map"` mà BE khai báo trong `@PermissionResource`. Tên tab hiển thị có thể đổi sau nếu muốn.
- Trang đích khi vào một kho vẫn là Bản đồ (như hiện nay).
- Panel chia 2 nhóm, Vận hành đặt trên Bản đồ.
- Trước khi BE lên, FE vẫn hiện mọi kho (hành vi hiện tại); BE vẫn chặn bằng 403.
- Chỗ gọi chỉ biết id bản ghi thì dùng route cũ + trang chuyển hướng, không bắt module khác phải tra kho.
- Kho được gán đặt ở `/me/permissions` thay vì `/me`, để đổi kho được gán có hiệu lực mà không cần đăng nhập lại.
- Danh mục kho không bị lọc. Chỉ **màn vận hành** (và Gợi ý vị trí) bị giới hạn theo kho được gán; bản đồ mở được
  ở mọi kho (theo 06). Mục này sửa lại một phần quyết định trước: bản trước chặn cả việc vào tab.
- Chuyến cất hàng mở ở kho khác: hiện thông báo + link, không tự chuyển hướng.
- Di chuyển nội bộ bị giới hạn theo kho của tab, gồm tra tồn, lịch sử và kiểm prefix mã vị trí.
- Scope `TEAM`/`OWN` coi như `"all"`, vì không bị giới hạn theo kho.

## 7. Để lại cho người làm

- Kiểm tra từng DTO chi tiết có `warehouseId` không (task lấy hàng đang để `nullish`), rồi chọn cách xử lý khi thiếu.
- Tên nhãn hai nhóm trong panel và nội dung các EmptyState (đưa vào `constants/labels-*`).
- Cách tách component để giữ giới hạn kích thước file.
