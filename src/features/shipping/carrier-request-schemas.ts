/**
 * Shipping — thân `POST / PUT /fulfillment/carriers` (BE `CarrierRequest` + `CarrierConnectionRequest`, docs 09 §4.1) là lớp
 * Input (gửi đi), tách khỏi DTO trả về. Khoá bí mật (`webhookSecret`, `apiKey`, `webhookAuthValue`) vắng = giữ khoá đã lưu;
 * `failureReasonMap` vắng = giữ bảng đã lưu, `{}` = xoá hết bảng; `connection` vắng = giữ nguyên cấu hình kết nối.
 */

import { z } from "zod";

import { CARRIER_STATUSES } from "@/constants";

const failureReasonMap = z.record(z.string(), z.string()).optional();

export const saveCarrierConnectionSchema = z.discriminatedUnion("connectionType", [
  z.object({ connectionType: z.literal("MANUAL"), webhookSecret: z.undefined().optional() }),
  z.object({
    connectionType: z.literal("WEBHOOK_LOAD"),
    webhookSecret: z.string().optional(),
    failureReasonMap,
  }),
  z.object({
    connectionType: z.literal("API_BOOKING"),
    apiEnvironment: z.string().optional(),
    apiAccount: z.string().optional(),
    apiKey: z.string().optional(),
    webhookAuthHeader: z.string().optional(),
    webhookAuthValue: z.string().optional(),
    failureReasonMap,
  }),
]);

export const saveCarrierInputSchema = z.object({
  code: z.string(),
  name: z.string(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  status: z.enum(CARRIER_STATUSES),
  connection: saveCarrierConnectionSchema.optional(),
  /** Bắt buộc khi sửa: phiên bản đã đọc. */
  version: z.number().optional(),
});

export type SaveCarrierConnection = z.infer<typeof saveCarrierConnectionSchema>;
export type SaveCarrierInput = z.infer<typeof saveCarrierInputSchema>;
