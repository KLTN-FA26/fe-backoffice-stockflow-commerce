import { z } from "zod";

import { INVENTORY_MESSAGES } from "@/constants/inventory";
import { QUARANTINE_LIMITS } from "@/constants/quarantine";

import { beUuid, requiredString } from "@/lib/validation/primitives";

// Source: backend develop df34c338 `StockPackageDetailResponse` (GET /inventory/stock-packages/{lpn}). `status` is
// a String on the wire (RECEIVING, IN_STOCK, CONSUMED, LOST, VOID): read it open.
export const stockPackageContentDto = z.object({
  lotNumber: z.string().nullish(),
  receivedAt: z.iso.datetime().nullish(),
  status: z.string(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
});

export const stockPackageDetailDto = z.object({
  lpn: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string().nullish(),
  nominalQty: z.number().int().nonnegative(),
  receivedQty: z.number().int().nonnegative().nullish(),
  lotNumber: z.string().nullish(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  status: z.string(),
  locationCode: z.string().nullish(),
  goodsReceiptLineId: beUuid.nullish(),
  closedAt: z.iso.datetime().nullish(),
  contents: z.array(stockPackageContentDto).nullish(),
});

// `PutawayTaskResponse` of `POST …/quarantine-release`: only what the screen shows.
export const releasedPutawayTaskDto = z.object({
  id: beUuid,
  lpn: z.string().nullish(),
  status: z.string(),
  sourceLocationCode: z.string().nullish(),
});

// QuarantineStockPackageRequest (docs 20 §4.8 bước 1): vị trí đích thuộc khu QUARANTINE và lý do.
export const quarantineInput = z.object({
  locationCode: requiredString(INVENTORY_MESSAGES.required)
    .max(QUARANTINE_LIMITS.locationLength)
    .transform((value) => value.toUpperCase()),
  reason: requiredString(INVENTORY_MESSAGES.required).max(QUARANTINE_LIMITS.reasonLength),
});

export const cartonLookupInput = z.object({
  lpn: requiredString(INVENTORY_MESSAGES.required)
    .max(QUARANTINE_LIMITS.lpnLength)
    .transform((value) => value.toUpperCase()),
});
