import { z } from "zod";

import { MOVE_LIMITS, MOVE_MESSAGES } from "@/constants/move";

import { beUuid, requiredString } from "@/lib/validation/primitives";
import { skuSchema } from "@/lib/validation/sku";

import { sameLocation, sameWarehouse, warehouseOf } from "./selectors";

// Source: backend develop `MoveStockRequest` (sku @ValidSku, lotNumber @Size(64), from/to @NotBlank
// @Size(64), quantity @Min(1) @Max(1_000_000)). `requestId` is the idempotency key and is added by
// the API layer, not typed by the user.
export const moveCreateInput = z
  .object({
    sku: skuSchema({ required: MOVE_MESSAGES.required, format: MOVE_MESSAGES.invalidSku }),
    lotNumber: z.string().trim().max(MOVE_LIMITS.lotLength).optional(),
    fromLocation: requiredString(MOVE_MESSAGES.required).max(MOVE_LIMITS.locationLength),
    toLocation: requiredString(MOVE_MESSAGES.required).max(MOVE_LIMITS.locationLength),
    quantity: z
      .number(MOVE_MESSAGES.quantity)
      .int(MOVE_MESSAGES.quantity)
      .min(MOVE_LIMITS.quantityMin, MOVE_MESSAGES.quantity)
      .max(MOVE_LIMITS.quantityMax, MOVE_MESSAGES.quantity),
  })
  .superRefine((value, context) => {
    // BE `relocate`: "A move needs two different locations" (400 VALIDATION_FAILED).
    if (sameLocation(value.fromLocation, value.toLocation)) {
      context.addIssue({
        code: "custom",
        path: ["toLocation"],
        message: MOVE_MESSAGES.sameLocation,
      });
      return;
    }
    // Docs 11 BR-01 + BE MOVE_ACROSS_WAREHOUSES: both ends in one warehouse.
    if (!sameWarehouse(value.fromLocation, value.toLocation)) {
      context.addIssue({
        code: "custom",
        path: ["toLocation"],
        message: MOVE_MESSAGES.crossWarehouse,
      });
    }
  });

/**
 * Form trong tab theo kho (spec 2026-11-22 §5.8): cả hai vị trí phải thuộc kho đang làm việc — prefix kho là đoạn mã
 * vị trí trước dấu gạch (06 BR-10). Docs 11 BR-01; UI-only — Backend phải re-check (WarehouseScope.requireLocation).
 */
export const moveInWarehouseInput = (prefix: string) =>
  moveCreateInput.superRefine((value, context) => {
    for (const field of ["fromLocation", "toLocation"] as const) {
      const code = value[field];
      if (code && warehouseOf(code) !== prefix.toUpperCase()) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: MOVE_MESSAGES.otherWarehouse(prefix),
        });
      }
    }
  });

// BE `StockMoveResponse`; lotNumber is omitted when null (Jackson NON_NULL).
export const stockMoveDto = z.object({
  movementId: beUuid,
  sku: z.string(),
  lotNumber: z.string().nullish(),
  fromLocation: z.string(),
  toLocation: z.string(),
  quantity: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
});

// BE `StockItemResponse` (GET /inventory/stock-items?sku=): a bare list, not a page. `status` is a
// String on the wire — kept open so a newer code does not invalidate the list. SCRUM-146 (BE #202):
// for a caller without inventory-cycle-counts:APPROVE the quantities of a slot under an open count
// are ABSENT (not null) and `hiddenDuringCount` is true.
export const stockRowDto = z.object({
  id: beUuid,
  sku: z.string(),
  locationCode: z.string(),
  lotNumber: z.string().nullish(),
  expiryDate: z.string().nullish(),
  onHand: z.number().int().nonnegative().optional(),
  reserved: z.number().int().nonnegative().optional(),
  available: z.number().int().nonnegative().optional(),
  hiddenDuringCount: z.boolean().default(false),
  status: z.string(),
});
export const stockRowListDto = z.array(stockRowDto);

// BE `WarehouseStockItemResponse` (GET /inventory/warehouses/{id}/stock-items?sku=, SCRUM-462): một trang, id là
// `stockItemId`, không có expiryDate — chuẩn hoá về `StockRow` của form.
const warehouseStockRowDto = z
  .object({
    stockItemId: beUuid,
    sku: z.string(),
    locationCode: z.string(),
    lotNumber: z.string().nullish(),
    onHand: z.number().int().nonnegative().nullish(),
    reserved: z.number().int().nonnegative().nullish(),
    available: z.number().int().nonnegative().nullish(),
    hiddenDuringCount: z.boolean().default(false),
    status: z.string(),
  })
  .transform(({ stockItemId, onHand, reserved, available, ...row }) =>
    stockRowDto.parse({
      ...row,
      id: stockItemId,
      onHand: onHand ?? undefined,
      reserved: reserved ?? undefined,
      available: available ?? undefined,
    }),
  );
export const warehouseStockRowPageDto = z.object({ items: z.array(warehouseStockRowDto) });

// BE `WarehouseLayoutResponse`: only what the destination suggestions need. A NON_STORAGE area has
// no locationCode / usable (omitted), so both stay optional.
const layoutPlaceDto = z.object({
  locationCode: z.string().nullish(),
  usable: z.boolean().nullish(),
});
export const warehouseLayoutDto = z.object({
  shelves: z.array(
    z.object({
      levels: z.array(z.object({ bins: z.array(layoutPlaceDto) })),
    }),
  ),
  areas: z.array(layoutPlaceDto),
});
