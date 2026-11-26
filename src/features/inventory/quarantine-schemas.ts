import { z } from "zod";

import { INVENTORY_MESSAGES } from "@/constants/inventory";
import { QUARANTINE_LIMITS } from "@/constants/quarantine";

import { beUuid, requiredString } from "@/lib/validation/primitives";

import { inventoryPageDto } from "./schemas";

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
  // ADR-0011 (BE, issue #305): `countedAt` replaces `receivedQty`; null while the carton is only labelled.
  countedAt: z.iso.datetime().nullish(),
  lotNumber: z.string().nullish(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  status: z.string(),
  locationCode: z.string().nullish(),
  goodsReceiptLineId: beUuid.nullish(),
  closedAt: z.iso.datetime().nullish(),
  contents: z.array(stockPackageContentDto).nullish(),
  /**
   * WF-05 BE-24 (F-22): thùng hàng trả / hàng hoàn về đã bị mở (đếm ít hơn nhãn) — không gỡ cách ly để bán lại được, chỉ ghi
   * giảm (BE `RETURN_CARTON_OPENED`). Vắng = BE cũ.
   */
  openedOnReturn: z.boolean().nullish(),
  returnOpenedAt: z.string().nullish(),
  /**
   * Audit r3 RAD-4 (BE r3c): hàng của ai sau lần cuối thùng về trên một yêu cầu trả hàng. PENDING: hoàn tiền của yêu cầu
   * chưa quyết — gỡ cách ly / ghi giảm bị BE từ chối (409 STOCK_PACKAGE_DECISION_PENDING); COMPANY: quyết như thùng cách
   * ly thường; CUSTOMER_HELD / CUSTOMER_SENT_BACK / CUSTOMER_DESTROYED: hàng của khách, ngoài sổ. Null / vắng: chưa từng
   * về trên yêu cầu trả hàng (hoặc BE cũ). Chuỗi mở.
   */
  returnOwnership: z.string().nullish(),
  /** Yêu cầu trả hàng thùng về lần cuối; null cùng `returnOwnership`. */
  returnRequestId: z.string().nullish(),
  returnRmaNumber: z.string().nullish(),
});

// Source: backend develop `StockPackageResponse` (GET /inventory/stock-packages, page by page). `status` is open
// (RECEIVING, IN_STOCK, CONSUMED, LOST, VOID): an unknown value is shown verbatim, never breaks the list.
export const stockPackageDto = z.object({
  lpn: z.string(),
  sku: z.string(),
  unitOfMeasure: z.string().nullish(),
  nominalQty: z.number().int().nonnegative(),
  // ADR-0011 (BE, issue #305): `countedAt` replaces `receivedQty`; null while the carton is only labelled.
  countedAt: z.iso.datetime().nullish(),
  lotNumber: z.string().nullish(),
  onHand: z.number().int().nonnegative(),
  reserved: z.number().int().nonnegative(),
  status: z.string(),
  locationCode: z.string().nullish(),
  goodsReceiptLineId: beUuid.nullish(),
  /** WF-05 BE-24 (F-22): như ở chi tiết thùng. */
  openedOnReturn: z.boolean().nullish(),
  returnOpenedAt: z.string().nullish(),
  /** Audit r3 RAD-4: như ở chi tiết thùng. */
  returnOwnership: z.string().nullish(),
  returnRequestId: z.string().nullish(),
  returnRmaNumber: z.string().nullish(),
});

export const stockPackagePageDto = inventoryPageDto(stockPackageDto);

// Query of the list: one exact location code (the quarantine area), an optional SKU; zero-based page.
export const stockPackageListInput = z.object({
  location: z.string().trim().min(1).toUpperCase(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .transform((value) => value || undefined),
  page: z.number().int().nonnegative(),
  size: z.number().int().positive(),
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
