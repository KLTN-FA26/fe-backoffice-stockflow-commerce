# load-planning — xếp hàng lên xe (SCRUM-287/391/392)

PR F1: **thư viện + khung 3D**. Chưa có API, route hay trang — những thứ đó đến ở F2–F9
(thiết kế: `be-backoffice-stockflow-commerce/docs/business-design/2026-10-22-scrum-287-load-planning-plan-v2.md`).
Vì vậy feature này cố ý chưa có `api.ts`, `queries.ts`, `mutations.ts`, `lifecycle.ts` (như `home`,
xem `feature-architecture.md`); chúng được thêm khi có endpoint BE.

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
  ref: string                     // mã dòng/kiện nguồn BE truyền xuyên qua solver; KHÔNG bắt buộc duy nhất
  label: string                   // mã ngắn in trên mặt kiện (SKU)
  partName: string                // tên mặt hàng — khoá chọn màu và nhóm dòng
  kitGroup: string | null         // mã bộ; vắng hoặc null nếu không thuộc bộ
  origMm: { l, w, h }             // kích thước danh định trước khi xoay
  orientation: "LWH"|"LHW"|"WLH"|"WHL"|"HLW"|"HWL"
  weightKg: number ≥ 0
}
```

**Hệ trục.** x = chiều rộng xe, y = hướng lên, **z = chiều dài xe hướng về phía cửa**. Gốc là góc sàn bên trong
sát vách đầu xe (vách đối diện cửa). `wMm` dọc x, `hMm` dọc y, `dMm` dọc z. "Xếp sâu trước" nghĩa là z nhỏ trước.

**`orientation`** là ba chữ cái theo thứ tự nhãn D×R×C, tức trục (z, x, y): chữ nào là cạnh danh định
(`origMm.l/w/h`) nằm dọc trục đó. `LWH` = không xoay (dài dọc xe, rộng ngang xe, cao lên trên). Phải khớp:
`dMm/wMm/hMm` = `origMm` hoán vị theo `orientation` (`orientedExtent` trong `lib/dims.ts`; `checkLayout`
báo `ORIENTATION_MISMATCH` nếu lệch hơn 1 mm).

**Điểm cần BE PR D chốt:** (1) `ref` có duy nhất theo từng kiện hay chỉ theo dòng nguồn — FE không phụ thuộc
(khoá React dùng `index-ref`), nhưng `PLACEMENT_RULE_VIOLATION [{ref, rule}]` chỉ chỉ đúng kiện nếu `ref` duy nhất;
(2) tên luật `OUT_OF_BOUNDS`, `OVERLAP`, `INSUFFICIENT_SUPPORT` (+ `ORIENTATION_MISMATCH`, `PAYLOAD_EXCEEDED`
ở `lib/layout-check.ts`) là đề xuất của FE; (3) schema không chặn số lẻ mm — BE làm tròn thế nào thì FE nhận thế đó.

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
- **Thiếu đỡ là lỗi, không phải cảnh báo** (`validatePlacement`: `INSUFFICIENT_SUPPORT` khi đáy được đỡ < 98%). Bản gốc cho
  đặt tay kiện treo; kế hoạch xếp xe thật có thể đổ, và BE trả `PLACEMENT_RULE_VIOLATION` cùng luật. Ô gợi ý thiếu đỡ bị loại.
- **Màu theo tập tên đã sắp xếp** (`lib/palette.ts`), không theo thứ tự gặp đầu tiên: đảo thứ tự kiện không đổi màu;
  tạo một map cho cả kế hoạch để một mặt hàng cùng màu ở mọi xe. Hai bảng màu (viewer 8 màu, ảnh in 14 màu nhạt).
- **Cắt bớt kiện có thông báo**: gốc lặng lẽ `slice(0, 600)`; nay khung 3D hiện "chỉ dựng N/M kiện" khi vượt `renderBoxesMax`.
- **`checkPieces` không coi số lượng hỏng là 0**: gốc `Number(q) || 0` che đúng loại lỗi mà phép đối chiếu sinh ra để bắt;
  nay dòng hỏng được đếm (`malformedLines`) và làm phép đối chiếu thất bại.
- **Cân bằng bộ theo tỉ lệ `perSet`** (1 mặt + 4 chân), không chỉ "bằng nhau"; chỉ ra xe/bộ lệch.
- **Khoá dòng gồm mã + tên + cỡ danh định đã sắp** (như gốc) nhưng dùng chung một hàm cho bước xếp và bảng.
- **Capture dùng một renderer dùng chung** (đúng bản `easycargo-capture`, sửa lỗi rò context WebGL) và bỏ phần PDF;
  nhả được qua `disposeSharedRenderer()`. Khối gia cố vẫn không vẽ vào ảnh in.
- **Dọn tài nguyên**: R3F tự giải phóng geometry/material/renderer khi unmount; vật liệu nhãn tự tạo được giải phóng
  trong `CargoBoxes`; ảnh chụp `disposeScene` sau mỗi cảnh. `VehicleViewer3D` không export từ `index.ts` để three không lọt bundle.
- **Nhãn qua `constants/`**, không next-intl; **màu hex trong `src/constants/load-planning.ts`** (WebGL không đọc được token
  Tailwind), phần DOM dùng token (`bg-bg-surface`, `text-ink-*`, `text-positive/warning/danger`).
- **Hằng số có nguồn** trong `LOAD_PLANNING_LIMITS` (`constants/numbers.ts`): 98% đỡ, dung sai hình học, dung sai gộp khối,
  giới hạn số kiện dựng.

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
