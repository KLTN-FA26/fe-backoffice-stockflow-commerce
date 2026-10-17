/**
 * Chính sách tồn kho theo SKU — BE `InventoryControlController`:
 * `GET/PUT /products/{id}/skus/{variantId}/inventory-control` (variantId là skuId). Quy tắc kiểm soát
 * tồn (docs 01 §3 "Kiểm soát tồn kho", §4 bước 5) lấy từ BE `StockPolicy.validate`.
 */

import { z } from "zod";

/** BE `RemovalStrategy` (inventory :: api): chiến lược chọn lô khi xuất. */
export const REMOVAL_STRATEGIES = ["FIFO", "FEFO"] as const;
export type RemovalStrategy = (typeof REMOVAL_STRATEGIES)[number];

/** BE `TrackingMode`: theo dõi lô và / hoặc serial. */
export const TRACKING_MODES = ["NONE", "LOT", "SERIAL", "LOT_SERIAL"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/** BE `TrackingMode#lotTracked`. */
export const isLotTracked = (mode: TrackingMode): boolean =>
  mode === "LOT" || mode === "LOT_SERIAL";

/** Trường BE có thể vắng (non_null) hoặc null → luôn `T | null`. */
const nullishToNull = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null);

/** BE `InventoryControlResponse` — chính sách hiện hành + đánh giá ngưỡng theo tồn khả dụng. */
export const beInventoryControlSchema = z.object({
  skuId: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string(),
  /** Version của mục tồn kho — gửi lại khi sửa (lệch → 409 CONFLICT). */
  version: z.number().int().min(0),
  // BE `default-property-inclusion: non_null`: chưa đặt thì trường vắng mặt (không phải null) →
  // `nullish` rồi chuẩn hoá về `null` cho phần còn lại của FE.
  reorderPoint: nullishToNull(z.number().int()),
  safetyStock: nullishToNull(z.number().int()),
  removalStrategy: z.enum(REMOVAL_STRATEGIES),
  trackingMode: z.enum(TRACKING_MODES),
  expiryTracked: z.boolean(),
  maxShelfLifeDays: nullishToNull(z.number().int()),
  /** Tồn khả dụng (không phải ATP: giữ chỗ không trừ vào ngưỡng đặt hàng lại). */
  usableOnHand: z.number(),
  /** `null` khi chưa đặt điểm đặt hàng lại / tồn an toàn. */
  reorderRequired: nullishToNull(z.boolean()),
  belowSafetyStock: nullishToNull(z.boolean()),
});
export type InventoryControl = z.infer<typeof beInventoryControlSchema>;

/** `@Min(1) @Max(36500)` của `maxShelfLifeDays`. */
export const MAX_SHELF_LIFE_RANGE = { min: 1, max: 36500 } as const;

const nonNegativeInt = z
  .string()
  .trim()
  .refine((v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 0), "Số nguyên ≥ 0");

/** Form chính sách — chuỗi người dùng gõ; trống = chưa đặt (BE `null`, khác với 0 là ngưỡng thật). */
export const inventoryControlFormSchema = z
  .object({
    reorderPoint: nonNegativeInt,
    safetyStock: nonNegativeInt,
    removalStrategy: z.enum(REMOVAL_STRATEGIES),
    trackingMode: z.enum(TRACKING_MODES),
    expiryTracked: z.boolean(),
    maxShelfLifeDays: z
      .string()
      .trim()
      .refine(
        (v) =>
          v === "" ||
          (Number.isInteger(Number(v)) &&
            Number(v) >= MAX_SHELF_LIFE_RANGE.min &&
            Number(v) <= MAX_SHELF_LIFE_RANGE.max),
        `Số ngày từ ${MAX_SHELF_LIFE_RANGE.min} đến ${MAX_SHELF_LIFE_RANGE.max}`,
      ),
  })
  .superRefine((v, ctx) => {
    // BE `StockPolicy.validate`: tồn an toàn không vượt điểm đặt hàng lại (chỉ so khi cả hai đã hợp lệ).
    const reorder = Number(v.reorderPoint);
    const safety = Number(v.safetyStock);
    if (
      v.reorderPoint !== "" &&
      v.safetyStock !== "" &&
      Number.isInteger(reorder) &&
      Number.isInteger(safety) &&
      reorder >= 0 &&
      safety >= 0 &&
      safety > reorder
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["safetyStock"],
        message: "Tồn an toàn không được vượt điểm đặt hàng lại",
      });
    }
    // BE `StockPolicy.validate`: theo dõi hạn dùng cần theo dõi lô và xuất theo FEFO.
    if (v.expiryTracked && !isLotTracked(v.trackingMode)) {
      ctx.addIssue({
        code: "custom",
        path: ["trackingMode"],
        message: "Theo dõi hạn dùng cần theo dõi theo lô",
      });
    }
    if (v.expiryTracked && v.removalStrategy !== "FEFO") {
      ctx.addIssue({
        code: "custom",
        path: ["removalStrategy"],
        message: "Theo dõi hạn dùng cần xuất theo FEFO",
      });
    }
    // BE `StockPolicy.validate`: hạn dùng tối đa chỉ có khi theo dõi hạn dùng.
    if (!v.expiryTracked && v.maxShelfLifeDays !== "") {
      ctx.addIssue({
        code: "custom",
        path: ["maxShelfLifeDays"],
        message: "Chỉ đặt hạn dùng tối đa khi theo dõi hạn dùng",
      });
    }
  });
export type InventoryControlFormValues = z.infer<typeof inventoryControlFormSchema>;
