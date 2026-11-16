/**
 * Shipping — zod DTO mã vận đơn theo chuyến (BE `WaybillChangeResponse`, `WaybillImportResponse`, docs 09 §4.4).
 * BE bỏ null khỏi JSON nên trường tuỳ chọn khai `.nullish()`; enum khoan dung như `schemas.ts`.
 */

import { z } from "zod";

import { WAYBILL_IMPORT_OUTCOMES, WAYBILL_IMPORT_PROBLEMS, WAYBILL_SOURCES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { count, isoInstant, tolerantEnum } from "./schemas";

/** BE `WaybillChangeResponse` — một lần đổi mã vận đơn (cũ → mới, nguồn, người, thời điểm, lý do; BR-24). */
export const beWaybillChangeSchema = z.object({
  oldWaybillNo: z.string().nullish(),
  /** Vắng khi đặt xe bị huỷ và mã đi cùng. */
  newWaybillNo: z.string().nullish(),
  source: tolerantEnum(WAYBILL_SOURCES),
  /** Vắng với webhook. */
  changedBy: z.string().nullish(),
  changedByName: z.string().nullish(),
  changedAt: isoInstant,
  reason: z.string().nullish(),
});

export const beWaybillHistorySchema = z.array(beWaybillChangeSchema);

/** BE `WaybillImportResponse.Line` — một dòng của file và kết quả của nó. */
export const beWaybillImportLineSchema = z.object({
  /** Số dòng trong file, dòng tiêu đề là dòng 1 (số Excel hiện). */
  line: z.number().int().min(1),
  loadCode: z.string().nullish(),
  waybillNo: z.string().nullish(),
  vehiclePlate: z.string().nullish(),
  driverName: z.string().nullish(),
  driverPhone: z.string().nullish(),
  loadId: z.string().nullish(),
  outcome: tolerantEnum(WAYBILL_IMPORT_OUTCOMES),
  problem: tolerantEnum(WAYBILL_IMPORT_PROBLEMS).nullish(),
  /** Với DUPLICATE_IN_CARRIER: mã chuyến đang giữ mã vận đơn này. */
  holderCode: z.string().nullish(),
});

/** BE `WaybillImportResponse` — xem trước (không có `importId`, chưa ghi gì) hoặc kết quả đã nhập. */
export const beWaybillImportSchema = z.object({
  importId: z.string().nullish(),
  fileName: z.string().nullish(),
  uploadedBy: z.string().nullish(),
  uploadedAt: isoInstant.nullish(),
  rowsTotal: count,
  rowsApplied: count,
  rowsRejected: count,
  lines: z.array(beWaybillImportLineSchema),
});

/** BE `WaybillImportResponse.Row` — một lần nhập trong danh sách. */
export const beWaybillImportRowSchema = z.object({
  importId: z.string(),
  fileName: z.string().nullish(),
  uploadedBy: z.string().nullish(),
  uploadedAt: isoInstant.nullish(),
  rowsTotal: count,
  rowsApplied: count,
  rowsRejected: count,
});

export const beWaybillImportPageSchema = bePageSchema(beWaybillImportRowSchema);
