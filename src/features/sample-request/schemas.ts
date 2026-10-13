/**
 * Yêu cầu làm mẫu — hợp đồng BE local integration d215f6e (SampleRequestController,
 * handoff SCRUM-394-395). Jackson `non_null` → `.nullish()` cho field có thể vắng.
 */

import { z } from "zod";

import { PRODUCTION_API_STATUSES, SAMPLE_API_STATUSES } from "@/constants";
import { bePageSchema } from "@/lib/api/page-schema";

const productionRefSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.enum(PRODUCTION_API_STATUSES),
  warehouseId: z.string(),
});

export const sampleRoundDtoSchema = z.object({
  id: z.string(),
  requestNumber: z.string(),
  round: z.number().int(),
  status: z.enum(SAMPLE_API_STATUSES),
  designSnapshotId: z.string(),
  blankSku: z.string(),
  quantity: z.number().int(),
  dueDate: z.string().nullish(),
  sentAt: z.string().nullish(),
  respondedAt: z.string().nullish(),
  customerFeedback: z.string().nullish(),
  cancellationReason: z.string().nullish(),
});

export const sampleRowDtoSchema = z.object({
  id: z.string(),
  requestNumber: z.string(),
  customerId: z.string(),
  round: z.number().int(),
  status: z.enum(SAMPLE_API_STATUSES),
  designSnapshotId: z.string(),
  blankSku: z.string(),
  quantity: z.number().int(),
  dueDate: z.string().nullish(),
  sentAt: z.string().nullish(),
  respondedAt: z.string().nullish(),
  productionOrder: productionRefSchema.nullish(),
  createdAt: z.string(),
});
export const samplePageDtoSchema = bePageSchema(sampleRowDtoSchema);

export const sampleDetailDtoSchema = z.object({
  id: z.string(),
  requestNumber: z.string(),
  customerId: z.string(),
  quoteId: z.string().nullish(),
  previousRoundId: z.string().nullish(),
  nextRoundId: z.string().nullish(),
  round: z.number().int(),
  status: z.enum(SAMPLE_API_STATUSES),
  specification: z.object({
    designSnapshotId: z.string(),
    blankSku: z.string(),
    quantity: z.number().int(),
    dueDate: z.string().nullish(),
  }),
  sentAt: z.string().nullish(),
  respondedAt: z.string().nullish(),
  customerFeedback: z.string().nullish(),
  cancellationReason: z.string().nullish(),
  productionOrder: productionRefSchema.nullish(),
  rounds: z.array(sampleRoundDtoSchema),
  createdAt: z.string(),
  version: z.number().int(),
});

/* ── Input ───────────────────────────────────────────────────────────── */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKU = /^[A-Z0-9-]{3,64}$/;

export const sampleSpecInputSchema = z.object({
  designSnapshotId: z.string().trim().regex(UUID, "Chọn thiết kế đã được khách xác nhận"),
  blankSku: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => SKU.test(v), "Mã phôi gồm 3–64 ký tự A–Z, 0–9, dấu -"),
  // BE: 1–1000 cái mỗi lần mẫu (CreateSampleRequestRequest @Min(1) @Max(1000)).
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Số lượng là số nguyên")
    .refine((v) => Number(v) >= 1 && Number(v) <= 1000, "Mẫu từ 1 đến 1000 cái"),
  dueDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ngày không hợp lệ"),
});

export const sampleCreateInputSchema = sampleSpecInputSchema.extend({
  customerId: z.string().regex(UUID, "Chọn khách hàng"),
  quoteId: z
    .string()
    .trim()
    .refine((v) => v === "" || UUID.test(v), "Mã báo giá không hợp lệ"),
});
