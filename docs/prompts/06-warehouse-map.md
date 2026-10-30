# Module 06 — Bản đồ kho 2D/3D & Tạo kho mới: phân tích + prompt triển khai

> Nguồn: docs `D:\FPTU\KLTN\docs\docs\warehouse\06-warehouse-map-slotting\README.md`,
> BE `be-backoffice-stockflow-commerce/src/main/java/com/stockflow/warehouse/**`,
> seed demo BE `db/demo/V20260928009000__demo_master_data.sql` (kho HCM).

## 1. Hiện trạng

| Phần                         | FE                                                                                                              | BE                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Route `/admin/warehouse-map` | `ComingSoonPage`                                                                                                | resource `warehouse-locations` khai báo route này  |
| Route `/admin/warehouses`    | chưa có                                                                                                         | resource `warehouse-warehouses` khai báo route này |
| `features/warehouse-map`     | chỉ `index.ts` TODO                                                                                             | —                                                  |
| Thư viện 3D                  | `three`, `@react-three/fiber`, `@react-three/drei` **đã có**                                                    | —                                                  |
| Mock                         | `GET /warehouses` (1 kho HCM, thiếu field), `GET /warehouses/:id/layout` rút gọn (chỉ `locationCode`, `usable`) | —                                                  |

## 2. Hợp đồng BE (đã đọc code)

Base `/api/v1`. Mọi số đo là `BigDecimal` mét, ≤ 3 số lẻ. Trường null bị bỏ khỏi JSON.

