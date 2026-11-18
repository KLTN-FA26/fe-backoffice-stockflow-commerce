/**
 * Bảng sức chứa kho (docs 06 §4.6, BR-20) — parse một lần tại biên API (api-conventions §3.2).
 * Hợp đồng: BE `WarehouseCapacityService.Board` / `.Group` (`GET /warehouse-capacity`), `WarehouseResponse`
 * (`GET /warehouses/{id}`). BE `default-property-inclusion: non_null` → trường null vắng mặt → `.nullish()`.
 */

import { z } from "zod";

import { CAPACITY_GROUP_KINDS, UI_LABELS, WAREHOUSE_CAPACITY_LIMITS } from "@/constants";

const V = UI_LABELS.warehouseCapacity.validation;
const LIMITS = WAREHOUSE_CAPACITY_LIMITS;

/** BE `BigDecimal` → số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

// ---- DTO -----------------------------------------------------------------------------------------------------------

/**
 * Một dòng dưới cấp kho (docs 06 §4.6 bước 4). Khu vực không có sức chứa (BR-19, chốt 2026-11-13) nên
 * `capacityM3` / `freeM3` / phần trăm vắng mặt; nhóm `NO_ZONE` không có `id` / `name`.
 */
export const capacityGroupDto = z.object({
  key: z.string(),
  kind: z.enum(CAPACITY_GROUP_KINDS),
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  capacityM3: beDecimal.nullish(),
  occupiedM3: beDecimal,
  freeM3: beDecimal.nullish(),
  occupiedPercent: beDecimal.nullish(),
  freePercent: beDecimal.nullish(),
  binsWithoutVolume: z.number().int(),
});

/**
 * Bảng của một kho (docs 06 §4.6 bước 3, BR-20) — tính khi đọc, không lưu. m³ 3 số lẻ, % là 0–100 hai số lẻ,
 * vắng khi kho chưa có sức chứa. Còn trống dự kiến / nếu duyệt hết có thể âm.
 */
export const capacityBoardDto = z.object({
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  active: z.boolean(),
  /** (0, 1] — 0.85 là 85% (docs 06 §4.6 bước 2, C43). */
  utilizationFactor: beDecimal,
  binVolumeM3: beDecimal,
  capacityM3: beDecimal,
  occupiedM3: beDecimal,
  occupiedKg: beDecimal,
  incomingM3: beDecimal,
  projectedFreeM3: beDecimal,
  pendingM3: beDecimal,
  freeIfAllApprovedM3: beDecimal,
  outgoingM3: beDecimal,
  occupiedPercent: beDecimal.nullish(),
  projectedFreePercent: beDecimal.nullish(),
  binsWithoutVolume: z.number().int(),
  cartonsWithoutSize: z.number().int(),
  productionCartonsWithoutSize: z.number().int(),
  groups: z.array(capacityGroupDto),
});

export const capacityBoardListDto = z.array(capacityBoardDto);

/** Phần của `WarehouseResponse` cần để gửi lại `PUT /warehouses/{id}` (thay toàn bộ) khi sửa hệ số. */
export const factorWarehouseDto = z.object({
  id: z.string(),
  prefix: z.string(),
  name: z.string(),
  address: z.string(),
  returnAddress: z.string().nullish(),
  mapWidth: beDecimal,
  mapHeight: beDecimal,
  version: z.number().int(),
  utilizationFactor: beDecimal.nullish(),
});

// ---- Input ---------------------------------------------------------------------------------------------------------

const DECIMALS = new RegExp(`^\\d+(?:[.,]\\d{1,${LIMITS.factorPercentDecimals}})?$`);
const percentOf = (raw: string) => Number(raw.trim().replace(",", "."));

/**
 * Form "Sửa hệ số sử dụng" — người dùng nhập phần trăm.
 * Docs 06 §4.6 bước 2 + open-questions C43 (chốt 2026-11-05): một hệ số cho cả kho, trong (0%, 100%], mặc định
 * 100%. BE `UpdateWarehouseRequest.utilizationFactor` `@DecimalMin(0, exclusive) @DecimalMax(1) @Digits(fraction=4)`.
 */
export const utilizationFactorInput = z.object({
  factorPercent: z
    .string()
    .trim()
    .min(1, V.factorRequired)
    .refine((raw) => DECIMALS.test(raw), V.factorDecimals)
    // C43: 0% < hệ số ≤ 100%
    .refine((raw) => {
      const percent = percentOf(raw);
      return percent > 0 && percent <= LIMITS.factorPercentMax;
    }, V.factorRange),
});

/** Phần trăm đã kiểm (chuỗi form) → hệ số BE (0, 1], 4 số lẻ. */
export const factorFromPercent = (raw: string): number =>
  Number((percentOf(raw) / LIMITS.factorPercentMax).toFixed(LIMITS.factorPercentDecimals + 2));
