/**
 * Hồ sơ hàng tồn — hợp đồng BE PR #119 (`/inventory/items`). Luật chính sách tồn chép từ
 * `StockPolicy.validate` của BE; ngưỡng theo docs 02 §4.
 */

import { z } from "zod";

import { INVENTORY_ITEM_ERROR_MESSAGES, INVENTORY_POLICY_LIMITS, UI_LABELS } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

/** BE serialise BigDecimal thành số JSON; nhận cả chuỗi số, chặn NaN. */
const beDecimal = z.union([z.number(), z.string()]).transform(Number).pipe(z.number());

/** BE `StorageClass` (inventory :: api). */
export const STORAGE_CLASSES = ["NORMAL", "COLD", "HAZMAT", "FRAGILE", "OVERSIZE"] as const;
/** BE `TrackingMode`. */
export const TRACKING_MODES = ["NONE", "LOT", "SERIAL", "LOT_SERIAL"] as const;
/** BE `RemovalStrategy`. */
export const REMOVAL_STRATEGIES = ["FIFO", "FEFO"] as const;

/* ── DTO ─────────────────────────────────────────────────────────────── */

/** BE `InventoryItemSummaryResponse` — dòng danh sách. */
export const inventoryItemSummaryDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
  storageClass: z.enum(STORAGE_CLASSES),
  trackingMode: z.enum(TRACKING_MODES),
  policyConfigured: z.boolean(),
});

export const inventoryItemPageSchema = bePageSchema(inventoryItemSummaryDtoSchema);

/** BE PR #119 `InventoryItem.Logistics` — kích thước / khối lượng là `null` khi chưa biết. */
export const itemLogisticsDtoSchema = z.object({
  unitOfMeasure: z.string(),
  barcode: z.string().nullish(),
  weightKg: beDecimal.nullish(),
  lengthCm: beDecimal.nullish(),
  widthCm: beDecimal.nullish(),
  heightCm: beDecimal.nullish(),
  packageWeightKg: beDecimal.nullish(),
  packageLengthCm: beDecimal.nullish(),
  packageWidthCm: beDecimal.nullish(),
  packageHeightCm: beDecimal.nullish(),
  packageCount: z.number().int(),
  packSize: z.number().int(),
  storageClass: z.enum(STORAGE_CLASSES),
  requiresAdultSignature: z.boolean(),
  shippingRestrictionNote: z.string().nullish(),
  qcRequired: z.boolean(),
  // BE #121 InventoryItemResponse.Logistics.rotatable (docs 01 E13: kiện được xoay 6 hướng khi xếp
  // xe); response cũ chưa có trường → mặc định true như BE ("true when absent")
  rotatable: z.boolean().default(true),
});

export const itemPolicyDtoSchema = z.object({
  reorderPoint: z.number().int().nullish(),
  safetyStock: z.number().int().nullish(),
  maxQty: z.number().int().nullish(),
  removalStrategy: z.enum(REMOVAL_STRATEGIES),
  trackingMode: z.enum(TRACKING_MODES),
  expiryTracked: z.boolean(),
  maxShelfLifeDays: z.number().int().nullish(),
});

export const itemEvaluationDtoSchema = z.object({
  usableOnHand: z.number(),
  reorderPoint: z.number().nullish(),
  safetyStock: z.number().nullish(),
  reorderRequired: z.boolean().nullish(),
  belowSafetyStock: z.boolean().nullish(),
});

/** BE `InventoryItemResponse` — `version` dùng chung cho PUT logistics và PUT policy. */
export const inventoryItemDtoSchema = z.object({
  id: z.string(),
  sku: z.string(),
  version: z.number().int(),
  logistics: itemLogisticsDtoSchema,
  policy: itemPolicyDtoSchema,
  evaluation: itemEvaluationDtoSchema,
});

/* ── Input ───────────────────────────────────────────────────────────── */

const V = UI_LABELS.inventoryItem.validation;

const optionalPositive = z
  .string()
  .trim()
  .refine((v) => v === "" || Number(v) > 0, V.mustBePositive);
const optionalCount = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1), V.integerAtLeast1);

