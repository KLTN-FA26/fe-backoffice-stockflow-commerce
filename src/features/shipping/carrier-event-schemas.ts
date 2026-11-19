/**
 * Shipping — zod DTO sự kiện hãng vận chuyển (BE `CarrierEvents.EventRow`, `EventDetail`; docs 09 §4.5).
 * BE bỏ null khỏi JSON nên trường tuỳ chọn khai `.nullish()`; enum khoan dung như `schemas.ts`. `payload` là nội dung
 * hãng gửi, BE đã che thông tin xác thực — màn chỉ hiện, không dựng lại.
 */

import { z } from "zod";

import { CARRIER_EVENT_KINDS, CARRIER_EVENT_RESULTS, CARRIER_EVENT_SOURCES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

import { isoInstant, tolerantEnum } from "./schemas";

/** BE `CarrierEvents.EventRow` — một sự kiện: hãng báo gì, ghép vào đâu, kết quả, ai đã xử lý. */
export const beCarrierEventRowSchema = z.object({
  eventId: z.string(),
  carrierId: z.string().nullish(),
  carrierCode: z.string().nullish(),
  source: tolerantEnum(CARRIER_EVENT_SOURCES),
  receivedAt: isoInstant,
  signatureValid: z.boolean(),
  kind: tolerantEnum(CARRIER_EVENT_KINDS).nullish(),
  carrierReference: z.string().nullish(),
  carrierReportedAt: isoInstant.nullish(),
  warehouseId: z.string().nullish(),
  loadId: z.string().nullish(),
  loadCode: z.string().nullish(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  result: tolerantEnum(CARRIER_EVENT_RESULTS),
  resultNote: z.string().nullish(),
  decidedAt: isoInstant.nullish(),
  resolvedAt: isoInstant.nullish(),
  resolvedBy: z.string().nullish(),
  resolvedByName: z.string().nullish(),
  resolutionNote: z.string().nullish(),
});

export const beCarrierEventPageSchema = bePageSchema(beCarrierEventRowSchema);

/** BE `CarrierEvents.EventDetail` — sự kiện kèm nội dung hãng gửi (thông tin xác thực đã che). */
export const beCarrierEventDetailSchema = z.object({
  event: beCarrierEventRowSchema,
  payload: z.string().nullish(),
});

/** Ghi chú xử lý (BE `CarrierEventResolutionRequest`): bắt buộc, tối đa 1000 ký tự. */
export function carrierEventNoteSchema(
  messages: { required: string; tooLong: string },
  max: number,
) {
  return z.object({
    note: z.string().trim().min(1, messages.required).max(max, messages.tooLong),
  });
}
