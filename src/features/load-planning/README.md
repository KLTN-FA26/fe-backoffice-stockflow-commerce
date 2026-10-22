# load-planning — xếp hàng lên xe (SCRUM-287/391/392)

- **PR F1**: thư viện + khung 3D (`lib/`, `components/viewer`, `components/report`, hợp đồng `Layout`).
- **PR F4**: màn **Kế hoạch xếp xe** nối BE PR #161 — danh sách, lập mới, chi tiết (xem phần "PR F4" bên dưới). Từ
  đây feature có đủ `api.ts`, `queries.ts`, `mutations.ts`, `lifecycle.ts`, `errors.ts` (thiết kế:
  `be-backoffice-stockflow-commerce/docs/business-design/2026-10-22-scrum-287-load-planning-plan-v2.md`).
- **PR F3**: **ước tính xếp xe** của một đơn (ngăn kéo, BE PR #160) — xem mục "Ước tính xếp xe (F3)" bên dưới.
  API / query của ước tính nằm ở `estimate-*.ts`, tách khỏi `api.ts` / `queries.ts` của kế hoạch.
- Chưa làm: trình soạn xếp tay `PUT …/placements` (F5), trang in (F6).

Code là bản port từ dự án `nesting-standalone` của anh Tú (chỉ đọc, không sửa) sang framework của repo này:
Next 16 + TS strict, zod, nhãn tiếng Việt trong `constants/`, giới hạn 200 dòng/file feature, 150 dòng/component.

## Hợp đồng `Layout` (cho BE PR D)

Kế hoạch xếp xe và ước lượng dùng chung một dạng (`schemas.ts`, kiểu suy ra trong `types.ts`). Mọi đơn vị mm.

```
Layout = {
  seq: int ≥ 1                    // số thứ tự xe trong kế hoạch
  code: string                    // loại xe: "40HC", "PICKUP-1T"
  innerMm: { l, w, h }            // lòng xe: dài (z), rộng (x), cao (y)
  maxPayloadKg: number ≥ 0
  gussets: Block[]                // khối gia cố góc trên, cùng toạ độ với boxes
  boxes: Box[]
  usedVolumeMm3, usedWeightKg: number ≥ 0
}
Block = { xMm, yMm, zMm, wMm, hMm, dMm }                 // góc nhỏ nhất + kích thước theo x, y, z
Box   = Block & {
  ref: string                     // mã TỪNG kiện, duy nhất trong xe: kiện đóng gói = package id; thùng ước lượng = "<lineId>#<n>"
  sourceRef: string | null        // dòng ước lượng (lineId) sinh ra thùng; null với kiện đóng gói. Gom dòng theo partName/sourceRef, không theo ref
  label: string                   // mã ngắn in trên mặt kiện (SKU)
  partName: string                // tên mặt hàng — khoá chọn màu và nhóm dòng
  kitGroup: string | null         // mã bộ; vắng hoặc null nếu không thuộc bộ
  origMm: { l, w, h }             // kích thước danh định trước khi xoay
  orientation: "LWH"|"LHW"|"WLH"|"WHL"|"HLW"|"HWL"
  rotatable: boolean              // BR-10: false = giữ nguyên hướng đặt (LWH); BE đã có ở PackageResponse.rotatable
  weightKg: number ≥ 0
}
```

**Hệ trục.** x = chiều rộng xe, y = hướng lên, **z = chiều dài xe hướng về phía cửa**. Gốc là góc sàn bên trong
sát vách đầu xe (vách đối diện cửa). `wMm` dọc x, `hMm` dọc y, `dMm` dọc z. "Xếp sâu trước" nghĩa là z nhỏ trước.

**`orientation`** là ba chữ cái theo thứ tự nhãn D×R×C, tức trục (z, x, y): chữ nào là cạnh danh định
(`origMm.l/w/h`) nằm dọc trục đó. `LWH` = không xoay (dài dọc xe, rộng ngang xe, cao lên trên). Phải khớp:
`dMm/wMm/hMm` = `origMm` hoán vị theo `orientation` (`orientedExtent` trong `lib/dims.ts`; `checkLayout`
báo `ORIENTATION_MISMATCH` nếu lệch hơn 1 mm).

**Luật xếp là BR-10/BR-11 (docs 09-shipping §6):** đỡ ≥ 98% mặt đáy, không chìa ra ngoài lòng thùng, tổng khối lượng
từng xe ≤ tải trọng, kiện không có cờ xoay giữ nguyên hướng, chừa góc gia cố, đặt vuông góc. `rotatable` có trong hợp
đồng để FE kiểm được vế xoay (`ROTATION_NOT_ALLOWED` khi `!rotatable && orientation !== "LWH"`) mà không phải tra cờ
ngược về kiện nguồn. Tải trọng kiểm theo TỪNG xe (`summarizeLayouts().overweightVehicles`).

**Đã chốt với BE (PR D khớp theo):** `rotatable` nằm trong Box; `ref` duy nhất theo từng kiện **trong một kế hoạch**
(schema chỉ kiểm theo từng xe — từ chối `ref` trùng trong một xe; trùng giữa các xe do `findDuplicateRefs` trong
`lib/layout-check.ts` phát hiện, và BE là nơi bảo đảm) kèm `sourceRef`; mã `orientation` như trên, BE phát ra cùng chuỗi, đọc theo (z, x, y).

**Mã luật** do solver BE quy định (`PLACEMENT_RULES` trong `src/constants/load-planning.ts`, nhãn tiếng Việt
`PLACEMENT_RULE_LABELS`): `OUT_OF_BOUNDS | OVERLAP | UNSUPPORTED | OVERWEIGHT | ROTATION_NOT_ALLOWED | GUSSET`, và từ BE
PR #161 thêm `DOOR` (kiện không lọt cửa xe), `KIT_SPLIT` (một bộ bị tách khỏi một xe, LP-3), `ORIENTATION_MISMATCH`
(BE cũng kiểm). Lỗi `PLACEMENT_RULE_VIOLATION` mang mã luật ở `fieldErrors[{field: ref, code: rule}]`; riêng `OVERWEIGHT`
dùng `field: "vehicle:<seq>"`.
`validatePlacement` trả `UNSUPPORTED` khi đáy được đỡ < 98%, `GUSSET` khi chạm khối gia cố; `checkLayout` thêm
`OVERWEIGHT` (cấp xe) và `ROTATION_NOT_ALLOWED`, và `ORIENTATION_MISMATCH` (kích thước đã xếp
không khớp `origMm` theo `orientation`, sai lệch > 1 mm). Schema không chặn số lẻ mm: BE làm tròn thế nào FE nhận thế đó.

## Ánh xạ file: nesting-standalone → repo này

| File gốc (`nesting-standalone/web`)                                          | File mới (`src/features/load-planning`)                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/nesting-3d-viewer.tsx`                                           | `components/viewer/VehicleViewer3D.tsx` + `CargoBoxes.tsx`, `SpaceBlocks.tsx`, `CameraPreset.tsx`, `ViewButtons.tsx`, `label-material.ts`; dựng cảnh thuần → `lib/scene.ts`, `lib/view-presets.ts`; nạp qua `components/viewer/VehicleViewer.tsx` (`next/dynamic`, `ssr:false`) |
| `lib/nesting-dims.ts`                                                        | `lib/dims.ts`                                                                                                                                                                                                                                                                   |
| `lib/nesting-reconcile.ts`                                                   | `lib/piece-check.ts`                                                                                                                                                                                                                                                            |
| `lib/nesting-report/steps.ts` + `easycargo-steps.ts` (hai bản giống hệt)     | `lib/loading-steps.ts`                                                                                                                                                                                                                                                          |
| `lib/nesting-report/easycargo-capture.ts` (bản dùng chung một WebGL context) | `lib/capture.ts` + `capture-renderer.ts`, `capture-scene.ts`, `capture-fit.ts`                                                                                                                                                                                                  |
| `lib/nesting-report/manual-packing.ts`                                       | `lib/manual-packing.ts` (luật) + `lib/empty-spaces.ts` (khoảng trống, ô gợi ý)                                                                                                                                                                                                  |
| `components/export-orders/packing-shared.ts` (`PALETTE`)                     | `lib/palette.ts` + `src/constants/load-planning.ts` (bảng màu)                                                                                                                                                                                                                  |
| `components/nesting/result-metrics.tsx`                                      | `components/report/MetricsStrip.tsx` + `LayoutMetrics.tsx`                                                                                                                                                                                                                      |
| `components/nesting/loading-tables.tsx` (bảng theo xe)                       | `components/report/VehicleItemTable.tsx` + `lib/item-rows.ts`                                                                                                                                                                                                                   |
| `components/nesting/kit-packing.tsx` (`balanceOk`, badge)                    | `components/report/KitBalanceBadge.tsx` + `lib/kit-balance.ts`                                                                                                                                                                                                                  |
| `messages/vi/nesting.json`                                                   | `src/constants/labels-load-planning.ts`                                                                                                                                                                                                                                         |
| — (mới)                                                                      | `schemas.ts`, `types.ts`, `selectors.ts`, `lib/layout-check.ts`, `__fixtures__/`                                                                                                                                                                                                |

Cố ý chưa port (đến ở PR sau): bảng "hướng dẫn xếp theo bước" kèm ảnh (F6, trang in), trình soạn xếp tay
`manual-packing-editor.tsx`/`manual-edit-view.tsx` và ô gợi ý bấm được / thùng "đang cầm" của viewer (F5),
`box-list-card.tsx`, `packing-animation.tsx`, `nesting-containers.ts` (thay bằng query loại xe), `easycargo-pdf.ts`,
`pdf-font.ts` (bỏ hẳn — trang in sẽ là HTML, LP-10).

## Khác bản gốc và vì sao

- **Dữ liệu là `Layout` camelCase `…Mm`** thay cho `NestingContainerPlacement` snake_case; thứ tự D×R×C và hệ trục giữ nguyên.
- **Khối gia cố lấy từ `layout.gussets`** (BE cấp theo loại xe), không tính trong FE: bỏ `gussetBoxes` 45'/40' của bản gốc.
- **Thiếu đỡ là lỗi, không phải cảnh báo** (`validatePlacement`: `UNSUPPORTED` khi đáy được đỡ < 98%). Bản gốc cho
  đặt tay kiện treo; kế hoạch xếp xe thật có thể đổ, và BE trả `PLACEMENT_RULE_VIOLATION` cùng luật. Ô gợi ý thiếu đỡ bị loại.
- **Màu theo tập tên đã sắp xếp** (`lib/palette.ts`), không theo thứ tự gặp đầu tiên: đảo thứ tự kiện không đổi màu;
  tạo một map cho cả kế hoạch để một mặt hàng cùng màu ở mọi xe. Hai bảng màu (viewer 8 màu, ảnh in 14 màu nhạt); các màu hồng/magenta của bản gốc được thay bằng cam/chanh/xanh vì luật cứng của repo (CLAUDE.md), có test chặn.
- **Cắt bớt kiện có thông báo**: gốc lặng lẽ `slice(0, 600)`; nay khung 3D hiện "chỉ dựng N/M kiện" khi vượt `renderBoxesMax`.
- **`checkPieces` không coi số lượng hỏng là 0**: gốc `Number(q) || 0` che đúng loại lỗi mà phép đối chiếu sinh ra để bắt;
  nay dòng hỏng được đếm (`malformedLines`) và làm phép đối chiếu thất bại.
- **Cân bằng bộ theo tỉ lệ `perSet`** (1 mặt + 4 chân), không chỉ "bằng nhau"; chỉ ra xe/bộ lệch. Hợp đồng không có
  `perSet`, nên mặc định bộ được **suy ra từ chính các kiện** (`deriveKitDefs`): gom theo `kitGroup`, thành phần theo
  `partName`, `perSet` = tổng số kiện của thành phần trong cả kế hoạch ÷ ƯCLN các tổng. Cách này bắt được bộ bị chia lệch
  tỉ lệ giữa các xe nhưng KHÔNG bắt được cả kế hoạch cùng thiếu một món (tỉ lệ suy ra theo số đang có) — muốn kiểm chặt
  thì truyền định nghĩa chính thức (`computeKitBalance(layouts, kits)`, vd từ `kitParts` của dòng ước lượng); khi đó
  `kitGroup` không có định nghĩa bị báo "bộ lạ" thay vì bỏ qua. Xe không có kiện nào thuộc bộ thì không có mục và huy
  hiệu không hiện.
- **Tách khối khi tựa vòng chỉ áp cho khối trong vòng** (`loading-steps.ts`): chồng hàng chỉ đang chờ vòng giữ nguyên một bước.
- **Màu cảnh 3D theo theme** (`lib/scene-theme.ts`, `useSceneTheme`): nền/khung/lưới đọc từ token `--bg-subtle`,
  `--bg-muted`, `--ink-secondary`, `--border-*` qua `getComputedStyle` và đọc lại khi `useTheme()` đổi, nên sáng/tối theo app.
- **Khoá dòng gồm mã + tên + cỡ danh định đã sắp** (như gốc) nhưng dùng chung một hàm cho bước xếp và bảng.
- **Capture dùng một renderer dùng chung** (đúng bản `easycargo-capture`, sửa lỗi rò context WebGL) và bỏ phần PDF;
  nhả được qua `disposeSharedRenderer()`. Khối gia cố vẫn không vẽ vào ảnh in.
- **Dọn tài nguyên**: R3F tự giải phóng geometry/material/renderer khi unmount; vật liệu nhãn tự tạo được giải phóng
  trong `CargoBoxes`; ảnh chụp `disposeScene` sau mỗi cảnh. `VehicleViewer3D` không export từ `index.ts` để three không lọt bundle.
- **Nhãn qua `constants/`**, không next-intl; **màu hex trong `src/constants/load-planning.ts`** (WebGL không đọc được token
  Tailwind), phần DOM dùng token (`bg-bg-surface`, `text-ink-*`, `text-positive/warning/danger`).
- **Hằng số có nguồn** trong `LOAD_PLANNING_LIMITS` (`constants/numbers.ts`): 98% đỡ, dung sai hình học, dung sai gộp khối,
  giới hạn số kiện dựng.

## Known limits (ghi lại cho PR sau, chưa sửa ở F1)

- **Chưa dùng instancing**: mỗi kiện là một `<mesh>` + `Edges`. Ổn ở 438 kiện (fixture 40HC); viewer dừng ở
  `renderBoxesMax` = 600 và hiện thông báo. F5 phải chuyển sang `InstancedMesh` hoặc nêu lý do nếu cần vẽ vượt ~600 kiện.
- **`computeEmptySpaces` chậm**: khoảng 1,9 s trên 40HC (438 kiện) ở bản dev. F5 phải memo hoá (chỉ tính lại khi
  danh sách kiện đổi) hoặc chuyển sang web worker trước khi gọi mỗi lần chọn/kéo.
- `deriveKitDefs` không phát hiện cả kế hoạch cùng thiếu một món (xem trên).

## Dùng thế nào

```tsx
import { VehicleViewer, colorMapForLayouts, LayoutSchema } from "@/features/load-planning";

const layout = LayoutSchema.parse(json); // kiểm hợp đồng ở rìa API
<VehicleViewer layout={layout} colorMap={colorMapForLayouts(plan.vehicles)} showLabels />;
```

Ảnh chụp tải theo yêu cầu để three không vào bundle chính (không nằm trong barrel):

```ts
const { captureStepImages } = await import("@/features/load-planning/lib/capture");
```

## Test

`pnpm test src/features/load-planning` — dims, piece check, thứ tự bước (snapshot), zod, palette, cảnh 3D thuần,
luật hình học, khoảng trống, capture (renderer giả: đúng MỘT context cho mọi ảnh), và các component trình bày.
Fixture (`__fixtures__/layouts.ts`): 40HC 438 kiện hỗn hợp (có gusset, Bàn trà xoay) và bán tải chở 4 bộ bàn A+B;
test xác nhận cả hai hợp lệ hình học. Jsdom không có WebGL nên viewer chỉ có smoke test với fiber được mock
(lớp DOM: nhãn truy cập, nút góc nhìn, cảnh báo cắt bớt); hình học cảnh test ở `lib/scene.test.ts`.

## Ước tính xếp xe (F3, BE PR #160)

Ngăn kéo "Ước tính xếp xe" của một đơn: tính thử đơn xếp lên xe nào **trước khi đóng gói**, từ kích thước và khối lượng trong
hồ sơ hàng tồn. **LP2-1: chỉ để tham khảo** — không chốt kế hoạch hay đặt xe; ngăn kéo luôn ghi "Ước tính — chỉ để tham khảo".

```
POST /fulfillment/load-estimates {sources:[{type:"ORDER",id}], warehouseId?, vehicleTypeIds, selectionMode}   (…:CREATE)
GET  /fulfillment/load-estimates?sourceType=ORDER&sourceId=        → bản hiện hành; 404 LOAD_ESTIMATE_NOT_FOUND = chưa có (…:READ)
GET  /fulfillment/vehicle-types?status=ACTIVE                      → ô chọn loại xe
```

| File                                | Việc                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `estimate-schemas.ts` / `-types.ts` | zod DTO (parse tại biên) + kiểu suy ra; `vehicles` dùng `LayoutSchema` của F1                            |
| `estimate-api.ts`                   | `createLoadEstimate`, `getCurrentLoadEstimate` (404 → `null`), `listEstimateVehicleTypes`                |
| `estimate-queries.ts`               | `useCurrentEstimate`, `useEstimateVehicleTypes`, `useCreateLoadEstimate`, `loadEstimateKeys`             |
| `estimate-errors.ts`                | mã lỗi BE → câu tiếng Việt; `VALIDATION_FAILED` rẽ theo `fieldErrors[].code` của kho / loại xe           |
| `lib/estimate-view.ts`              | dẫn xuất thuần: tổng kiện chưa xếp, "hết thời gian tính", nhãn trường thiếu / cảnh báo                   |
| `components/estimate/*`             | `LoadEstimateButton` (cổng quyền) → `LoadEstimateDrawer` → `EstimatePanel` → controls + `EstimateResult` |

**Quyền (UI-only, Backend re-check):** nút hiện khi có `fulfillment-load-estimates:READ` **hoặc** `:CREATE`. Chỉ READ → xem bản
hiện hành, không có ô chọn / nút tính. Chỉ CREATE → không gọi GET hiện hành, vẫn tính được.

**Khe `estimateSlot`.** Feature không import chéo nhau, mà ngăn kéo cần mở từ màn đơn. `features/order` chỉ định nghĩa khe
(`estimate-slot.ts`); `components/backoffice/OrderDetailWithLoadEstimate.tsx` (lớp ghép của `page.tsx`) đưa `LoadEstimateButton`
vào. Mở từ **hộp thoại release** (đơn CONFIRMED, truyền kho đang chọn — BE bắt buộc `warehouseId`) và từ **thẻ hình thức giao**
của đơn đã release (BE dùng kho của đơn, không gửi `warehouseId`).

**Hiển thị.** Dải số liệu (`LayoutMetrics`), khung 3D từng xe (`VehicleViewer` + `VehicleSwitcher`), bảng dòng (quy tắc, đơn vị,
thùng, thùng lẻ, kích thước, kg), kiện chưa xếp kèm lý do tiếng Việt, cảnh báo dịch theo **mã** (BE gửi câu tiếng Anh).
`meta.budgetExhausted` hoặc kiện `SEARCH_CUT_OFF` → "Dừng do hết thời gian tính" (không phải lỗi: là phương án tốt nhất tìm
được). `incomplete` → banner cảnh báo liệt kê dòng thiếu + trường còn trống + link sang hồ sơ hàng tồn (chỉ khi có
`inventory-inventory-items:VIEW_PAGE`); 422 `LOAD_ESTIMATE_PACKAGING_MISSING` liệt kê id mặt hàng từ `inventoryItems[<id>]`.

**Ô chọn loại xe** dùng root key `fulfillment-vehicle-types` của danh mục loại xe (feature `vehicle-type`, không import chéo) nên
sửa loại xe làm mới luôn ô chọn; schema riêng chỉ giữ trường màn dùng.

**Mock** (`USE_MOCK=true`): `lib/api/mock-routes-load-estimates.ts` + `mock-load-estimate-builder.ts` dựng từ fixture F1
(SINGLE_TYPE → 40HC; FEWEST_VEHICLES → thêm xe bán tải + hết thời gian tính; đơn từ hai dòng → dòng cuối thiếu dữ liệu).
Test fixture: `__fixtures__/estimate.ts`, `render-estimate.tsx`.

## PR F4: danh sách, lập mới, chi tiết kế hoạch

Route: `/admin/load-plans` (danh sách), `/admin/load-plans/create` (lập mới), `/admin/load-plans/[id]` (chi tiết, tab
`?tab=loading|reconciliation`). Quyền theo mã (không theo vai trò): trang cần `fulfillment-load-plans:VIEW_PAGE`, xem
`:READ`, lập `:CREATE`, mọi bước sau `:UPDATE` (UI-only — BE re-check).

| Endpoint (BE PR #161)                                                                          | Chỗ dùng                                                               |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET load-plans` (`warehouseId`, `status`, `search`, `page`, `size`)                           | `LoadPlanList` (bộ lọc ở URL qua nuqs)                                 |
| `GET load-plan-candidates?warehouseId[&loadPlanId]`                                            | `ShipmentPicker` (lô nguyên xe chờ xuất, nguyên lô)                    |
| `POST load-plans` `{requestId, warehouseId, shipmentIds, vehicleTypeIds, selectionMode, note}` | `useStartLoadPlan` (idempotent theo `requestId`)                       |
| `POST …/calculation` `{expectedVersion}`                                                       | ngay sau khi tạo; nút "Tính xếp xe"                                    |
| `PUT …/inputs`                                                                                 | `EditInputsDialog` (DRAFT / PLANNED)                                   |
| `GET …/{id}`, `…/layouts`, `…/reconciliation`                                                  | `LoadPlanDetail`, `LoadingTab`, `ReconciliationTab`                    |
| `POST …/vehicles/{seq}/recalculation` `{expectedVersion, addPackageIds?}`                      | "Tính lại xe", "Đưa lại vào xe" từ khay chưa xếp                       |
| `POST …/unplaced-acknowledgement` · `confirmation` · `reopening` · `cancellation`              | `PlanStepDialog` (mở lại / huỷ bắt buộc lý do)                         |
| `GET fulfillment/vehicle-types?status=ACTIVE`                                                  | `VehicleTypePicker` (query riêng, không import feature `vehicle-type`) |

- **`requestId` ở client** (`request-ids.ts`): sinh UUID, nhớ trong sessionStorage theo nội dung ý định (kho, lô, loại xe,
  chế độ, ghi chú); bấm lại sau lỗi mạng gửi cùng id nên BE trả đúng kế hoạch đã tạo; đổi nội dung → id mới.
- **Đồng thời**: mọi thay đổi gửi `expectedVersion` (version của bản mới nhất trong cache). 409 `OPTIMISTIC_LOCK` (và các lỗi
  "dữ liệu đã cũ": trạng thái đã khác, xe vừa bị bỏ kiện…) làm mutation tải lại kế hoạch + bố cục + đối chiếu, hộp thoại hiện câu
  "đã tải lại" và giữ nguyên để bấm lại với version mới (`withStaleRefetch` + `isStaleLoadPlanError`).
- **Mã lỗi thật của BE** (`ErrorCode`): `LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED` (BR-13), `LOAD_PLAN_PACKAGE_TAKEN` và
  `PACKAGE_IN_LOAD_PLAN` (BR-09), `LOAD_PLAN_NEEDS_RECALCULATION`, `LOAD_PLAN_LOADING_STARTED` (BR-14),
  `ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED` (LP-4, số đơn ở `fieldErrors.orderNumber`), `LOAD_MANAGED_BY_PLAN`, `OPTIMISTIC_LOCK`…;
  bảng đầy đủ ở `constants/labels-load-plan.ts` (`LOAD_PLAN_ERROR_MESSAGES`).
- **Bảng "số kiện theo xe"**: BE đặt `label` của hộp là mã nhãn kiện (khác nhau từng kiện) nên `layoutsForItemTable` bỏ `label`
  để `buildItemTable` gom theo SKU + cỡ thay vì ra mỗi kiện một dòng.
- **Danh sách không có cột "% lấp đầy"**: `PlanRow` của BE không có số này (chỉ chi tiết từng xe có `volumeFillPct` /
  `weightFillPct`); danh sách hiện số xe, số kiện, số kiện chưa xếp.
- **vsEstimate chỉ để tham khảo**: cờ hiện như cảnh báo mềm, không chặn việc chốt; số xe chỉ so khi kế hoạch có một đơn.
- **Mock** (`lib/api/mock-routes-load-plans.ts` + `mock-load-plan-*.ts`): bốn kế hoạch seed (PLANNED dựng từ `LAYOUT_PICKUP_KIT`
  của F1, DRAFT, CANCELLED, CONFIRMED có xe đang LOADING để thử BR-14); bộ xếp giả xếp theo lớp trên sàn (không giữ bộ, không bảo
  đảm đỡ 98%) — chỉ để có bố cục xem được, solver thật là của BE.