/** Form logistics — chuỗi người dùng gõ; chuyển sang `UpdateItemLogisticsRequest` khi gửi. */
export const logisticsFormSchema = z.object({
  unitOfMeasure: z
    .string()
    .trim()
    .regex(/^[A-Z0-9_]{1,16}$/, V.uomFormat),
  barcode: z.string().trim().max(64, V.barcodeMax),
  weightKg: optionalPositive,
  lengthCm: optionalPositive,
  widthCm: optionalPositive,
  heightCm: optionalPositive,
  packageWeightKg: optionalPositive,
  packageLengthCm: optionalPositive,
  packageWidthCm: optionalPositive,
  packageHeightCm: optionalPositive,
  packageCount: optionalCount,
  packSize: optionalCount,
  storageClass: z.enum(STORAGE_CLASSES),
  requiresAdultSignature: z.boolean(),
  shippingRestrictionNote: z.string().trim().max(500, V.noteMax),
  qcRequired: z.boolean(),
  rotatable: z.boolean(),
});

/** Chỉ chữ số thập phân — chặn "1e2" / "0x10" / "1.5" mà `Number()` vẫn nhận. */
const DIGITS = /^\d+$/;

const nonNegativeInt = z
  .string()
  .trim()
  .refine((v) => v === "" || DIGITS.test(v), V.integerAtLeast0);

/** Số nguyên hợp lệ hoặc `null` khi ô trống / không phải số nguyên (lỗi đã báo ở ô đó). */
function toInt(v: string): number | null {
  const t = v.trim();
  return DIGITS.test(t) ? Number(t) : null;
}

function isLotMode(m: (typeof TRACKING_MODES)[number]): boolean {
  return m === "LOT" || m === "LOT_SERIAL";
}

/** Form chính sách tồn — ngưỡng là chuỗi người dùng gõ, để trống = chưa đặt. */
export const policyFormSchema = z
  .object({
    reorderPoint: nonNegativeInt,
    safetyStock: nonNegativeInt,
    maxQty: nonNegativeInt,
    maxShelfLifeDays: z.string().trim(),
    removalStrategy: z.enum(REMOVAL_STRATEGIES),
    trackingMode: z.enum(TRACKING_MODES),
    expiryTracked: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const reorder = toInt(v.reorderPoint);
    const safety = toInt(v.safetyStock);
    const max = toInt(v.maxQty);

    // BE PR #119 StockPolicy.validate (docs 02 §4): tồn an toàn không vượt điểm đặt lại
    if (reorder !== null && safety !== null && safety > reorder) {
      ctx.addIssue({
        code: "custom",
        path: ["safetyStock"],
        message: V.safetyAboveReorder,
      });
    }
    // BE PR #119 StockPolicy.validate (docs 02 §4): tồn tối đa ≥ điểm đặt lại và ≥ tồn an toàn
    if (
      max !== null &&
      ((reorder !== null && max < reorder) || (safety !== null && max < safety))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxQty"],
        message: INVENTORY_ITEM_ERROR_MESSAGES.INVENTORY_MAX_QTY_BELOW_THRESHOLD,
      });
    }
    // BE PR #119 StockPolicy.validate: theo dõi hạn dùng cần theo dõi lô (LOT/LOT_SERIAL) và FEFO
    if (v.expiryTracked && !(isLotMode(v.trackingMode) && v.removalStrategy === "FEFO")) {
      ctx.addIssue({
        code: "custom",
        path: ["expiryTracked"],
        message: UI_LABELS.inventoryItem.expiryHint,
      });
    }

    if (v.maxShelfLifeDays === "") return;
    const n = DIGITS.test(v.maxShelfLifeDays) ? Number(v.maxShelfLifeDays) : Number.NaN;
    const { maxShelfLifeDaysMin: lo, maxShelfLifeDaysMax: hi } = INVENTORY_POLICY_LIMITS;
    // BE PR #119 UpdateItemPolicyRequest: maxShelfLifeDays @Min(1) @Max(36500)
    if (!(n >= lo && n <= hi)) {
      ctx.addIssue({
        code: "custom",
        path: ["maxShelfLifeDays"],
        message: V.shelfLifeRange(lo, hi),
      });
    }
    // BE PR #119 StockPolicy.validate: hạn dùng tối đa chỉ có khi theo dõi hạn dùng — không kiểm ở
    // form (ô ẩn khi tắt theo dõi); `toPolicyRequest` gửi null cho trường này khi expiryTracked = false.
  });
