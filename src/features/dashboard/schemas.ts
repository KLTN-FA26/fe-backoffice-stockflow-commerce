import { z } from "zod";

import { beUuid } from "@/lib/validation/primitives";

// Only the paging total is read: counters never look at the rows.
export const countPageDto = z.object({ totalElements: z.number().int().nonnegative() });

// BE `StockAlertSummaryResponse`: every kind present, zero when none; kinds are Strings.
export const alertSummaryDto = z.object({
  openByKind: z.record(z.string(), z.number().int().nonnegative()),
});

// BE `StockAlertResponse` — fields the dashboard shows. `kind`/`status` stay open Strings so a newer
// code does not invalidate the page; nullable fields are omitted by Jackson NON_NULL.
export const stockAlertDto = z.object({
  id: beUuid,
  kind: z.string(),
  sku: z.string(),
  warehouseCode: z.string().nullish(),
  lotNumber: z.string().nullish(),
  expiryDate: z.string().nullish(),
  observedQty: z.number().int(),
  thresholdQty: z.number().int().nullish(),
  status: z.string(),
  openedAt: z.iso.datetime(),
});

export const stockAlertPageDto = z.object({
  items: z.array(stockAlertDto),
  totalElements: z.number().int().nonnegative(),
});
