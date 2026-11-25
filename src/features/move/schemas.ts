import { z } from "zod";

import { MOVE_LIMITS, MOVE_MESSAGES } from "@/constants/move";
import { PUTAWAY_SUGGESTION_REASONS } from "@/constants/putaway";

import { requiredString } from "@/lib/validation/primitives";

import { normalizeLpn, warehouseOf } from "./selectors";

// Source: backend develop `MoveStockPackagesRequest` (BE 0a0226a8, 2026-11-09). Docs 11 BR-04, BR-07 và 01 BR-09: chuyển
// vị trí là chuyển NGUYÊN THÙNG, quét theo LPN — không SKU, lô, vị trí nguồn hay số lượng (LPN cho biết hết). lpns
// @NotEmpty @Size(max = 500), mỗi LPN @NotBlank @Size(max = 30); toLocation @NotBlank @Size(max = 64). `requestId` là
// khoá idempotent do lớp API thêm, người dùng không gõ.
export const moveCreateInput = z.object({
  lpns: z
    .array(
      z
        .string()
        .transform(normalizeLpn)
        .pipe(
          z
            .string()
            .min(1, MOVE_MESSAGES.required)
            .max(MOVE_LIMITS.lpnLength, MOVE_MESSAGES.lpnLength),
        ),
    )
    // Bỏ trùng: một thùng chỉ chuyển một lần trong lệnh (BE so tập LPN khi gửi lại cùng requestId).
    .transform((lpns) => [...new Set(lpns)])
    .pipe(
      z
        .array(z.string())
        .min(1, MOVE_MESSAGES.noCartons)
        .max(MOVE_LIMITS.lpnsMax, MOVE_MESSAGES.tooManyCartons),
    ),
  toLocation: requiredString(MOVE_MESSAGES.required)
    .max(MOVE_LIMITS.locationLength)
    .transform((value) => value.toUpperCase()),
});

/**
 * Form trong tab theo kho (spec 2026-11-22 §5.8): vị trí đích phải thuộc kho đang làm việc — prefix kho là đoạn mã vị
 * trí trước dấu gạch (06 BR-10). Docs 11 BR-01; UI-only — Backend phải re-check (WarehouseScope.requireLocation,
 * MOVE_ACROSS_WAREHOUSES).
 */
export const moveInWarehouseInput = (prefix: string) =>
  moveCreateInput.superRefine((value, context) => {
    if (value.toLocation && warehouseOf(value.toLocation) !== prefix.toUpperCase()) {
      context.addIssue({
        code: "custom",
        path: ["toLocation"],
        message: MOVE_MESSAGES.otherWarehouse(prefix),
      });
    }
  });

// BE `MovedStockPackageResponse`: thùng sau khi chuyển. `sku` / `quantity` chỉ mô tả thùng chứa gì (01 BR-09: tồn ghi
// nội bộ theo đơn vị cơ sở), không phải đầu vào. `Integer quantity` / `String unitOfMeasure` có thể null.
export const movedCartonDto = z.object({
  lpn: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string().nullish(),
  quantity: z.number().int().nonnegative().nullish(),
  locationCode: z.string(),
  status: z.string(),
});
export const movedCartonsDto = z.array(movedCartonDto);

// BE `StockPackageDetailResponse` (GET /inventory/stock-packages/{lpn}) — chỉ phần màn chuyển cần. `status` mở
// (RECEIVING, IN_STOCK, CONSUMED, LOST, VOID): mã lạ hiện nguyên văn, không làm hỏng màn.
export const cartonDto = z.object({
  lpn: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string().nullish(),
  lotNumber: z.string().nullish(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  status: z.string(),
  locationCode: z.string().nullish(),
});

// BE `StockPackageResponse` (GET /inventory/stock-packages, một trang) — cùng phần trên của từng dòng.
export const cartonPageDto = z.object({
  items: z.array(cartonDto),
  hasNext: z.boolean().default(false),
});

// Một dòng của danh sách thùng sẽ chuyển (state của form, không đi qua mạng). Thùng thêm khi không tra được (thiếu
// inventory-stock-packages:READ) chỉ có LPN — các trường còn lại `null`, BE kiểm khi gửi lệnh.
export const scannedCartonSchema = z.object({
  lpn: z.string(),
  sku: z.string().nullable(),
  lotNumber: z.string().nullable(),
  onHand: z.number().int().nonnegative().nullable(),
  locationCode: z.string().nullable(),
});

// BE `ApiResponse.details` của lỗi chuyển thùng: STOCK_PACKAGE_HELD, STOCK_PACKAGE_QUARANTINED, LOCATION_AREA_MISMATCH,
// CARTON_DOES_NOT_FIT_BIN nêu thùng gây lỗi (`lpn`). Dữ liệu mạng — parse trước khi dùng.
export const moveErrorDetailsDto = z.object({ lpn: z.string().optional() });

// BE `WarehouseLayoutResponse`: only what the destination suggestions need. A NON_STORAGE area has
// no locationCode / usable (omitted), so both stay optional; `type` (AreaType) marks a STAGING area.
const layoutPlaceDto = z.object({
  locationCode: z.string().nullish(),
  usable: z.boolean().nullish(),
  type: z.string().nullish(),
});
export const warehouseLayoutDto = z.object({
  shelves: z.array(
    z.object({
      levels: z.array(z.object({ bins: z.array(layoutPlaceDto) })),
    }),
  ),
  areas: z.array(layoutPlaceDto),
});

// BE `MoveSuggestionResponse` (#412, PR #450, develop c23a3eee; nghiệp vụ docs#46, docs 11 BR-10): bin nhận được MỌI thùng đang
// chọn — vừa từng thùng theo kích thước (06 BR-01), đủ thể tích + tải cho cả nhóm. Thứ tự = thứ hạng của PutawayRanker
// (05 §4.3), `reason` cùng tập với màn cất hàng. `freeVolumeM3` / `freeWeightKg` null = không giới hạn. `overflowAreas`
// chỉ có khi không bin nào nhận (05 BR-13). Chỉ để tham khảo: không giữ chỗ, lệnh chuyển vẫn kiểm lại (11 BR-10).
export const binSuggestionDto = z.object({
  locationCode: z.string(),
  reason: z.enum(PUTAWAY_SUGGESTION_REASONS),
  freeVolumeM3: z.number().nullish(),
  freeWeightKg: z.number().nullish(),
});
export const binSuggestionsDto = z.object({
  suggestions: z.array(binSuggestionDto),
  overflowAreas: z.array(z.string()).default([]),
});