| Endpoint                                                            | Quyền                               | Ghi chú                                                                                                                                                                   |
| ------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /warehouses`                                                  | `warehouse-warehouses:CREATE`       | `{prefix [A-Za-z0-9]{1,10}, name ≤200, address ≤500, returnAddress? ≤500, mapUnit "M", mapWidth>0, mapHeight>0}` → 201 `Warehouse`; 409 `WAREHOUSE_PREFIX_ALREADY_EXISTS` |
| `GET /warehouses?page&size&q&status&sort`                           | `…:READ`                            | `PageResponse<Warehouse>`                                                                                                                                                 |
| `GET/PUT /warehouses/{id}` · `POST …/activation` · `…/deactivation` | `…:READ/UPDATE`                     | PUT không có prefix/mapUnit (BR-13), có `version`                                                                                                                         |
| `GET /warehouses/{id}/layout`                                       | `warehouse-locations:READ`          | `{warehouse, zones[], shelves[levels[bins[]]], areas[], boundaries[]}` — tô màu theo `effectiveStatus`                                                                    |
| `POST /warehouses/{id}/zones` · `PUT /zones/{id}`                   | `warehouse-locations:CREATE/UPDATE` | `{name ≤100, color? #RRGGBB}`                                                                                                                                             |
| `POST /warehouses/{id}/shelves`                                     | `…:CREATE`                          | `{code, name, description?, zoneId?, footprint{x,y,width,length,rotation}, obstacle, pickFaces{n,e,s,w}, defaultStorageClass}`                                            |
| `POST /shelves/{id}/levels`                                         | `…:CREATE`                          | `{levelIndex 1–99, elevation?, usableHeight?, maxWeight?}` (≤ 20 tầng)                                                                                                    |
| `POST /shelves/{id}/bin-generation`                                 | `…:CREATE`                          | BR-14, gửi `Idempotency-Key`                                                                                                                                              |
| `PUT /shelves/{id}/status` · `PUT /areas/{id}/status`               | `…:UPDATE`                          | `{status}`                                                                                                                                                                |
| `POST /warehouses/{id}/areas`                                       | `…:CREATE`                          | `{code, type, name, footprint, obstacle, location?}` (location bắt buộc trừ `NON_STORAGE`)                                                                                |
| `POST /warehouses/{id}/boundaries` · `DELETE /boundaries/{id}`      | `…:CREATE/DELETE`                   | `{type WALL/DOOR, startX,startY,endX,endY, passable, operationalStatus?}`                                                                                                 |

Enum: `WarehouseStatus` ACTIVE/INACTIVE · `LocationStatus` ACTIVE/BLOCKED/MAINTENANCE/INACTIVE ·
`StorageClass` NORMAL/COLD/HAZMAT/FRAGILE/OVERSIZE · `BinType` STANDARD/PALLET/SMALL_PARTS ·
`AreaType` RECEIVING/QUALITY_CONTROL/QUARANTINE/PACKING/DISPATCH/OVERFLOW/PRODUCTION/NON_STORAGE ·
`BoundaryType` WALL/DOOR · `DoorStatus` OPEN/CLOSED · `BinNamingScheme` SEQUENTIAL/ROW_LETTER_COLUMN.

## 3. Business rules phải encode (cite docs 06 §6)

- **BR-05** bản đồ chỉ trực quan → luôn kèm nhãn "chỉ mang tính trực quan".
- **BR-06** kệ / khu vực / đầu tường nằm trong khung (chạm mép = bên trong).
- **BR-07** kệ & khu vực không `INACTIVE` không chồng lấn (chạm cạnh được).
- **BR-08** kệ có bin cho lấy hàng phải có ≥ 1 mặt lấy hàng.
- **BR-09** góc xoay 0/90/180/270.
- **BR-10** mã vị trí = `PREFIX-KỆ-TẦNG-BIN` / `PREFIX-KHU`; mỗi phần `A–Z0–9`, tự viết hoa.
- **BR-13** prefix, mã kệ/tầng/bin/khu, đơn vị bản đồ không sửa sau khi tạo.
- **BR-14/15** tự sinh bin: hàng × cột ≤ 200, ≤ 20 tầng mỗi kệ.
- **BR-16** trạng thái hiệu lực = hẹp nhất kho/kệ/vị trí — FE **đọc** `effectiveStatus` từ BE, không tự tính.

## 4. Quyết định thiết kế

1. Một feature `features/warehouse-map` (Phụ lục B) chứa cả danh mục kho lẫn bản đồ — cùng module docs 06.
2. Hai trang Mode A (style Vercel) + một modal:
   - `/admin/warehouses` — **Danh sách** (`surface-soft`): mã prefix (mono), tên, địa chỉ, khung bản đồ, trạng thái, nút "Mở bản đồ".
   - Modal **Tạo kho** mở từ nút "Tạo kho" của `/admin/warehouses` (`FormDialog`): khai báo kho + xem trước khung bản đồ theo tỉ lệ; lưu xong sang bản đồ của kho mới.
   - `/admin/warehouse-map?warehouse=&view=2d|3d&selected=` — **Chi tiết**: chọn kho, bật 2D/3D, panel bên phải cho đối tượng đang chọn. State trên URL (nuqs) để gửi link được.
3. **2D = SVG thuần** (không thêm dep): `viewBox` theo mét, lưới 1 m / 5 m, zoom bằng nút, kệ tô theo màu zone (màu là **dữ liệu** BE), viền theo `effectiveStatus`, khu vực nét đứt, tường nét dày, cửa nét đứt.
4. **3D = react-three-fiber** lazy qua `next/dynamic` (`ssr:false`), fallback 2D khi WebGL lỗi. Kệ = khung + mặt tầng theo `elevation`, bin = khối trên tầng tô theo `effectiveStatus`; màu đọc từ CSS variable lúc chạy (không hex trong component).
5. **Sửa bản đồ (giai đoạn 1 = form, chưa kéo-thả)**: Thêm zone · Thêm kệ (tạo kệ → tạo N tầng → sinh bin, 3 bước tuần tự) · Thêm khu vực · Thêm tường/cửa · Đổi trạng thái kệ/khu vực. FE kiểm trước BR-06/07/08/09/14 bằng zod refine; BE vẫn là nơi quyết định (409 map về field).
6. Action-gating qua `lifecycle.ts` + quyền `warehouse-locations:CREATE/UPDATE`, `warehouse-warehouses:CREATE` — UI-only, BE re-check.
7. Mock: store in-memory seed **đúng số liệu demo BE** (kho HCM 60×40 m, 2 zone, 3 kệ × 2 tầng × 2 bin, 5 khu vực, 1 tường + 1 cửa); kho mock-data cũ vẫn đọc layout qua nhánh cũ để không vỡ màn lấy hàng / cất hàng.

## 5. Ngoài phạm vi (giai đoạn sau, docs 06 §1 ⚠️)

Kéo-thả / resize trực tiếp trên canvas · heatmap lấp đầy · lộ trình đi · sửa bin từng ô · in nhãn PDF ·
sửa kho (PUT) và ngưng/kích hoạt kho từ danh sách.

## 6. Prompt triển khai (dùng lại cho AI agent)

```text
Bạn làm FE StockFlow (Next.js App Router, TS strict, Tailwind v4 + shadcn, TanStack Query, zod,
react-hook-form, nuqs). Đọc CLAUDE.md và .claude/rules/* trước khi viết.

Mục tiêu: module 06 — (A) giao diện tạo kho mới, (B) bản đồ kho 2D/3D.
Nguồn nghiệp vụ: D:\FPTU\KLTN\docs\docs\warehouse\06-warehouse-map-slotting\README.md.
Hợp đồng BE: be-backoffice-stockflow-commerce/src/main/java/com/stockflow/warehouse/internal/controller/**
(WarehouseController, LayoutController, ZoneController, ShelfController, AreaController,
BoundaryController + dto/*). Không đoán field — chép đúng tên field/enum từ DTO.

1. constants: WAREHOUSE_STATUSES, LOCATION_STATUSES, STORAGE_CLASSES, BIN_TYPES, AREA_TYPES,
   BOUNDARY_TYPES, DOOR_STATUSES, BIN_NAMING_SCHEMES (statuses.ts); WAREHOUSE_MAP_LIMITS (numbers.ts,
   cite BR); labels-warehouse-map.ts; ADMIN_ROUTES.warehouses/warehouseMap; quyền CREATE/UPDATE/
   VIEW_PAGE của warehouse-warehouses + warehouse-locations; status-map domain `location`.
2. features/warehouse-map: api.ts, schemas.ts (DTO parse tại biên, BigDecimal → number),
   input-schemas.ts (zod refine BR-06/07/08/09/10/14 kèm comment cite docs 06 §6), types.ts (z.infer),
   queries.ts, mutations.ts (invalidate layout + danh sách kho + root references warehouses),
   lifecycle.ts (LOCATION_STATUS_TRANSITIONS, allowedMapActions(actor)), selectors.ts (hình học thuần:
   rect xoay, chồng lấn, nằm trong khung, kích thước bin sinh tự động, thống kê bản đồ), index.ts.
3. Trang /admin/warehouses (Danh sách, surface-soft, DataTable stickyHeader, 2 empty state),
   modal Tạo kho mở từ danh mục kho (FormDialog, preview khung bản đồ),
   /admin/warehouse-map (Chi tiết: chọn kho, 2D SVG / 3D r3f lazy, panel chi tiết, legend trạng thái,
   nhãn BR-05, dialog thêm zone/kệ/khu vực/tường-cửa, đổi trạng thái kệ/khu vực).
   Mỗi route có loading.tsx + error.tsx; page.tsx ≤ 60 dòng; component ≤ 150 dòng; file ≤ 200 dòng.
4. Mock: lib/api/mock-warehouse-store.ts + mock-routes-warehouses.ts theo đúng mã lỗi BE
   (WAREHOUSE_PREFIX_ALREADY_EXISTS, LAYOUT_OUT_OF_BOUNDS, LAYOUT_OVERLAP, PICK_FACE_REQUIRED,
   SHELF_CODE_ALREADY_EXISTS, ZONE_NAME_ALREADY_EXISTS, SHELF_LEVEL_HAS_BINS, SHELF_CAPACITY_EXCEEDED).
   Seed = seed demo BE kho HCM. Component không import mock-data.
5. Test: selectors (hình học), input-schemas (từng BR), lifecycle (4 trạng thái, quyền), mock contract
   (tạo kho → layout rỗng → thêm kệ/tầng/bin), component: form tạo kho (lỗi prefix trùng map về field),
   bản đồ 2D render kệ/khu vực + action-gating theo 3 bộ quyền (staff chỉ xem / manager / không quyền).
6. Chạy pnpm run validate, dán output thật; lỗi có sẵn trên main thì tách riêng.
```
